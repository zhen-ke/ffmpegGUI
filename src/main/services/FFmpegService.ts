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

// ========== 输出缓冲 ==========

/**
 * 行缓冲器：将流式数据拆分为完整行，尾部不完整行留存。
 */
class LineBuffer {
  private buffer = '';

  /**
   * 追加数据，返回所有完整行（不含换行符）。
   */
  push(chunk: string): string[] {
    const lines = (this.buffer + chunk).split(/\r?\n|\r/);
    this.buffer = lines.pop() ?? '';
    return lines.filter((l) => l.trim() !== '');
  }

  /**
   * 刷新残余内容，重置缓冲区。
   */
  flush(): string[] {
    const trailing = this.buffer.trim();
    this.buffer = '';
    return trailing ? [trailing] : [];
  }
}

// ========== FFmpegService ==========

class FFmpegService {
  private process: ChildProcessWithoutNullStreams | null = null;
  private isStopping = false;
  private stopTimer: NodeJS.Timeout | null = null;
  private hasReportedDuration = false;

  private readonly stdout = new LineBuffer();
  private readonly stderr = new LineBuffer();

  // ——— 公共 API ———

  /**
   * 验证并启动 FFmpeg 命令。
   * 包含前置校验、文件覆盖确认、参数注入。
   */
  async start(
    command: string,
    event: IpcMainEvent,
    mainWindow: BrowserWindow | null,
  ): Promise<void> {
    if (this.process) {
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
        return safeReply(
          event,
          'ffmpeg-error',
          'Cannot confirm overwrite because the main window is unavailable.',
        );
      }

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        cancelId: 1,
        title: 'Confirm Overwrite',
        message: `File '${outputFile}' already exists. Overwrite?`,
      });

      if (response === 1) {
        return safeReply(
          event,
          'ffmpeg-cancelled',
          'Operation cancelled: file was not overwritten.',
        );
      }

      args = ['-y', ...args];
    }

    this.run(args, event, outputFile);
  }

  /**
   * 优雅停止：先写 'q' 到 stdin，5 秒后强杀。
   */
  stop(): boolean {
    if (!this.process) {
      console.warn('No FFmpeg process to stop');
      return false;
    }

    this.isStopping = true;

    try {
      if (this.process.stdin.writable) {
        this.process.stdin.write('q\n');
      } else {
        this.process.kill('SIGTERM');
      }
    } catch {
      this.process.kill('SIGTERM');
    }

    this.scheduleForceKill(5000);
    return true;
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
   * 应用退出时强制清理。
   */
  cleanup(): void {
    if (!this.process) return;
    this.isStopping = true;
    try {
      this.process.kill('SIGTERM');
      this.scheduleForceKill(2000);
    } catch (error) {
      console.error('Error cleaning up FFmpeg process:', error);
      this.resetState();
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  // ——— 内部实现 ———

  private run(args: string[], event: IpcMainEvent, outputFile?: string): void {
    this.resetState();

    this.process = spawn(getFfmpegPath(), args, {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout.on('data', (data: Buffer) => {
      this.flushLines(this.stdout.push(data.toString()), event);
    });

    this.process.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      this.flushLines(this.stderr.push(chunk), event);
      this.tryParseDuration(chunk, event);
      this.tryParseProgress(chunk, event);
    });

    this.process.on('close', (code) => {
      // 刷新残余输出
      this.flushLines(this.stdout.flush(), event);
      this.flushLines(this.stderr.flush(), event);

      const stoppedByUser = this.isStopping;
      this.resetState();

      if (stoppedByUser) {
        return safeReply(event, 'ffmpeg-cancelled', 'FFmpeg process stopped.');
      }
      if (code === 0) {
        safeReply(event, 'ffmpeg-complete');
        if (outputFile) this.notifyCompletion(outputFile);
        return;
      }
      safeReply(
        event,
        'ffmpeg-error',
        `FFmpeg process exited with code ${code}`,
      );
    });

    this.process.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      safeReply(event, 'ffmpeg-error', `FFmpeg process error: ${err.message}`);
      this.resetState();
    });
  }

  private flushLines(lines: string[], event: IpcMainEvent): void {
    for (const line of lines) {
      safeReply(event, 'ffmpeg-output', line);
    }
  }

  private tryParseProgress(output: string, event: IpcMainEvent): void {
    const matches = [
      ...output.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g),
    ];
    if (matches.length === 0) return;
    const [, h, m, s] = matches[matches.length - 1];
    safeReply(event, 'ffmpeg-progress', {
      time: this.toSeconds(h, m, s),
    } satisfies FFmpegProgress);
  }

  private tryParseDuration(output: string, event: IpcMainEvent): void {
    if (this.hasReportedDuration) return;
    const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
    if (!match) return;
    const [, h, m, s] = match;
    safeReply(event, 'ffmpeg-duration', {
      duration: this.toSeconds(h, m, s),
    } satisfies FFmpegDuration);
    this.hasReportedDuration = true;
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

  private scheduleForceKill(delayMs: number): void {
    this.clearStopTimer();
    this.stopTimer = setTimeout(() => {
      if (this.process) {
        console.warn('FFmpeg did not exit gracefully, force killing...');
        this.process.kill('SIGKILL');
      }
    }, delayMs);
  }

  private clearStopTimer(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private toSeconds(h: string, m: string, s: string): number {
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
  }

  private resetState(): void {
    this.clearStopTimer();
    this.process = null;
    this.isStopping = false;
    this.hasReportedDuration = false;
    this.stdout.flush();
    this.stderr.flush();
  }
}

export const ffmpegService = new FFmpegService();
