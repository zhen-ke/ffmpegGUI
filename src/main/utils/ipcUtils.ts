/**
 * IPC 通信安全工具
 * 提供防崩溃的 IPC reply 函数
 */

import type { IpcMainEvent } from 'electron';

/**
 * 安全发送 IPC reply
 * 检查窗口是否已销毁，避免向已关闭的窗口发送消息时抛异常
 *
 * @param event IPC 事件
 * @param channel 回复通道
 * @param payload 可选的数据载荷
 */
export function safeReply(
  event: IpcMainEvent,
  channel: string,
  payload?: unknown,
): void {
  try {
    if (event.sender.isDestroyed()) {
      return;
    }

    if (payload === undefined) {
      event.reply(channel);
    } else {
      event.reply(channel, payload);
    }
  } catch (error) {
    console.warn('Failed to send IPC message:', error);
  }
}
