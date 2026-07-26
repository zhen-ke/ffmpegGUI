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
          'Only a single FFmpeg command is supported. Remove shell operators such as &&, ||, |, or redirects.';
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return { success: false, error };
      }

      const outputFile = extractOutputFile(args);
      const workingDirectory = deriveWorkingDirectory(args);
      const resolvedOutputFile = resolveOutputFilePath(
        outputFile,
        workingDirectory,
      );

      if (resolvedOutputFile && fs.existsSync(resolvedOutputFile)) {
        if (!mainWindow) {
          const error = t('cannotConfirmOverwrite');
          safeReply(ipcEvent, 'ffmpeg-error', error);
          return { success: false, error };
        }

        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: [t('yes'), t('no')],
          defaultId: 1,
          cancelId: 1,
          title: t('confirmOverwrite'),
          message: t('fileAlreadyExists', { filename: resolvedOutputFile }),
        });

        if (response === 1) {
          const message = t('operationCancelled');
          safeReply(ipcEvent, 'ffmpeg-cancelled', message);
          return { success: false, error: message };
        }
        // 用户已确认覆盖；-y 在下方统一注入
      }

      // 无条件注入 -y：
      // 本进程 stdin 为管道（非 TTY），ffmpeg 遇已存在输出文件时不会交互
      // 提示，而是直接报错退出。GUI 的覆盖对话框只覆盖“我们能识别到的
      // 输出”，一旦 extractOutputFile 漏判（例如命令以未知取值选项结尾），
      // 就不会注入 -y，ffmpeg 仍会因文件已存在而失败。因此此处无条件注入，
      // 作为兜底；若用户已显式写 -y 或 -n，尊重其选择，不重复 / 不冲突。
      if (!args.includes('-y') && !args.includes('-n')) {
        args = ['-y', ...args];
      }

      // -hide_banner：抑制 stderr 中的构建信息 / libav 版本等多行噪声，
      // 降低 LineBuffer / 进度正则的解析压力，终端日志更干净。
      // 不影响 Duration: / time= 解析。
      if (!args.includes('-hide_banner')) {
        args = ['-hide_banner', ...args];
      }

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
          safeReply(ipcEvent, 'ffmpeg-complete', {
            outputFile: file ?? null,
          } satisfies FFmpegCompletePayload);
          if (file) this.notifyCompletion(file);
        },
        onError: (message) => safeReply(ipcEvent, 'ffmpeg-error', message),
      };

      const ffmpegPath = await resolveFfmpegPath();
      if (!ffmpegPath) {
        const error =
          'FFmpeg is not available. Install it on your system or use the built-in downloader.';
        safeReply(ipcEvent, 'ffmpeg-error', error);
        return { success: false, error };
      }

      // 在 spawn 前向终端回显实际执行的命令（含 GUI 注入的 -hide_banner / -y），
      // 让用户看到 ffmpeg 真正接收到的参数，消除“命令没生效”的疑虑。
      // 走 ffmpeg-output 通道、不经 ProcessManager 的 80ms 节流，确保首行即显示。
      safeReply(ipcEvent, 'ffmpeg-output', `$ ${formatCommandForDisplay(args)}`);

      // 进程启动是异步效果；我们不等待其完成
      this.manager.start(
        ffmpegPath,
        args,
        callbacks,
        resolvedOutputFile,
        workingDirectory && fs.existsSync(workingDirectory)
          ? workingDirectory
          : undefined,
      );
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

  stop(): boolean {
    return this.manager.stop();
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
