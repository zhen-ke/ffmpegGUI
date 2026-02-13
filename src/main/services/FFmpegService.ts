/**
 * FFmpeg 进程管理服务
 * 单例模式管理 FFmpeg 进程的生命周期
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
import { getFfmpegPath } from '../utils/pathUtils';

/**
 * FFmpeg 进度数据
 */
interface FFmpegProgress {
  time: number;
}

/**
 * FFmpeg 时长数据
 */
interface FFmpegDuration {
  duration: number;
}

type FFmpegReplyChannel =
  | 'ffmpeg-output'
  | 'ffmpeg-error'
  | 'ffmpeg-progress'
  | 'ffmpeg-duration'
  | 'ffmpeg-complete'
  | 'ffmpeg-cancelled';

/**
 * FFmpeg 进程管理服务类
 */
class FFmpegService {
  private process: ChildProcessWithoutNullStreams | null = null;

  private isStopping: boolean = false;

  private stopTimer: NodeJS.Timeout | null = null;

  private stdoutBuffer: string = '';

  private stderrBuffer: string = '';

  private hasReportedDuration: boolean = false;

  private reply(
    event: IpcMainEvent,
    channel: FFmpegReplyChannel,
    payload?: unknown,
  ): void {
    try {
      if (event.sender.isDestroyed()) {
        return;
      }

      if (payload === undefined) {
        event.reply(channel);
      } else {
        event.reply(channel, payload);
      }
    } catch (error) {
      console.warn('Failed to send IPC message:', error);
    }
  }

  /**
   * 启动 FFmpeg 进程
   *
   * @param command FFmpeg 命令
   * @param event IPC 事件对象
   * @param mainWindow 主窗口引用
   */
  async start(
    command: string,
    event: IpcMainEvent,
    mainWindow: BrowserWindow | null,
  ): Promise<void> {
    if (this.process) {
      this.reply(
        event,
        'ffmpeg-error',
        'An FFmpeg process is already running. Please stop it first.',
      );
      return;
    }

    // 检查命令是否为空
    const trimmedCommand = command?.trim();
    if (!trimmedCommand) {
      this.reply(
        event,
        'ffmpeg-error',
        'Empty command. Please provide a valid FFmpeg command.',
      );
      return;
    }

    let args: string[];
    try {
      args = parseFFmpegCommand(trimmedCommand);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to parse command.';
      this.reply(event, 'ffmpeg-error', message);
      return;
    }

    if (args.length === 0) {
      this.reply(
        event,
        'ffmpeg-error',
        'Command has no arguments. Please provide a valid FFmpeg command.',
      );
      return;
    }

    if (containsUnsupportedShellOperators(args)) {
      this.reply(
        event,
        'ffmpeg-error',
        'Only a single FFmpeg command is supported. Remove shell operators such as &&, ||, |, or redirects.',
      );
      return;
    }

    const outputFile = extractOutputFile(args);

    // 检查文件是否存在
    if (outputFile && fs.existsSync(outputFile)) {
      if (!mainWindow) {
        this.reply(
          event,
          'ffmpeg-error',
          'Cannot confirm overwrite because the main window is unavailable.',
        );
        return;
      }

      const response = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        cancelId: 1,
        title: 'Confirm Overwrite',
        message: `File '${outputFile}' already exists. Overwrite?`,
      });

      if (response.response === 1) {
        this.reply(
          event,
          'ffmpeg-cancelled',
          'Operation cancelled: file was not overwritten.',
        );
        return;
      }

