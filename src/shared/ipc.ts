/**
 * 统一的 IPC 响应类型（共享模块）
 *
 * 主进程所有 invoke handler 的返回值都应采用此结构，
 * 渲染层据此做 `success` 分支判断，避免散落的 `{ success; error? }` 内联断言。
 *
 * - 无数据载荷的 handler：`IpcResult`
 * - 带数据的 handler：`IpcResult<T>`，成功时附带 `data: T`
 */

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
}
