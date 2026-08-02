/**
 * Electron 端 FFmpeg 控制器
 * - 负责命令解析/校验/覆盖确认/完成通知等 Electron UI 逻辑
 * - 使用 FFmpegProcessManager 做纯进程管理
 * - start() 通过 startingPromise 互斥，防止连点竞态重复启动
 */

import {
  dialog,
  Notification,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import fs from 'fs';
import path from 'path';
import type { IpcResult } from '../../shared/ipc';
import {
  containsUnsupportedShellOperators,
  deriveWorkingDirectory,
  extractOutputFile,
  parseFFmpegCommand,
  splitCommandChain,
} from '../utils/commandParser';
import { safeReply } from '../utils/ipcUtils';
import { resolveFfmpegPath } from '../utils/pathUtils';
import { t } from '../locales';
import {
  FFmpegProcessManager,
  type FFmpegProcessCallbacks,
} from './FFmpegProcessManager';

type FFmpegProgress = { time: number };
type FFmpegDuration = { duration: number };
type FFmpegCompletePayload = { outputFile: string | null };
type FFmpegChainSegmentPayload = { segment: number; total: number };

function resolveOutputFilePath(
  outputFile: string | undefined,
  workingDirectory: string | undefined,
): string | undefined {
  if (!outputFile) return undefined;
  if (path.isAbsolute(outputFile)) return outputFile;
  return path.resolve(workingDirectory ?? process.cwd(), outputFile);
}

/**
 * 将 ffmpeg 参数数组格式化为可粘贴的 shell 命令字符串。
 * 仅用于终端回显——展示实际执行的命令（含 GUI 注入的 -hide_banner / -y），
 * 让用户看到 ffmpeg 真正接收到的参数，消除“命令没生效”的疑虑。
 * 按 shell 规则对含空白或元字符的参数加引号。
 */
function formatCommandForDisplay(args: string[]): string {
  const quote = (s: string): string => {
    if (s === '') return '""';
    if (!/^[A-Za-z0-9_.,:@/+=\-]+$/.test(s)) {
      return `"${s.replace(/(["\\])/g, '\\$1')}"`;
    }
    return s;
  };
  return ['ffmpeg', ...args].map(quote).join(' ');
}

class FFmpegController {
  private manager = new FFmpegProcessManager();

  /**
   * 进行中的启动互斥锁。
   *
   * `manager.start` 是同步 spawn，但 spawn 完成到 isRunning() 返回 true 之间
   * 仍存在窗口；多渲染层连点 start 时，第二个调用可能赶在 state 建好前通过 isRunning 检查。
   * 用 Promise 锁串行化 start，做纵深防御。
   */
  private startingPromise: Promise<IpcResult> | null = null;

  async start(
    command: string,
    event: IpcMainEvent | IpcMainInvokeEvent,
    mainWindow: BrowserWindow | null,
  ): Promise<IpcResult> {
    // IpcMainInvokeEvent / IpcMainEvent 在运行时都具备 sender + reply
    // 当前安全回复逻辑以 IpcMainEvent 类型断言消除类型不一致问题
    const ipcEvent = event as IpcMainEvent;

    // 互斥：启动进行中时直接拒绝第二次请求
    if (this.startingPromise) {
      const error = 'An FFmpeg process is already starting.';
      safeReply(ipcEvent, 'ffmpeg-error', error);
      return { success: false, error };
    }

    const run = async (): Promise<IpcResult> => {
      if (this.manager.isRunning()) {
        const error =
          'An FFmpeg process is already running. Please stop it first.';
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return { success: false, error };
      }

      const trimmed = command?.trim();
      if (!trimmed) {
        const error = 'Empty command. Please provide a valid FFmpeg command.';
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return { success: false, error };
      }

      let args: string[];
      try {
        args = parseFFmpegCommand(trimmed);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to parse command.';
        safeReply(ipcEvent, 'ffmpeg-error', message);
        return { success: false, error: message };
      }

      if (args.length === 0) {
        const error =
          'Command has no arguments. Please provide a valid FFmpeg command.';
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return { success: false, error };
      }

      if (containsUnsupportedShellOperators(args)) {
        const error =
          'Unsupported shell operator. Only && chaining is allowed (no |, ;, ||, or redirects).';
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return { success: false, error };
      }

      // 按 && 拆链：单段 = 原逻辑；多段 = 逐段顺序执行
      const segments = splitCommandChain(args);
      if (segments.length === 0) {
        const error =
          'Command has no arguments. Please provide a valid FFmpeg command.';
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return { success: false, error };
      }

      // 启动首段；后续段由 onComplete 回调串行推进（见 launchSegment）。
      // fire-and-forget：不阻塞 start() 返回，异常转发为错误事件。
      this.launchSegment(segments, 0, ipcEvent, mainWindow).catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Failed to start FFmpeg.';
        safeReply(ipcEvent, 'ffmpeg-error', message);
      });
      return { success: true };
    }; // end of run()

    // 用 Promise 锁串行化：run 完成或抛错后清空 startingPromise
    this.startingPromise = run();
    try {
      return await this.startingPromise;
    } finally {
      this.startingPromise = null;
    }
  }

  /**
   * 启动命令链的第 index 段（含参数注入、覆盖确认、spawn 与回调转发）。
   *
   * 段完成（exit 0）后若还有后续段则递归启动下一段；全部完成才上报
   * `ffmpeg-complete`。任一段失败/取消即中止整链（不启动后续段）。
   *
   * @param segments 链的所有参数段
   * @param index     当前要启动的段索引（0-based）
   */
  private async launchSegment(
    segments: string[][],
    index: number,
    ipcEvent: IpcMainEvent,
    mainWindow: BrowserWindow | null,
  ): Promise<void> {
    const args = segments[index];

    const outputFile = await extractOutputFile(args);
    await this.launchSegmentPrepared(
      args,
      outputFile,
      index,
      segments,
      ipcEvent,
      mainWindow,
    );
  }

  /**
   * 覆盖确认 + 参数注入 + spawn 一段命令。
   * 与 launchSegment 分离以便异步等待 extractOutputFile。
   */
  private async launchSegmentPrepared(
    args: string[],
    outputFile: string | undefined,
    index: number,
    segments: string[][],
    ipcEvent: IpcMainEvent,
    mainWindow: BrowserWindow | null,
  ): Promise<void> {
    const total = segments.length;
    const ctx = { segment: index + 1, total };
    const workingDirectory = deriveWorkingDirectory(args);
    const resolvedOutputFile = resolveOutputFilePath(
      outputFile,
      workingDirectory,
    );

    if (resolvedOutputFile && fs.existsSync(resolvedOutputFile)) {
      if (!mainWindow) {
        const error = t('cannotConfirmOverwrite');
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return;
      }

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: [t('yes'), t('no')],
        defaultId: 1,
        cancelId: 1,
        title: t('confirmOverwrite'),
        message: t('fileAlreadyExists', {
          filename: resolvedOutputFile,
        }),
      });

      if (response === 1) {
        const message = t('operationCancelled');
        safeReply(ipcEvent, 'ffmpeg-cancelled', message);
        return;
      }
      // 用户已确认覆盖；-y 在下方统一注入
    }

    // 无条件注入 -y：本进程 stdin 为管道（非 TTY），ffmpeg 遇已存在输出
    // 文件时不会交互提示，而是直接报错退出。GUI 覆盖对话框只覆盖我们能
    // 识别到的输出；此处无条件注入作为兜底。若用户已写 -y/-n 则尊重。
    const preparedArgs = [...args];
    if (!preparedArgs.includes('-y') && !preparedArgs.includes('-n')) {
      preparedArgs.unshift('-y');
    }
    if (!preparedArgs.includes('-hide_banner')) {
      preparedArgs.unshift('-hide_banner');
    }
    if (!preparedArgs.includes('-nostdin')) {
      preparedArgs.unshift('-nostdin');
    }
    if (!preparedArgs.includes('-stats_period')) {
      preparedArgs.unshift('-stats_period', '0.5');
    }
    if (!preparedArgs.includes('-progress')) {
      preparedArgs.unshift('-progress', 'pipe:1');
    }

    // 广播段切换（单段 total=1 也广播，UI 进度条据此重置）
    safeReply(ipcEvent, 'ffmpeg-chain-segment', {
      segment: ctx.segment,
      total: ctx.total,
    } satisfies FFmpegChainSegmentPayload);

    const callbacks: FFmpegProcessCallbacks = {
      onOutput: (line) => safeReply(ipcEvent, 'ffmpeg-output', line),
      onProgress: (time) =>
        safeReply(ipcEvent, 'ffmpeg-progress', {
          time,
        } satisfies FFmpegProgress),
      onDuration: (duration) =>
        safeReply(ipcEvent, 'ffmpeg-duration', {
          duration,
        } satisfies FFmpegDuration),
      onCancelled: () =>
        safeReply(ipcEvent, 'ffmpeg-cancelled', 'FFmpeg process stopped.'),
      onComplete: (completedOutputFile) => {
        const file = completedOutputFile ?? resolvedOutputFile;
        const nextIndex = index + 1;

        // 链模式：还有后续段则继续；否则整链完成
        if (segments.length > 1 && nextIndex < segments.length) {
          safeReply(
            ipcEvent,
            'ffmpeg-output',
            `[chain] segment ${ctx.segment}/${ctx.total} done → starting next`,
          );
          this.launchSegment(segments, nextIndex, ipcEvent, mainWindow);
          return;
        }

        safeReply(ipcEvent, 'ffmpeg-complete', {
          outputFile: file ?? null,
        } satisfies FFmpegCompletePayload);
        if (file) this.notifyCompletion(file);
      },
      onError: (message) => safeReply(ipcEvent, 'ffmpeg-error', message),
      onStalled: (stalledForMs) =>
        safeReply(ipcEvent, 'ffmpeg-stalled', {
          stalledForMs,
        }),
    };

    const ffmpegPath = await resolveFfmpegPath();
    if (!ffmpegPath) {
      const error =
        'FFmpeg is not available. Install it on your system or use the built-in downloader.';
      safeReply(ipcEvent, 'ffmpeg-error', error);
      return;
    }

    // 在 spawn 前向终端回显实际执行的命令（含 GUI 注入参数），让用户看到
    // ffmpeg 真正接收到的参数，消除“命令没生效”的疑虑。
    safeReply(
      ipcEvent,
      'ffmpeg-output',
      `$ ${formatCommandForDisplay(preparedArgs)}`,
    );

    this.manager.start(
      ffmpegPath,
      preparedArgs,
      callbacks,
      resolvedOutputFile,
      workingDirectory && fs.existsSync(workingDirectory)
        ? workingDirectory
        : undefined,
    );
  }

  stop(): boolean {
    return this.manager.stop();
  }

  /**
   * 卡死提示后用户选择"继续等待"：重置卡死检测计时器，继续监测。
   */
  resume(): IpcResult {
    if (!this.manager.isRunning()) {
      return { success: false, error: 'No FFmpeg process is running.' };
    }
    this.manager.resumeAfterStall();
    return { success: true };
  }

  cleanup(): void {
    this.manager.cleanup();
  }

  /**
   * 等待当前 FFmpeg 进程真正退出，供应用退出路径使用。
   * 详见 FFmpegProcessManager.waitForExit。
   */
  async waitForExit(timeoutMs?: number): Promise<void> {
    return this.manager.waitForExit(timeoutMs);
  }

  isRunning(): boolean {
    return this.manager.isRunning();
  }

  async checkExists(): Promise<boolean> {
    return (await resolveFfmpegPath()) !== null;
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
}

export const ffmpegService = new FFmpegController();
