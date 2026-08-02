/**
 * FFmpeg 进程管理器
 * - 只负责 spawn/stop/kill/解析进度输出
 * - 不做任何 Electron UI（dialog/notification/i18n）
 */

import { spawn, type ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';
import os from 'os';
import { getFfmpegBinDir } from '../utils/pathUtils';

export interface FFmpegProcessCallbacks {
  onOutput: (line: string) => void;
  onProgress: (time: number) => void;
  onDuration: (duration: number) => void;
  onComplete: (outputFile?: string) => void;
  onCancelled: () => void;
  onError: (message: string) => void;
}

interface ProcessState {
  process: ChildProcessByStdio<null, Readable, Readable>;
  /** 用户主动触发了停止（SIGTERM） */
  isStopping: boolean;
  /** 已上报过总时长（只上报一次） */
  hasReportedDuration: boolean;
  forceKillTimer: ReturnType<typeof setTimeout> | null;
  /** 输出节流定时器 */
  flushTimer: ReturnType<typeof setTimeout> | null;
  /** 进度节流定时器 */
  progressTimer: ReturnType<typeof setTimeout> | null;
  /** 待合并的输出行缓冲 */
  pendingLines: string[];
  /** 待上报的最新进度时间（秒） */
  latestProgressTime: number;
  /** 最近一条进度行（仅保留最新，用于日志合并，避免逐帧刷屏） */
  latestProgressLine: string | null;
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

/** 输出节流间隔（ms）：合并高频 \r 进度行，减少 IPC 压力 */
const OUTPUT_FLUSH_INTERVAL_MS = 80;

/** 进度节流间隔（ms）：ffmpeg 默认按帧刷进度，节流到 ~5Hz 上报进度条 */
const PROGRESS_FLUSH_INTERVAL_MS = 200;

/** 构建传给 ffmpeg 子进程的环境变量 */
function buildFFmpegEnv(): NodeJS.ProcessEnv {
  const logicalCores = os.cpus().length;
  // 物理核近似：Intel 超线程下逻辑核 = 物理核 × 2；Apple Silicon 无超线程，两者相等。
  // 取 ceil(logical / 2) 可在 Intel 上避免过度超线程竞争，Apple Silicon 上最多少用一半，
  // 但由于 ffmpeg 自身会按需调度，实际差异极小。
  const physicalCores = Math.max(1, Math.ceil(logicalCores / 2));
  return {
    ...process.env,
    // OMP_NUM_THREADS 只影响基于 OpenMP 的组件（libaom-av1、SVT-AV1 及部分
    // OpenMP 滤镜）。x264 / x265 自有线程模型，不受此变量影响（由其各自的
    // -threads 控制）。此处对齐物理核数可在 AV1 模板上减少超线程竞争，对
    // 其他编码器无副作用；保留以惠及 AV1 编码路径。
    OMP_NUM_THREADS: String(physicalCores),
    // macOS：将 binaries/ 目录前置到动态库搜索路径，确保捆绑的 dylib 优先被找到
    ...(process.platform === 'darwin'
      ? {
          DYLD_LIBRARY_PATH: [
            getFfmpegBinDir(),
            process.env.DYLD_LIBRARY_PATH ?? '',
          ]
            .filter(Boolean)
            .join(':'),
        }
      : {}),
    // 关闭 ANSI 颜色转义，减少日志解析噪声
    AV_LOG_FORCE_NOCOLOR: '1',
  };
}

export class FFmpegProcessManager {
  private state: ProcessState | null = null;

  start(
    executablePath: string,
    args: string[],
    callbacks: FFmpegProcessCallbacks,
    outputFile?: string,
    workingDirectory?: string,
  ) {
    if (this.state) return; // 上层应先检查 isRunning()

    const proc = spawn(executablePath, args, {
      cwd: workingDirectory,
      shell: false,
      windowsHide: true,
      // stdin 用 'ignore'：本进程不与 ffmpeg 交互（停止走 SIGTERM，见 stop()），
      // 不再分配无用的 stdin 管道，也避免任何 stdin 读取边界。
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildFFmpegEnv(),
    });

    // ── 进程优先级：降低 ffmpeg 优先级，避免编码吃满 CPU 导致 GUI 卡顿 ──
    if (proc.pid !== undefined) {
      try {
        os.setPriority(
          proc.pid,
          os.constants.priority.PRIORITY_BELOW_NORMAL,
        );
      } catch {
        // 部分平台/权限下设置可能失败，静默忽略
      }
    }

    this.state = {
      process: proc,
      isStopping: false,
      hasReportedDuration: false,
      forceKillTimer: null,
      flushTimer: null,
      progressTimer: null,
      pendingLines: [],
      latestProgressTime: NaN,
      latestProgressLine: null,
      stdout: new LineBuffer(),
      stderr: new LineBuffer(),
      outputFile,
    };

    proc.stdout.on('data', (data: Buffer) => {
      const s = this.state;
      if (!s) return;
      const lines = s.stdout.push(data.toString());
      for (const line of lines) this.enqueueOutput(s, line, callbacks);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const s = this.state;
      if (!s) return;

      // 在 LineBuffer 切出的完整行上解析进度 / 时长（非原始 chunk，避免
      // time= 跨 chunk 边界漏匹配）。进度行（frame=... time=...）既上报
      // 进度条，也保留最新一条进日志（enqueueOutput 合并，避免逐帧 \r
      // 刷屏）。普通日志行照常节流送终端。
      const lines = s.stderr.push(data.toString());
      for (const line of lines) {
        this.tryReportDuration(line, callbacks);
        const time = this.extractProgress(line);
        if (Number.isNaN(time)) {
          this.enqueueOutput(s, line, callbacks);
        } else {
          s.latestProgressLine = line;
          // 确保 flush 定时器存在：即使窗口内只有进度行，也能按节流频率
          // 把最新进度刷进日志（否则进度行会一直滞留到有普通行才输出）。
          if (s.flushTimer === null) {
            s.flushTimer = setTimeout(() => {
              s.flushTimer = null;
              this.flushPendingOutput(s, callbacks);
            }, OUTPUT_FLUSH_INTERVAL_MS);
          }
          this.scheduleProgressEmit(s, time, callbacks);
        }
      }
    });

    proc.on('close', (code) => {
      // 若已因 error/teardown 置空 state，则 close 事件不再回调（避免重复上报）
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
    // 本进程 stdio 为管道（非 TTY），ffmpeg 在非 TTY 下自动禁用 -stdin，
    // 不会读取 `q` 键——向管道写 `q` 是空操作。因此直接发 SIGTERM：
    // ffmpeg 的 SIGTERM handler 会写完当前帧并正常收尾（写 trailer /
    // moov atom），保证输出文件可播放。与 cleanup()（应用退出路径）
    // 保持一致的优雅停止语义，避免此前“停止=2s 后 SIGKILL 硬杀”导致
    // 输出文件未收尾的问题。
    try {
      proc.kill('SIGTERM');
    } catch {
      // kill 抛错通常意味着进程已退出，忽略即可
    }

    // SIGTERM 优雅退出对大文件 / AV1 等慢编码可能需要数秒，
    // 5s 内仍未退出则 SIGKILL 兜底。
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

  /**
   * 等待当前进程真正退出（close 事件触发、stdio 关闭）。
   *
   * 用于应用退出路径：cleanup() 发出 SIGTERM 后主进程若立即退出，
   * 2s 的 SIGKILL 兜底定时器会随主进程消亡而失效，可能留下孤儿进程。
   * 调用方应先 cleanup() 再 await 本方法，然后再退出主进程。
   *
   * 超时兜底大于内部 SIGKILL 的 2s，正常路径必定在超时前 resolve；
   * 即使超时也只是按调用方预期继续退出流程，进程已被 SIGKILL。
   *
   * @param timeoutMs 最长等待时间，默认 3000ms
   */
  async waitForExit(timeoutMs = 3_000): Promise<void> {
    const s = this.state;
    if (!s) return;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      // 进程已退出（极少见的竞态：SIGTERM 后立即收到 close）时直接返回
      if (s.process.exitCode !== null) {
        clearTimeout(timer);
        resolve();
        return;
      }
      s.process.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  isRunning(): boolean {
    return this.state !== null;
  }

  // ─── 输出节流：合并 OUTPUT_FLUSH_INTERVAL_MS 内的多行，统一回调一次 ───────

  private enqueueOutput(
    s: ProcessState,
    line: string,
    callbacks: FFmpegProcessCallbacks,
  ): void {
    s.pendingLines.push(line);

    if (s.flushTimer === null) {
      s.flushTimer = setTimeout(() => {
        s.flushTimer = null;
        this.flushPendingOutput(s, callbacks);
      }, OUTPUT_FLUSH_INTERVAL_MS);
    }
  }

  /** 进程退出时立即刷出还未发送的缓冲行 */
  private flushPendingOutput(
    s: ProcessState,
    callbacks: FFmpegProcessCallbacks,
  ): void {
    if (s.flushTimer !== null) {
      clearTimeout(s.flushTimer);
      s.flushTimer = null;
    }
    const lines = s.pendingLines.splice(0);
    // 把窗口内最新的一条进度行也合并进日志（进度行不常驻 pendingLines，
    // 只在 flush 时取最新值），让转码过程在日志层可见且不逐帧刷屏。
    if (s.latestProgressLine !== null) {
      lines.push(s.latestProgressLine);
      s.latestProgressLine = null;
    }
    for (const l of lines) callbacks.onOutput(l);
  }

  // ─────────────────────────────────────────────────────────────────────────

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
    if (s.flushTimer) clearTimeout(s.flushTimer);
    if (s.progressTimer) clearTimeout(s.progressTimer);
    this.state = null;
  }

  private handleClose(code: number | null, callbacks: FFmpegProcessCallbacks) {
    const s = this.state;
    if (!s) return;

    // 刷出缓冲区残余行（LineBuffer + 节流队列）
    for (const line of s.stdout.flush()) s.pendingLines.push(line);
    for (const line of s.stderr.flush()) s.pendingLines.push(line);
    this.flushPendingOutput(s, callbacks);

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

  /**
   * 从一行 ffmpeg 输出中提取进度时间（秒）。无匹配返回 NaN。
   * 纯函数，不做回调副作用——由调用方决定是否节流上报。
   */
  private extractProgress(line: string): number {
    // 重置 lastIndex，避免全局正则 lastIndex 状态污染
    RE_PROGRESS.lastIndex = 0;
    const match = RE_PROGRESS.exec(line);
    if (!match) return NaN;

    const [, h, m, s] = match;
    return this.toSeconds(h, m, s);
  }

  /**
   * 节流上报进度：ffmpeg 默认按帧刷进度（可达数十/秒），每帧都走 IPC
   * 会造成大量跨进程消息与 React 状态更新。合并到 ~5Hz 上报最新值，
   * 进度条 CSS 500ms 过渡足以平滑，ETA 的 EMA 也更稳定。
   */
  private scheduleProgressEmit(
    s: ProcessState,
    time: number,
    callbacks: FFmpegProcessCallbacks,
  ): void {
    s.latestProgressTime = time;
    if (s.progressTimer !== null) return;

    s.progressTimer = setTimeout(() => {
      s.progressTimer = null;
      // state 已变更（进程退出/teardown）则丢弃此次上报，避免陈旧回调
      if (this.state !== s) return;
      if (Number.isFinite(s.latestProgressTime)) {
        callbacks.onProgress(s.latestProgressTime);
      }
    }, PROGRESS_FLUSH_INTERVAL_MS);
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
