/**
 * 终端服务
 * 跨平台的终端打开和管理
 */

import { ChildProcess, exec, spawn } from 'child_process';
import type { BrowserWindow } from 'electron';
import path from 'path';
import { getFfmpegPath } from '../utils/pathUtils';

/**
 * 终端服务类
 */
class TerminalService {
  private process: ChildProcess | null = null;

  private windowId: string | null = null;

  private isStarted: boolean = false;

  /**
   * 打开终端
   *
   * @param mainWindow 主窗口引用（用于失败时重新聚焦）
   */
  async open(mainWindow: BrowserWindow | null): Promise<boolean> {
    const dirPath = path.dirname(getFfmpegPath());

    try {
      switch (process.platform) {
        case 'darwin':
          await this.openMacTerminal(dirPath);
          break;
        case 'win32':
          await this.openWindowsTerminal(dirPath);
          break;
        default:
          await this.openLinuxTerminal(dirPath);
          break;
      }

      this.setupEventHandlers(mainWindow);
      return true;
    } catch (error) {
      console.error('Failed to open terminal:', error);
      return false;
    }
  }

  /**
   * 打开 macOS 终端
   */
  private openMacTerminal(dirPath: string): void {
    const escapedPath = dirPath.replace(/"/g, '\\"');
    const ffmpegCommand = `clear && cd '${escapedPath}' && ./ffmpeg -version`;

    const script = `
      tell application "Terminal"
        if not running then
          activate
          delay 1
          set currentWindow to window 1
          do script "${ffmpegCommand}" in currentWindow
          set windowId to id of currentWindow
          return windowId
        else
          if "${this.windowId}" is not "" then
            try
              do script "${ffmpegCommand}" in window id ${this.windowId}
              return "${this.windowId}"
            on error
              set newWindow to do script "${ffmpegCommand}"
              set windowId to id of window 1
              return windowId
            end try
          else
            set newWindow to do script "${ffmpegCommand}"
            set windowId to id of window 1
            return windowId
          end if
        end if
        activate
      end tell`;

    this.process = spawn('osascript', ['-e', script]);

    // 捕获窗口 ID
    this.process.stdout?.on('data', (outputData) => {
      const windowId = outputData.toString().trim();
      if (windowId && !Number.isNaN(Number(windowId))) {
        this.windowId = windowId;
        console.log('Terminal window ID:', this.windowId);
      }
    });

    this.process.stderr?.on('data', (errorData) => {
      console.error('AppleScript stderr:', errorData.toString());
    });
  }

  /**
   * 打开 Windows 终端
   */
  private openWindowsTerminal(dirPath: string): void {
    if (this.isStarted) {
      console.log('Terminal process already running');
      return;
    }

    this.isStarted = true;
    const ffmpegExe = getFfmpegPath();

    const monitorProcess = spawn(
      'cmd.exe',
      [
        '/c',
        'start',
        '/wait',
        'cmd.exe',
        '/F:ON',
        '/V:ON',
        '/k',
        `"${ffmpegExe}" -version`,
      ],
      {
        shell: true,
        cwd: dirPath,
        windowsVerbatimArguments: true,
        env: {
          ...process.env,
          PATH: `${dirPath}${path.delimiter}${process.env.PATH || ''}`,
        },
      },
    );

    monitorProcess.on('exit', (code) => {
      console.log(
        'Terminal window closed, monitor process exited with code:',
        code,
      );
      this.isStarted = false;
      this.process = null;
    });

    monitorProcess.on('error', (error: Error) => {
      console.error('Monitor process error:', error);
      this.isStarted = false;
      this.process = null;
    });

    this.process = monitorProcess;
  }

  /**
   * 打开 Linux 终端
   */
  private openLinuxTerminal(dirPath: string): void {
    const terminals = [
      [
        'gnome-terminal',
        [
          '--working-directory',
          dirPath,
          '--',
          'bash',
          '-c',
          'ffmpeg -version; echo "\\nCurrent directory: $(pwd)"; exec bash',
        ],
      ],
      [
        'konsole',
        [
          '--workdir',
          dirPath,
          '-e',
          'bash',
          '-c',
          'ffmpeg -version; echo "\\nCurrent directory: $(pwd)"; exec bash',
        ],
      ],
      [
        'xterm',
        [
          '-e',
          `cd "${dirPath}" && ffmpeg -version && echo "\\nCurrent directory: $(pwd)" && exec bash`,
        ],
      ],
    ];

    const success = terminals.some(([terminal, args]) => {
      try {
        this.process = spawn(terminal as string, args as string[], {
          stdio: 'inherit',
          detached: true,
        });
        this.isStarted = true;
        console.log(`Linux terminal (${terminal}) spawn successful`);
        return true;
      } catch (error) {
        console.error(`Failed to open ${terminal}:`, error);
        return false;
      }
    });

    if (!success) {
      throw new Error('Failed to start any Linux terminal');
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(mainWindow: BrowserWindow | null): void {
    if (!this.process || !this.isStarted) {
      return;
    }

    if (mainWindow) {
      mainWindow.setAlwaysOnTop(false);
    }

    this.process.on('exit', () => {
      console.log('Terminal process exited');
      if (mainWindow) {
        mainWindow.focus();
      }
      this.process = null;
      this.isStarted = false;
    });

    this.process.on('error', (error) => {
      console.error('Terminal process error:', error);
      if (mainWindow) {
        mainWindow.focus();
      }
      this.process = null;
      this.isStarted = false;
      this.windowId = null;
    });

    // Windows 平台特殊处理
    if (process.platform === 'win32') {
      this.process.unref();
    }
  }

  /**
   * 清理终端进程
   */
  cleanup(): void {
    if (this.process) {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${this.process.pid} /T /F`);
        } else {
          this.process.kill('SIGTERM');
        }
        this.process = null;
        this.windowId = null;
        this.isStarted = false;
        console.log('Terminal process cleaned up');
      } catch (error) {
        console.error('Error cleaning up terminal process:', error);
      }
    }
  }
}

// 导出单例
export const terminalService = new TerminalService();
