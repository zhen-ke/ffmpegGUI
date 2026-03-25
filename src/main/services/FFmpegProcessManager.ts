/**
 * FFmpeg 进程管理器
 * - 只负责 spawn/stop/kill/解析进度输出
 * - 不做任何 Electron UI（dialog/notification/i18n）
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { getFfmpegPath } from '../utils/pathUtils';

export interface FFmpegProcessCallbacks {
  onOutput: (line: string) => void;
  onProgress: (time: number) => void;
  onDuration: (duration: number) => void;
  onComplete: (outputFile?: string) => void;
  onCancelled: () => void;
  onError: (message: string) => void;
}

interface ProcessState {
  process: ChildProcessWithoutNullStreams;
  /** 用户主动触发了停止（写 q / SIGTERM） */
  isStopping: boolean;
  /** 已上报过总时长（只上报一次） */
  hasReportedDuration: boolean;
  forceKillTimer: ReturnType<typeof setTimeout> | null;
  stdout: LineBuffer;
  stderr: LineBuffer;
  outputFile?: string;
}

class LineBuffer {
  private buf = '';

  push(chunk: string): string[] {
    const lines = (this.buf + chunk).split(/\r?\n|\r/);
    // 最后一段可能不完整，暂存
    this.buf = lines.pop() ?? '';
    return lines;
  }

  flush(): string[] {
    const trailing = this.buf;
    this.buf = '';
    return trailing ? [trailing] : [];
  }
}

/** 匹配 FFmpeg 输出中的时间戳，如 `time=00:01:23.45` */
const RE_PROGRESS = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g;

/** 匹配 FFmpeg 输出中的总时长，如 `Duration: 00:02:10.00` */
const RE_DURATION = /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/;

export class FFmpegProcessManager {
  private state: ProcessState | null = null;

  start(args: string[], callbacks: FFmpegProcessCallbacks, outputFile?: string) {
    if (this.state) return; // 上层应先检查 isRunning()

    const proc = spawn(getFfmpegPath(), args, {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.state = {
      process: proc,
      isStopping: false,
      hasReportedDuration: false,
      forceKillTimer: null,
      stdout: new LineBuffer(),
      stderr: new LineBuffer(),
      outputFile,
    };

    proc.stdout.on('data', (data: Buffer) => {
      const s = this.state;
      if (!s) return;
      const lines = s.stdout.push(data.toString());
      for (const line of lines) callbacks.onOutput(line);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const s = this.state;
      if (!s) return;

      const chunk = data.toString();
      const lines = s.stderr.push(chunk);
      for (const line of lines) callbacks.onOutput(line);

      this.tryReportDuration(chunk, callbacks);
      this.tryReportProgress(chunk, callbacks);
    });

    proc.on('close', (code) => {
      // 若已因 error/tardown 置空 state，则 close 事件不再回调（避免重复上报）
      if (!this.state) return;
      this.handleClose(code, callbacks);
    });

    proc.on('error', (err) => {
      // 仅在非用户主动停止时上报错误；若用户已停止，等待 close 事件统一处理
      const stopping = this.state?.isStopping ?? false;
      if (!stopping) {
        callbacks.onError(`FFmpeg process error: ${(err as Error).message}`);
      }
      this.teardown();
    });
  }

  stop(): boolean {
    const s = this.state;
    if (!s) return false;

    s.isStopping = true;

    const { process: proc } = s;
    try {
      if (proc.stdin.writable) {
        proc.stdin.write('q\n');
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      proc.kill('SIGTERM');
    }

    this.scheduleForceKill(5_000);
    return true;
  }

  cleanup(): void {
    const s = this.state;
    if (!s) return;

    s.isStopping = true;
    try {
      s.process.kill('SIGTERM');
      this.scheduleForceKill(2_000);
    } catch {
      this.teardown();
    }
  }

  isRunning(): boolean {
    return this.state !== null;
  }

  private scheduleForceKill(delayMs: number): void {
    const s = this.state;
    if (!s) return;

    if (s.forceKillTimer) clearTimeout(s.forceKillTimer);

    const proc = s.process;
    s.forceKillTimer = setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }, delayMs);
  }

  private teardown(): void {
    const s = this.state;
    if (!s) return;
    if (s.forceKillTimer) clearTimeout(s.forceKillTimer);
    this.state = null;
  }

  private handleClose(code: number | null, callbacks: FFmpegProcessCallbacks) {
    const s = this.state;
    if (!s) return;

    // 刷出缓冲区残余行
    for (const line of s.stdout.flush()) callbacks.onOutput(line);
    for (const line of s.stderr.flush()) callbacks.onOutput(line);

    const stoppedByUser = s.isStopping;
    const outputFile = s.outputFile;
    this.teardown();

    if (stoppedByUser) {
      callbacks.onCancelled();
      return;
    }

    if (code === 0) {
      callbacks.onComplete(outputFile);
      return;
    }

    callbacks.onError(`FFmpeg process exited with code ${code}.`);
  }

  private tryReportProgress(chunk: string, callbacks: FFmpegProcessCallbacks) {
    // 重置 lastIndex，确保每次从头匹配
    RE_PROGRESS.lastIndex = 0;

    let match: RegExpExecArray | null;
    let last: RegExpExecArray | null = null;
    while ((match = RE_PROGRESS.exec(chunk)) !== null) last = match;
    if (!last) return;

    const [, h, m, s] = last;
    const time = this.toSeconds(h, m, s);
    if (Number.isFinite(time)) callbacks.onProgress(time);
  }

  private tryReportDuration(chunk: string, callbacks: FFmpegProcessCallbacks) {
    if (!this.state || this.state.hasReportedDuration) return;
    const match = RE_DURATION.exec(chunk);
    if (!match) return;

    const [, h, m, s] = match;
    const duration = this.toSeconds(h, m, s);
    if (!Number.isFinite(duration)) return;

    this.state.hasReportedDuration = true;
    callbacks.onDuration(duration);
  }

  private toSeconds(h: string, m: string, s: string): number {
    const hours = parseInt(h, 10);
    const minutes = parseInt(m, 10);
    const seconds = parseFloat(s);

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      !Number.isFinite(seconds)
    ) {
      return NaN;
    }

    return hours * 3600 + minutes * 60 + seconds;
  }
}

