/**
 * PTY 进程管理服务（单例）
 */

import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import type { WebContents } from 'electron';
import path from 'path';
import { getFfmpegPath } from '../utils/pathUtils';

// ========== 常量 ==========

const DEFAULT_SHELL: Readonly<Record<string, string>> = {
  win32: 'cmd.exe',
  darwin: process.env.SHELL ?? '/bin/zsh',
  linux: process.env.SHELL ?? '/bin/bash',
};

const FALLBACK_SHELL = '/bin/bash';

// ========== 进程状态 ==========

/**
 * 将 PTY 进程与其关联的 WebContents 绑定为一个原子状态对象。
 * `state` 为 null 即无进程，不会出现"进程有 sender 无"的矛盾状态。
 */
interface PtyState {
  process: IPty;
  sender: WebContents;
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
    if (this.state) {
      console.warn('PTY is already running. Call kill() before starting a new session.');
      return;
    }

    const shell = DEFAULT_SHELL[process.platform] ?? FALLBACK_SHELL;
    const cwd = path.dirname(getFfmpegPath());

    const proc = pty.spawn(shell, ['--login'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: this.buildEnv(cwd),
    });

    // 先建立状态，再绑定回调——确保回调执行时 state 已就绪
    this.state = { process: proc, sender };

    proc.onData((data) => {
      this.sendToRenderer('pty-output', data);
    });

    proc.onExit(({ exitCode }) => {
      console.log('PTY exited with code:', exitCode);
      // 使用本地快照通知 renderer，之后再清理状态
      // 避免 teardown() 提前将 sender 置空导致通知丢失
      const currentSender = this.state?.sender;
      this.teardown();
      if (currentSender && !currentSender.isDestroyed()) {
        currentSender.send('pty-exit', exitCode);
      }
    });
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
    // 先清理状态，再 kill 进程
    // 这样 onExit 回调触发时 state 已为 null，不会二次 teardown
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
   * 构造传给 PTY 的环境变量，过滤掉 `process.env` 中的 `undefined` 值。
   * node-pty 要求 env 值均为 string，不接受 undefined。
   */
  private buildEnv(cwd: string): Record<string, string> {
    const base: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) base[k] = v;
    }

    // 补全 GUI 启动时缺失的常见工具路径
    const extraPaths = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/opt/homebrew/bin',         // Apple Silicon Homebrew
      '/opt/homebrew/sbin',
      `${process.env.HOME}/.fnm`,  // fnm
    ].join(':');

    base.PATH = `${cwd}:${extraPaths}:${base.PATH ?? ''}`;
    return base;
  }

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
    this.state = null;
  }
}

export const ptyService = new PtyService();