      // 用户选择 Yes，添加 -y 参数
      args = ['-y', ...args];
    }

    this.run(args, event, outputFile);
  }

  /**
   * 运行 FFmpeg 命令
   */
  private run(args: string[], event: IpcMainEvent, outputFile?: string): void {
    const ffmpegPath = getFfmpegPath();

    this.isStopping = false;
    this.hasReportedDuration = false;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.clearStopTimer();

    this.process = spawn(ffmpegPath, args, {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout.on('data', (data: Buffer) => {
      this.appendOutput(data.toString(), 'stdout', event);
    });

    this.process.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      this.appendOutput(output, 'stderr', event);
      this.parseDuration(output, event);
      this.parseProgress(output, event);
    });

    this.process.on('close', (code) => {
      this.flushBufferedOutput(event);
      const stoppedByUser = this.isStopping;
      console.log('FFmpeg process closed with code:', code, {
        stoppedByUser,
      });

      this.resetState();

      if (stoppedByUser) {
        this.reply(event, 'ffmpeg-cancelled', 'FFmpeg process stopped.');
        return;
      }

      if (code === 0) {
        this.reply(event, 'ffmpeg-complete');
        if (outputFile) {
          this.showCompletionNotification(outputFile);
        }
        return;
      }

      this.reply(event, 'ffmpeg-error', `FFmpeg process exited with code ${code}`);
    });

    this.process.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      this.reply(event, 'ffmpeg-error', `FFmpeg process error: ${err.message}`);
      this.resetState();
    });
  }

  /**
   * 解析进度信息
   */
  private parseProgress(output: string, event: IpcMainEvent): void {
    const matches = Array.from(
      output.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g),
    );
    if (matches.length > 0) {
      const progressMatch = matches[matches.length - 1];
      const [, hours, minutes, seconds] = progressMatch;
      const currentTime = this.toSeconds(hours, minutes, seconds);
      const progress: FFmpegProgress = { time: currentTime };
      this.reply(event, 'ffmpeg-progress', progress);
    }
  }

  /**
   * 解析时长信息
   */
  private parseDuration(output: string, event: IpcMainEvent): void {
    if (this.hasReportedDuration) {
      return;
    }

    const durationMatch = output.match(
      /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/,
    );
    if (durationMatch) {
      const [, hours, minutes, seconds] = durationMatch;
      const totalDuration = this.toSeconds(hours, minutes, seconds);
      const duration: FFmpegDuration = { duration: totalDuration };
      this.reply(event, 'ffmpeg-duration', duration);
      this.hasReportedDuration = true;
    }
  }

  /**
   * 显示完成通知
   */
  private showCompletionNotification(outputFile: string): void {
    if (!Notification.isSupported()) {
      return;
    }

    const resolvedOutput = path.resolve(outputFile);

    const notification = new Notification({
      title: 'FFmpeg Process Complete',
      body: 'The FFmpeg process has completed successfully.',
      silent: false,
      sound: process.platform === 'darwin' ? 'Ping' : undefined,
    });

    notification.on('click', () => {
      shell.showItemInFolder(resolvedOutput);
    });

    try {
      notification.show();
    } catch (error) {
      console.warn('Failed to show completion notification:', error);
    }
  }

  /**
   * 停止 FFmpeg 进程
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
    } catch (error) {
      console.warn('Failed to request graceful FFmpeg shutdown:', error);
      this.process.kill('SIGTERM');
    }

    this.clearStopTimer();
    this.stopTimer = setTimeout(() => {
      if (this.process) {
        console.warn('FFmpeg did not exit gracefully, force killing...');
        this.process.kill('SIGKILL');
      }
    }, 5000);

    return true;
  }

  /**
   * 检查 FFmpeg 是否存在
   */
  async checkExists(): Promise<boolean> {
    const ffmpegPath = getFfmpegPath();
    try {
      await fs.promises.access(ffmpegPath, fs.constants.F_OK | fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清理进程
   */
  cleanup(): void {
    if (!this.process) {
      return;
    }

    this.isStopping = true;

    try {
      this.process.kill('SIGTERM');
      this.clearStopTimer();
      this.stopTimer = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 2000);
      console.log('FFmpeg process cleanup requested');
    } catch (error) {
      console.error('Error cleaning up FFmpeg process:', error);
      this.resetState();
    }
  }

  private toSeconds(hours: string, minutes: string, seconds: string): number {
    return (
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseFloat(seconds)
    );
  }

  private appendOutput(
    chunk: string,
    stream: 'stdout' | 'stderr',
    event: IpcMainEvent,
  ): void {
    const currentBuffer = stream === 'stdout' ? this.stdoutBuffer : this.stderrBuffer;
    const lines = (currentBuffer + chunk).split(/\r?\n|\r/);
    const incompleteLine = lines.pop() ?? '';

    if (stream === 'stdout') {
      this.stdoutBuffer = incompleteLine;
    } else {
      this.stderrBuffer = incompleteLine;
    }

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        this.reply(event, 'ffmpeg-output', trimmedLine);
      }
    });
  }

  private flushBufferedOutput(event: IpcMainEvent): void {
    const trailingLines = [this.stdoutBuffer, this.stderrBuffer];
    trailingLines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        this.reply(event, 'ffmpeg-output', trimmedLine);
      }
    });
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
  }

  private clearStopTimer(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private resetState(): void {
    this.clearStopTimer();
    this.process = null;
    this.isStopping = false;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.hasReportedDuration = false;
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}

// 导出单例
export const ffmpegService = new FFmpegService();
