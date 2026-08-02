/**
 * 统一的 IPC 响应类型（共享模块）
 *
 * 主进程所有 invoke handler 的返回值都应采用此结构，
 * 渲染层据此做 `success` 分支判断，避免散落的 `{ success; error? }` 内联断言。
 *
 * - 无数据载荷的 handler：`IpcResult`
 * - 带数据的 handler：`IpcResult<T>`，成功时附带 `data: T`
 */

// Import MediaProbeResult type reference for documentation only;
// the actual import happens in renderer-side consumer code.
import type { MediaProbeResult } from './mediaProbe';

export type IpcResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

/**
 * FFmpeg 事件通道 → 载荷类型映射。
 *
 * 主进程通过 `safeReply(event, channel, payload)` 推送，
 * 渲染进程据此获得类型化的订阅（见 renderer/ipc/ffmpegEvents.ts），
 * 消除各组件里 `as { time: number }` / `as string` 这类手写窄化样板。
 */
export interface FFmpegEventPayloads {
  /** FFmpeg stdout/stderr 输出行 */
  'ffmpeg-output': string;
  /** FFmpeg 错误信息 */
  'ffmpeg-error': string;
  /** 进程被取消时的说明文案 */
  'ffmpeg-cancelled': string;
  /** 进度：当前已处理时间（秒） */
  'ffmpeg-progress': { time: number };
  /** 总时长（秒），由首条 `Duration:` 行解析，仅上报一次 */
  'ffmpeg-duration': { duration: number };
  /** 完成：输出文件绝对路径（可能为 null） */
  'ffmpeg-complete': { outputFile: string | null };
  /** FFmpeg 可用性变更（安装完成等） */
  'ffmpeg-status': boolean;
  /** 进程长时间无输出（可能卡死）：已停滞时长（ms） */
  'ffmpeg-stalled': { stalledForMs: number };
  /** 命令链切换到新段：当前段号（1-based）与总段数 */
  'ffmpeg-chain-segment': { segment: number; total: number };
}

/**
 * 全局 IPC 事件通道 → 载荷类型映射。
 * 继承 FFmpeg 事件，并新增 PTY、安装器等通道。
 */
export interface IpcEventPayloads extends FFmpegEventPayloads {
  'pty-output': string;
  'pty-exit': number;
  'ffmpeg-download-progress': number;
  'ffmpeg-extract-progress': number;
  'ffmpeg-install-complete': void;
  'ffmpeg-install-error': string;
}

/**
 * IPC invoke（请求-响应）通道 → 参数/返回类型映射。
 */
export interface IpcInvokeMap {
  'start-ffmpeg': { args: [command: string]; result: IpcResult };
  'stop-ffmpeg': { args: []; result: IpcResult };
  'ffmpeg-resume': { args: []; result: IpcResult };
  'check-ffmpeg-status': { args: []; result: boolean };
  'check-media-probe-status': { args: []; result: boolean };
  'check-hardware-encoders': { args: []; result: string[] };
  'probe-media': {
    args: [filePath: string];
    result: IpcResult<MediaProbeResult>;
  };
  'select-input-file': {
    args: [currentPath?: string];
    result: { canceled: boolean; filePaths: string[] };
  };
  'select-output-folder': {
    args: [currentPath?: string];
    result: { canceled: boolean; filePaths: string[] };
  };
  'open-output-file': { args: [filePath: string]; result: IpcResult };
  'open-output-folder': { args: [filePath: string]; result: IpcResult };
  'pty-start': { args: [cols: number, rows: number]; result: void };
  'pty-kill': { args: []; result: void };
  'fetch-osx-experts-html': { args: []; result: string };
}

/**
 * IPC 单向发送通道 → 参数元组类型映射。
 */
export interface IpcSendMap {
  'download-ffmpeg': [url: string];
  'pty-resize': [cols: number, rows: number];
  'pty-input': [data: string];
}
