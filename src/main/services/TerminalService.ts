/**
 * 终端服务
 * 跨平台终端管理（单例）
 */

import { ChildProcess, exec, spawn } from 'child_process';
import type { BrowserWindow } from 'electron';
import path from 'path';
import { getFfmpegPath } from '../utils/pathUtils';

// ========== 平台策略接口 ==========

interface TerminalStrategy {
  open(
    dirPath: string,
    ffmpegPath: string,
    windowId: string | null,
  ): ChildProcess;
}

// ========== macOS 策略 ==========

class MacTerminalStrategy implements TerminalStrategy {
  private _capturedWindowId: string | null = null;

  get capturedWindowId(): string | null {
    return this._capturedWindowId;
  }

  open(
    dirPath: string,
    _ffmpegPath: string,
    windowId: string | null,
  ): ChildProcess {
    const escapedPath = dirPath.replace(/'/g, "'\\''");
    const ffmpegCommand = `clear && cd '${escapedPath}' && ./ffmpeg -version`;
    const reuseClause = windowId
      ? `
          try
            do script "${ffmpegCommand}" in window id ${windowId}
            return ${windowId}
          on error
            set newWindow to do script "${ffmpegCommand}"
            return id of window 1
          end try`
      : `
          set newWindow to do script "${ffmpegCommand}"
          return id of window 1`;

    const script = `
      tell application "Terminal"
        if not running then
          activate
          delay 1
          do script "${ffmpegCommand}" in window 1
          return id of window 1
        else
          ${reuseClause}
        end if
        activate
      end tell`;

    const proc = spawn('osascript', ['-e', script]);

    proc.stdout?.on('data', (data: Buffer) => {
      const id = data.toString().trim();
      if (id && !Number.isNaN(Number(id))) {
        this._capturedWindowId = id;
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      console.error('AppleScript stderr:', data.toString());
    });

    return proc;
  }
}

// ========== Windows 策略 ==========

class WindowsTerminalStrategy implements TerminalStrategy {
  open(
    dirPath: string,
    ffmpegPath: string,
    _windowId: string | null,
  ): ChildProcess {
    return spawn(
      'cmd.exe',
      [
        '/c',
        'start',
        '/wait',
        'cmd.exe',
        '/F:ON',
        '/V:ON',
        '/k',
        `"${ffmpegPath}" -version`,
      ],
      {
        shell: true,
        cwd: dirPath,
        windowsVerbatimArguments: true,
        env: {
          ...process.env,
          PATH: `${dirPath}${path.delimiter}${process.env.PATH ?? ''}`,
        },
      },
    );
  }
}

// ========== Linux 策略 ==========

const LINUX_TERMINALS: ReadonlyArray<[string, (dir: string) => string[]]> = [
  [
    'gnome-terminal',
    (dir) => [
      '--working-directory',
      dir,
      '--',
      'bash',
      '-c',
      'ffmpeg -version; exec bash',
    ],
  ],
  [
    'konsole',
    (dir) => [
      '--workdir',
      dir,
      '-e',
      'bash',
      '-c',
      'ffmpeg -version; exec bash',
    ],
  ],
  ['xterm', (dir) => ['-e', `cd "${dir}" && ffmpeg -version && exec bash`]],
];

class LinuxTerminalStrategy implements TerminalStrategy {
  open(
    dirPath: string,
    _ffmpegPath: string,
    _windowId: string | null,
  ): ChildProcess {
    for (const [terminal, argsFactory] of LINUX_TERMINALS) {
      try {
        const proc = spawn(terminal, argsFactory(dirPath), {
          stdio: 'inherit',
          detached: true,
        });
        console.log(`Linux terminal opened: ${terminal}`);
        return proc;
      } catch {
        // 尝试下一个
      }
    }
    throw new Error(
      'No supported Linux terminal found (tried: gnome-terminal, konsole, xterm)',
    );
  }
}

// ========== 工厂 ==========

function createStrategy(): TerminalStrategy {
  switch (process.platform) {
    case 'darwin':
      return new MacTerminalStrategy();
    case 'win32':
      return new WindowsTerminalStrategy();
    default:
      return new LinuxTerminalStrategy();
  }
}

// ========== 终端服务 ==========

class TerminalService {
  private process: ChildProcess | null = null;
  private windowId: string | null = null;
  private isStarted: boolean = false;
  private readonly strategy: TerminalStrategy = createStrategy();

  /**
   * 打开终端。若已有进程在运行（非 macOS），直接返回 true。
   */
  async open(mainWindow: BrowserWindow | null): Promise<boolean> {
    // Windows 防重复启动
    if (process.platform === 'win32' && this.isStarted) {
      console.log('Terminal already running');
      return true;
    }

    const ffmpegPath = getFfmpegPath();
    const dirPath = path.dirname(ffmpegPath);

    try {
      this.process = this.strategy.open(dirPath, ffmpegPath, this.windowId);
      this.isStarted = true;

      // macOS 策略可能捕获窗口 ID
      if (this.strategy instanceof MacTerminalStrategy) {
        // windowId 在 stdout 回调中异步更新，进程退出后同步
        this.process.on('exit', () => {
          this.windowId =
            (this.strategy as MacTerminalStrategy).capturedWindowId ??
            this.windowId;
        });
      }

      this.attachEventHandlers(mainWindow);
      return true;
    } catch (error) {
      console.error('Failed to open terminal:', error);
      this.resetState();
      return false;
    }
  }

  /**
   * 注册进程事件：退出后回调主窗口焦点
   */
  private attachEventHandlers(mainWindow: BrowserWindow | null): void {
    if (!this.process) return;

    mainWindow?.setAlwaysOnTop(false);

    const refocus = () => mainWindow?.focus();

    this.process.on('exit', (code) => {
      console.log('Terminal process exited, code:', code);
      refocus();
      this.resetState();
    });

    this.process.on('error', (error) => {
      console.error('Terminal process error:', error);
      refocus();
      this.resetState();
    });

    // Windows：主进程不等待子窗口
    if (process.platform === 'win32') {
      this.process.unref();
    }
  }

  /**
   * 强制终止终端进程
   */
  cleanup(): void {
    if (!this.process) return;

    try {
      if (process.platform === 'win32' && this.process.pid) {
        exec(`taskkill /pid ${this.process.pid} /T /F`);
      } else {
        this.process.kill('SIGTERM');
      }
      console.log('Terminal process cleaned up');
    } catch (error) {
      console.error('Error cleaning up terminal process:', error);
    } finally {
      this.resetState();
    }
  }

  private resetState(): void {
    this.process = null;
    this.isStarted = false;
    // macOS windowId 保留以便下次复用
    if (process.platform !== 'darwin') {
      this.windowId = null;
    }
  }
}

export const terminalService = new TerminalService();
