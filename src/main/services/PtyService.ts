import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import type { WebContents } from 'electron';
import path from 'path';
import { getFfmpegPath } from '../utils/pathUtils';

const DEFAULT_SHELL: Record<string, string> = {
  win32: 'cmd.exe',
  darwin: process.env.SHELL ?? '/bin/zsh',
  linux: process.env.SHELL ?? '/bin/bash',
};

class PtyService {
  private ptyProcess: IPty | null = null;
  private sender: WebContents | null = null;

  start(sender: WebContents, cols = 80, rows = 24): void {
    if (this.ptyProcess) return;

    this.sender = sender;
    const shell = DEFAULT_SHELL[process.platform] ?? '/bin/bash';
    const cwd = path.dirname(getFfmpegPath());

    this.ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        PATH: `${cwd}${path.delimiter}${process.env.PATH ?? ''}`,
      } as Record<string, string>,
    });

    this.ptyProcess.onData((data) => {
      if (!this.sender?.isDestroyed()) {
        this.sender?.send('pty-output', data);
      }
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      console.log('PTY exited:', exitCode);
      this.ptyProcess = null;
      this.sender?.send?.('pty-exit', exitCode);
    });
  }

  write(data: string): void {
    this.ptyProcess?.write(data);
  }

  resize(cols: number, rows: number): void {
    try {
      this.ptyProcess?.resize(cols, rows);
    } catch (e) {
      console.warn('PTY resize failed:', e);
    }
  }

  kill(): void {
    if (!this.ptyProcess) return;
    try {
      this.ptyProcess.kill();
    } catch {
      /* ignore */
    }
    this.ptyProcess = null;
    this.sender = null;
  }

  cleanup(): void {
    this.kill();
  }

  isRunning(): boolean {
    return this.ptyProcess !== null;
  }
}

export const ptyService = new PtyService();
