/**
 * FFmpeg 事件订阅层（向后兼容别名）
 *
 * 原 `onFFmpegEvent` 现在委托给通用的 `onIpcEvent`，
 * 但限制通道范围为 `FFmpegEventPayloads` 的键。
 * 已有消费者无需改动 import。
 */
import type { FFmpegEventPayloads } from '../../shared/ipc';
import { onIpcEvent } from './ipcTyped';

export function onFFmpegEvent<K extends keyof FFmpegEventPayloads>(
  channel: K,
  handler: FFmpegEventPayloads[K] extends void
    ? () => void
    : (payload: FFmpegEventPayloads[K]) => void,
): () => void {
  return onIpcEvent(channel, handler as never);
}

export default onFFmpegEvent;
