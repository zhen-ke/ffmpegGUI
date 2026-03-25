/**
 * IPC 通信安全工具
 * 提供防崩溃的 IPC reply 函数
 */

import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';

/**
 * 安全发送 IPC reply
 * 检查窗口是否已销毁，避免向已关闭的窗口发送消息时抛异常
 *
 * @param event IPC 事件
 * @param channel 回复通道
 * @param payload 可选的数据载荷
 */
export function safeReply(
  event: IpcMainEvent | IpcMainInvokeEvent,
  channel: string,
  payload?: unknown,
): void {
  try {
    if (event.sender.isDestroyed()) {
      return;
    }

    // IpcMainEvent 支持 reply；IpcMainInvokeEvent 不支持 reply（只能返回 invoke 的值）
    // 对于我们这类“推送事件”（ffmpeg-output/progress 等），两者都应落到 sender.send。
    const anyEvent = event as IpcMainEvent & {
      reply?: (c: string, ...args: unknown[]) => void;
    };

    if (typeof anyEvent.reply === 'function') {
      // ipcMain.on 场景：通过 reply 回到调用方
      if (payload === undefined) {
        anyEvent.reply(channel);
      } else {
        anyEvent.reply(channel, payload);
      }
    } else {
      // ipcMain.handle/invoke 场景：用 sender.send 推送到 renderer
      if (payload === undefined) {
        event.sender.send(channel);
      } else {
        event.sender.send(channel, payload);
      }
    }
  } catch (error) {
    console.warn('Failed to send IPC message:', error);
  }
}
