import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IpcChannel } from '../shared/ipcChannels';

// ========== 通用 IPC 桥接 ==========

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: IpcChannel, ...args: unknown[]): void {
      ipcRenderer.send(channel, ...args);
    },

    on(
      channel: IpcChannel,
      func: (...args: unknown[]) => void,
    ): () => void {
      const subscription = (
        _event: IpcRendererEvent,
        ...args: unknown[]
      ) => func(...args);

      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },

    once(
      channel: IpcChannel,
      func: (...args: unknown[]) => void,
    ): () => void {
      const subscription = (
        _event: IpcRendererEvent,
        ...args: unknown[]
      ) => func(...args);

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

// ========== Terminal API ==========

/**
 * PTY 事件监听器注册函数的返回值为取消订阅函数。
 * 调用方（Terminal 组件）必须在 unmount 时调用，防止监听器泄漏。
 *
 * onOutput / onExit 每次调用都会替换旧监听器（单播语义），
 * 避免组件 re-render 时重复叠加回调。
 */
const terminalAPI = {
  start(cols: number, rows: number): Promise<unknown> {
    return ipcRenderer.invoke('pty-start', cols, rows);
  },

  sendInput(data: string): void {
    ipcRenderer.send('pty-input', data);
  },

  resize(cols: number, rows: number): void {
    ipcRenderer.send('pty-resize', cols, rows);
  },

  kill(): Promise<unknown> {
    return ipcRenderer.invoke('pty-kill');
  },

  /**
   * 注册 PTY 输出回调。重复调用会先移除旧监听器再注册新的。
   * @returns 取消订阅函数
   */
  onOutput(cb: (data: string) => void): () => void {
    const handler = (_event: IpcRendererEvent, data: string) => cb(data);
    ipcRenderer.removeAllListeners('pty-output');
    ipcRenderer.on('pty-output', handler);
    return () => ipcRenderer.off('pty-output', handler);
  },

  /**
   * 注册 PTY 退出回调。重复调用会先移除旧监听器再注册新的。
   * @returns 取消订阅函数
   */
  onExit(cb: (code: number) => void): () => void {
    const handler = (_event: IpcRendererEvent, code: number) => cb(code);
    ipcRenderer.removeAllListeners('pty-exit');
    ipcRenderer.on('pty-exit', handler);
    return () => ipcRenderer.off('pty-exit', handler);
  },
};

contextBridge.exposeInMainWorld('terminalAPI', terminalAPI);

// ========== 类型导出（供 renderer 侧 window 类型扩展使用）==========

export type ElectronHandler = typeof electronHandler;
export type TerminalAPI = typeof terminalAPI;
