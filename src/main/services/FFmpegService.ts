/**
 * FFmpeg 进程管理服务（单例）
 */

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { dialog, Notification, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  containsUnsupportedShellOperators,
  extractOutputFile,
  parseFFmpegCommand,
} from '../utils/commandParser';
import { safeReply } from '../utils/ipcUtils';
import { getFfmpegPath } from '../utils/pathUtils';
import { t } from '../locales';

// ========== 类型 ==========

interface FFmpegProgress {
  time: number;
}

interface FFmpegDuration {
  duration: number;
}

type IpcChannel =
  | 'ffmpeg-output'
  | 'ffmpeg-progress'
  | 'ffmpeg-duration'
  | 'ffmpeg-complete'
  | 'ffmpeg-cancelled'
  | 'ffmpeg-error';

// ========== 常量：预编译正则 ==========

/** 匹配 FFmpeg 输出中的时间戳，如 `time=00:01:23.45` */
const RE_PROGRESS = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g;

/** 匹配 FFmpeg 输出中的总时长，如 `Duration: 00:02:10.00` */
const RE_DURATION = /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/;

// ========== 进程状态 ==========

/**
 * 将所有可变状态集中管理，避免属性散落在 service 各处。
 */
interface ProcessState {
  process: ChildProcessWithoutNullStreams;
  /** 用户主动触发了停止（写 q / SIGTERM）*/
  isStopping: boolean;
  /** 已上报过总时长（只上报一次）*/
  hasReportedDuration: boolean;
  forceKillTimer: NodeJS.Timeout | null;
  stdout: LineBuffer;
  stderr: LineBuffer;
}

// ========== 行缓冲 ==========

/**
 * 将流式字节块拆分为完整文本行，尾部不完整行留存至下次 push。
 */
class LineBuffer {
  private buf = '';

  /**
   * 追加一块数据，返回本次新增的完整行（已去除换行符，保留内容空白）。
   */
  push(chunk: string): string[] {
    const lines = (this.buf + chunk).split(/\r?\n|\r/);
    // 最后一段可能不完整，暂存
    this.buf = lines.pop() ?? '';
    return lines;
  }

  /**
   * 进程结束后调用：刷出残余内容并清空缓冲区。
   */
  flush(): string[] {
    const trailing = this.buf;
    this.buf = '';
    return trailing ? [trailing] : [];
  }
}

// ========== FFmpegService ==========

class FFmpegService {
  /** 无进程时为 null，有进程时持有完整状态对象 */
  private state: ProcessState | null = null;

  // ——— 公共 API ———

  /**
   * 验证并启动 FFmpeg 命令。
   * 包含前置校验、文件覆盖确认、`-y` 参数注入。
   */
  async start(
    command: string,
    event: IpcMainEvent,
    mainWindow: BrowserWindow | null,
  ): Promise<void> {
    if (this.state) {
      return safeReply(
        event,
        'ffmpeg-error',
        'An FFmpeg process is already running. Please stop it first.',
      );
    }

    const trimmed = command?.trim();
    if (!trimmed) {
      return safeReply(
        event,
        'ffmpeg-error',
        'Empty command. Please provide a valid FFmpeg command.',
      );
    }

    let args: string[];
    try {
      args = parseFFmpegCommand(trimmed);
    } catch (error) {
      return safeReply(
        event,
        'ffmpeg-error',
        error instanceof Error ? error.message : 'Failed to parse command.',
      );
    }

    if (args.length === 0) {
      return safeReply(
        event,
        'ffmpeg-error',
        'Command has no arguments. Please provide a valid FFmpeg command.',
      );
    }

    if (containsUnsupportedShellOperators(args)) {
      return safeReply(
        event,
        'ffmpeg-error',
        'Only a single FFmpeg command is supported. Remove shell operators such as &&, ||, |, or redirects.',
      );
    }

    const outputFile = extractOutputFile(args);

    if (outputFile && fs.existsSync(outputFile)) {
      if (!mainWindow) {
        return safeReply(event, 'ffmpeg-error', t('cannotConfirmOverwrite'));
      }

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: [t('yes'), t('no')],
        defaultId: 1,
        cancelId: 1,
        title: t('confirmOverwrite'),
        message: t('fileAlreadyExists', { filename: outputFile }),
      });

      if (response === 1) {
        return safeReply(event, 'ffmpeg-cancelled', t('operationCancelled'));
      }

