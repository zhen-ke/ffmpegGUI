/**
 * PTY 进程管理服务（单例）
 */

import { app } from 'electron';
import type {
  IDisposable,
  IPty,
} from '@homebridge/node-pty-prebuilt-multiarch';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import type { WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  getFfmpegBinDir,
  getFfmpegSearchDirs,
  getLegacyFfmpegPath,
} from '../utils/pathUtils';

// ========== 常量 ==========

const DEFAULT_SHELL: Readonly<Record<string, string>> = {
  win32: 'cmd.exe',
  darwin: process.env.SHELL ?? '/bin/zsh',
  linux: process.env.SHELL ?? '/bin/bash',
};

const FALLBACK_SHELL = '/bin/bash';

function getShellArgs(shell: string): string[] {
  return path.basename(shell).toLowerCase() === 'cmd.exe' ? [] : ['--login'];
}

function buildPtyEnv(cwd: string): Record<string, string> {
  const base = Object.entries(process.env).reduce<Record<string, string>>(
    (env, [key, value]) => {
      if (value !== undefined) {
        env[key] = value;
      }
      return env;
    },
    {},
  );

  const extraPaths = [
    cwd,
    path.dirname(getLegacyFfmpegPath()),
    ...getFfmpegSearchDirs(),
    process.env.HOME ? path.join(process.env.HOME, '.fnm') : '',
  ]
    .filter(Boolean)
    .join(path.delimiter);

  base.PATH = [extraPaths, base.PATH ?? '']
    .filter(Boolean)
    .join(path.delimiter);

  return base;
}

function getInitialCwd(): string {
  const candidates = [
    getFfmpegBinDir(),
    path.dirname(getLegacyFfmpegPath()),
    app.getPath('home'),
    process.cwd(),
  ];

  const existingDir = candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  });

  return existingDir ?? process.cwd();
}

// ========== 进程状态 ==========

/**
 * 将 PTY 进程与其关联的 WebContents 绑定为一个原子状态对象。
 * `state` 为 null 即无进程，不会出现"进程有 sender 无"的矛盾状态。
 */
interface PtyState {
  process: IPty;
  sender: WebContents;
  /** onData / onExit 返回的 disposable，teardown 时统一释放，避免回调悬挂。 */
  disposables: IDisposable[];
}

// ========== PtyService ==========

class PtyService {
  private state: PtyState | null = null;

  // ——— 公共 API ———

  /**
   * 启动 PTY shell。
   *
   * @throws 若已有进程在运行则抛出错误，调用方可选择处理或忽略。
   */
  start(sender: WebContents, cols = 80, rows = 24): void {
    // macOS 窗口关闭重建后，旧 PTY 仍存活但绑定到已销毁的 sender，
    // 导致新窗口 start 被拒。检测到这种僵尸会话时先清理再重建。
    if (this.state) {
      if (this.state.sender.isDestroyed()) {
        console.warn('PTY session bound to a destroyed sender; rebuilding.');
        this.kill();
      } else {
        console.warn(
          'PTY is already running. Call kill() before starting a new session.',
        );
        return;
      }
    }

    const shell = DEFAULT_SHELL[process.platform] ?? FALLBACK_SHELL;
    const cwd = getInitialCwd();

    const proc = pty.spawn(shell, getShellArgs(shell), {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: buildPtyEnv(cwd),
    });

    // 先建立状态，再绑定回调——确保回调执行时 state 已就绪
    const disposables: IDisposable[] = [];
    this.state = { process: proc, sender, disposables };

    // 保存 onData/onExit 返回的 disposable，teardown 时统一 dispose
    disposables.push(
      proc.onData((data) => {
        this.sendToRenderer('pty-output', data);
      }),
    );

    disposables.push(
      proc.onExit(({ exitCode }) => {
        console.log('PTY exited with code:', exitCode);
        // 使用本地快照通知 renderer，之后再清理状态
        // 避免 teardown() 提前将 sender 置空导致通知丢失
        const currentSender = this.state?.sender;
        this.teardown();
        if (currentSender && !currentSender.isDestroyed()) {
          currentSender.send('pty-exit', exitCode);
        }
      }),
    );
  }

  /**
   * 向 PTY 写入数据。进程未运行时记录警告，不静默丢弃。
   */
  write(data: string): void {
    if (!this.state) {
      console.warn('PTY write ignored: no process is running.');
      return;
    }
    this.state.process.write(data);
  }

  /**
   * 调整终端尺寸。
   */
  resize(cols: number, rows: number): void {
    if (!this.state) return;
    try {
      this.state.process.resize(cols, rows);
    } catch (e) {
      console.warn('PTY resize failed:', e);
    }
  }

  /**
   * 终止 PTY 进程并清理状态。幂等，可安全重复调用。
   */
  kill(): void {
    if (!this.state) return;
    const { process: proc } = this.state;
    // 先释放监听并清空状态，再 kill 进程：
    // 这样进程退出时不会再触发已 dispose 的 onData/onExit 回调
    this.teardown();
    try {
      proc.kill();
    } catch (e) {
      console.warn('PTY kill failed:', e);
    }
  }

  /** 应用退出时调用，语义同 kill()。 */
  cleanup(): void {
    this.kill();
  }

  isRunning(): boolean {
    return this.state !== null;
  }

  // ——— 内部实现 ———

  /**
   * 安全地向 renderer 发送消息，自动检查 WebContents 存活状态。
   */
  private sendToRenderer(channel: string, ...args: unknown[]): void {
    const { sender } = this.state ?? {};
    if (sender && !sender.isDestroyed()) {
      sender.send(channel, ...args);
    }
  }

  /**
   * 清除所有运行时状态。不负责 kill 进程本身——由调用方决定。
   */
  private teardown(): void {
    if (!this.state) return;
    // 释放 onData / onExit 等监听，避免回调悬挂到已 kill 的进程
    this.state.disposables.forEach((disposable) => {
      try {
        disposable.dispose();
      } catch (e) {
        console.warn('PTY disposable dispose failed:', e);
      }
    });
    this.state = null;
  }
}

export const ptyService = new PtyService();
