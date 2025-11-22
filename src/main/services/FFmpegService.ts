/**
 * FFmpeg 进程管理服务
 * 单例模式管理 FFmpeg 进程的生命周期
 */

import { ChildProcess, spawn } from 'child_process';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { dialog, Notification, shell } from 'electron';
import fs from 'fs';
import { parseFFmpegCommand } from '../utils/commandParser';
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

/**
 * FFmpeg 进程管理服务类
 */
class FFmpegService {
  private process: ChildProcess | null = null;

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
    // 检查命令是否为空
    if (!command) {
      event.reply(
        'ffmpeg-error',
        'Empty command. Please provide a valid FFmpeg command.',
      );
      return;
    }

    const args = parseFFmpegCommand(command);

    // 查找输出文件
    let outputFile: string | undefined;
    for (let i = args.length - 1; i >= 0; i--) {
      if (!args[i].startsWith('-') && i > 0 && args[i - 1] !== '-i') {
        outputFile = args[i].replace(/^"|"$/g, '').trim();
        break;
      }
    }

    // 检查文件是否存在
    if (outputFile && fs.existsSync(outputFile)) {
      const response = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm Overwrite',
        message: `File '${outputFile}' already exists. Overwrite?`,
      });

      if (response.response === 1) {
        event.reply(
          'ffmpeg-error',
          'Operation cancelled: File not overwritten.',
        );
        return;
      }

      // 用户选择 Yes，添加 -y 参数
      args.unshift('-y');
    }

    this.run(args, event, outputFile);
  }

  /**
   * 运行 FFmpeg 命令
   */
  private run(args: string[], event: IpcMainEvent, outputFile?: string): void {
    const ffmpegPath = `"${getFfmpegPath()}"`;
    const fullCommand = `${ffmpegPath} ${args.join(' ')}`;

    this.process = spawn(fullCommand, [], { shell: true });

    this.process.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        event.reply('ffmpeg-output', output);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      output.split('\n').forEach((line: string) => {
        if (line.trim()) {
          event.reply('ffmpeg-output', line);
        }
      });

      // 解析进度信息
      this.parseProgress(output, event);

      // 解析时长信息
      this.parseDuration(output, event);
    });

    this.process.on('close', (code) => {
      console.log('FFmpeg process closed with code:', code);
      if (code === 0) {
        event.reply('ffmpeg-complete');

        if (outputFile) {
          this.showCompletionNotification(outputFile);
        }
      } else {
        event.reply('ffmpeg-error', `FFmpeg process exited with code ${code}`);
      }

      this.process = null;
    });

    this.process.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      event.reply('ffmpeg-error', `FFmpeg process error: ${err.message}`);
      this.process = null;
    });
  }

  /**
   * 解析进度信息
   */
  private parseProgress(output: string, event: IpcMainEvent): void {
    const progressMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (progressMatch) {
      const [, hours, minutes, seconds] = progressMatch;
      const currentTime =
        parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
      const progress: FFmpegProgress = { time: currentTime };
      event.reply('ffmpeg-progress', progress);
    }
  }

  /**
   * 解析时长信息
   */
  private parseDuration(output: string, event: IpcMainEvent): void {
    const durationMatch = output.match(
      /Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/,
    );
    if (durationMatch) {
      const [, hours, minutes, seconds] = durationMatch;
      const totalDuration =
        parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
      const duration: FFmpegDuration = { duration: totalDuration };
      event.reply('ffmpeg-duration', duration);
    }
  }

  /**
   * 显示完成通知
   */
  private showCompletionNotification(outputFile: string): void {
    const notification = new Notification({
      title: 'FFmpeg Process Complete',
      body: 'The FFmpeg process has completed successfully.',
      silent: false,
      sound: process.platform === 'darwin' ? 'Ping' : undefined,
    });

    notification.on('click', () => {
      shell.showItemInFolder(outputFile);
    });

    notification.show();
  }

  /**
   * 停止 FFmpeg 进程
   */
  stop(): void {
    if (this.process && this.process.stdin) {
      this.process.stdin.write('q');

      // 设置超时，5秒后强制终止
      setTimeout(() => {
        if (this.process) {
          console.warn('FFmpeg did not exit gracefully, force killing...');
          this.process.kill('SIGKILL');
        }
      }, 5000);
    } else {
      console.warn('No FFmpeg process to stop or stdin is not available');
    }
  }

  /**
   * 检查 FFmpeg 是否存在
   */
  async checkExists(): Promise<boolean> {
    const ffmpegPath = getFfmpegPath();
    try {
      await fs.promises.access(ffmpegPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清理进程
   */
  cleanup(): void {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
        this.process = null;
        console.log('FFmpeg process cleaned up');
      } catch (error) {
        console.error('Error cleaning up FFmpeg process:', error);
      }
    }
  }
}

// 导出单例
export const ffmpegService = new FFmpegService();
