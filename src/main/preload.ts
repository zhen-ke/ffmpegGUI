import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IpcChannel } from '../shared/ipcChannels';

// ========== 通用 IPC 桥接 ==========

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: IpcChannel, ...args: unknown[]): void {
      ipcRenderer.send(channel, ...args);
    },

    on(channel: IpcChannel, func: (...args: unknown[]) => void): () => void {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);

      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },

    once(channel: IpcChannel, func: (...args: unknown[]) => void): () => void {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);

      ipcRenderer.once(channel, subscription);

      // 返回提前取消的能力，与 on() 保持对称
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },

    invoke(channel: IpcChannel, ...args: unknown[]): Promise<unknown> {
      return ipcRenderer.invoke(channel, ...args);
    },
  },

  platform: process.platform,
  arch: process.arch,
};

contextBridge.exposeInMainWorld('electron', electronHandler);

// ========== 类型导出（供 renderer 侧 window 类型扩展使用）==========
// PTY 通道现已并入 IPC_CHANNELS，Terminal 组件直接复用
// window.electron.ipcRenderer 的类型化 invoke/send/on，无需独立桥。

export type ElectronHandler = typeof electronHandler;
