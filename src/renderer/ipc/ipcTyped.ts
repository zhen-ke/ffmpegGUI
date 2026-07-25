/**
 * 统一类型化 IPC 封装层
 *
 * 三个函数分别覆盖 Electron 的三种 IPC 模式：
 * - onIpcEvent：主→渲染 事件监听（替代 ipcRenderer.on）
 * - ipcInvoke：渲染→主 请求-响应（替代 ipcRenderer.invoke）
 * - ipcSend：渲染→主 单向发送（替代 ipcRenderer.sendMessage）
 *
 * 所有通道名和载荷类型由 shared/ipc.ts 的映射接口约束，
 * 调用方不再需要 `as ...` 手写窄化。
 */
import type { IpcEventPayloads, IpcInvokeMap, IpcSendMap } from '../../shared/ipc';

/**
 * 类型化事件监听。
 *
 * 对于载荷为 `void` 的通道（如 `ffmpeg-install-complete`），handler 签名自动
 * 简化为 `() => void`；其余通道 handler 接收强类型载荷。
 */
export function onIpcEvent<K extends keyof IpcEventPayloads>(
  channel: K,
  handler: IpcEventPayloads[K] extends void
    ? () => void
    : (payload: IpcEventPayloads[K]) => void,
): () => void {
  return window.electron.ipcRenderer.on(
    channel,
    (raw: unknown) => {
      (handler as (payload: unknown) => void)(raw);
    },
  );
}

/**
 * 类型化请求-响应。
 */
export async function ipcInvoke<K extends keyof IpcInvokeMap>(
  channel: K,
  ...args: IpcInvokeMap[K]['args']
): Promise<IpcInvokeMap[K]['result']> {
  const result = await window.electron.ipcRenderer.invoke(
    channel,
    ...args,
  );
  return result as IpcInvokeMap[K]['result'];
}

/**
 * 类型化单向发送（fire-and-forget）。
 */
export function ipcSend<K extends keyof IpcSendMap>(
  channel: K,
  ...args: IpcSendMap[K]
): void {
  window.electron.ipcRenderer.sendMessage(channel, ...args);
}