      // 用户确认覆盖，注入 -y 跳过 FFmpeg 自身的交互提示
      args = ['-y', ...args];
    }

    this.run(args, event, outputFile);
  }

  /**
   * 优雅停止：向 stdin 写 `q`，超时后强杀。
   *
   * 用 `isStopping` 标记必须在写 `q` / kill **之前**设置，
   * 防止 `error` 事件在 `close` 之前触发并调用 `teardown(false)`
   * 将标记提前清除，导致 `close` 回调误报错误。
   */
  stop(): void {
    if (!this.state) {
      console.warn('No FFmpeg process to stop.');
      return;
    }

    // 先标记，再操作进程——顺序不可颠倒
    this.state.isStopping = true;

    const { process: proc } = this.state;
    try {
      if (proc.stdin.writable) {
        proc.stdin.write('q\n');
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      proc.kill('SIGTERM');
    }

    this.scheduleForceKill(5_000);
  }

  /**
   * 检查 FFmpeg 可执行文件是否存在且可执行。
   */
  async checkExists(): Promise<boolean> {
    try {
      await fs.promises.access(
        getFfmpegPath(),
        fs.constants.F_OK | fs.constants.X_OK,
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 应用退出时强制清理，不依赖 IPC 回调。
   */
  cleanup(): void {
    if (!this.state) return;
    this.state.isStopping = true;
    try {
      this.state.process.kill('SIGTERM');
      this.scheduleForceKill(2_000);
    } catch (error) {
      console.error('Error cleaning up FFmpeg process:', error);
      this.teardown();
    }
  }

  isRunning(): boolean {
    return this.state !== null;
  }

  // ——— 内部实现 ———

  private run(args: string[], event: IpcMainEvent, outputFile?: string): void {
    const proc = spawn(getFfmpegPath(), args, {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.state = {
      process: proc,
      isStopping: false,
      hasReportedDuration: false,
      forceKillTimer: null,
      stdout: new LineBuffer(),
      stderr: new LineBuffer(),
    };

    proc.stdout.on('data', (data: Buffer) => {
      this.sendLines(this.state!.stdout.push(data.toString()), event);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      this.sendLines(this.state!.stderr.push(chunk), event);
      this.tryReportDuration(chunk, event);
      this.tryReportProgress(chunk, event);
    });

    proc.on('close', (code) => this.handleClose(code, event, outputFile));

    proc.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      // 仅在非用户主动停止时上报错误；若用户已停止，等待 close 事件统一处理
      if (!this.state?.isStopping) {
        safeReply(
          event,
          'ffmpeg-error',
          `FFmpeg process error: ${err.message}`,
        );
        this.teardown();
      }
    });
  }

  private handleClose(
    code: number | null,
    event: IpcMainEvent,
    outputFile?: string,
  ): void {
    // 刷出缓冲区残余行
    if (this.state) {
      this.sendLines(this.state.stdout.flush(), event);
      this.sendLines(this.state.stderr.flush(), event);
    }

    const stoppedByUser = this.state?.isStopping ?? false;
    this.teardown();

    if (stoppedByUser) {
      safeReply(event, 'ffmpeg-cancelled', 'FFmpeg process stopped.');
      return;
    }

    if (code === 0) {
      safeReply(event, 'ffmpeg-complete');
      if (outputFile) this.notifyCompletion(outputFile);
      return;
    }

    safeReply(
      event,
      'ffmpeg-error',
      `FFmpeg process exited with code ${code}.`,
    );
  }

  private sendLines(lines: string[], event: IpcMainEvent): void {
    for (const line of lines) {
      safeReply(event, 'ffmpeg-output', line);
    }
  }

  private tryReportProgress(chunk: string, event: IpcMainEvent): void {
    // 重置 lastIndex，确保每次从头匹配
    RE_PROGRESS.lastIndex = 0;
    let match: RegExpExecArray | null;
    let last: RegExpExecArray | null = null;
    while ((match = RE_PROGRESS.exec(chunk)) !== null) last = match;
    if (!last) return;

    const [, h, m, s] = last;
    const time = this.toSeconds(h, m, s);
    if (Number.isFinite(time)) {
      safeReply(event, 'ffmpeg-progress', { time } satisfies FFmpegProgress);
    }
  }

  private tryReportDuration(chunk: string, event: IpcMainEvent): void {
    if (!this.state || this.state.hasReportedDuration) return;
    const match = RE_DURATION.exec(chunk);
    if (!match) return;

    const [, h, m, s] = match;
    const duration = this.toSeconds(h, m, s);
    if (!Number.isFinite(duration)) return;

    this.state.hasReportedDuration = true;
    safeReply(event, 'ffmpeg-duration', { duration } satisfies FFmpegDuration);
  }

  private notifyCompletion(outputFile: string): void {
    if (!Notification.isSupported()) return;

    const resolved = path.resolve(outputFile);
    const notification = new Notification({
      title: 'FFmpeg Process Complete',
      body: 'The FFmpeg process has completed successfully.',
      silent: false,
      sound: process.platform === 'darwin' ? 'Ping' : undefined,
    });

    notification.on('click', () => shell.showItemInFolder(resolved));

    try {
      notification.show();
    } catch (error) {
      console.warn('Failed to show completion notification:', error);
    }
  }

  /**
   * 强杀定时器：延迟后若进程仍在，发送 SIGKILL。
   * 捕获 state 快照而非依赖 `this.state`，避免定时器触发时状态已被清除。
   */
  private scheduleForceKill(delayMs: number): void {
    if (!this.state) return;

    // 清除旧定时器，避免重复调度
    if (this.state.forceKillTimer) {
      clearTimeout(this.state.forceKillTimer);
    }

    const proc = this.state.process;
    this.state.forceKillTimer = setTimeout(() => {
      if (!proc.killed) {
        console.warn('FFmpeg did not exit gracefully, force killing…');
        proc.kill('SIGKILL');
      }
    }, delayMs);
  }

  /**
   * 清除所有运行时状态，释放资源。
   */
  private teardown(): void {
    if (!this.state) return;
    if (this.state.forceKillTimer) {
      clearTimeout(this.state.forceKillTimer);
    }
    this.state = null;
  }

  /**
   * 将时:分:秒字符串转换为秒数。
   * 任一字段解析失败时返回 NaN，调用方负责校验。
   */
  private toSeconds(h: string, m: string, s: string): number {
    const hours = parseInt(h, 10);
    const minutes = parseInt(m, 10);
    const seconds = parseFloat(s);
    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      !Number.isFinite(seconds)
    ) {
      return NaN;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }
}

export const ffmpegService = new FFmpegService();
