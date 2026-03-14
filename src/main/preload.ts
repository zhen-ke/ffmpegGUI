import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IpcChannel } from '../shared/ipcChannels';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: IpcChannel, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: IpcChannel, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: IpcChannel, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke: (channel: IpcChannel, ...args: unknown[]) => {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
  platform: process.platform,
  arch: process.arch,
};

contextBridge.exposeInMainWorld('electron', electronHandler);

const terminalAPI = {
  start: (cols: number, rows: number) =>
    ipcRenderer.invoke('pty-start', cols, rows),

  sendInput: (data: string) => ipcRenderer.send('pty-input', data),

  resize: (cols: number, rows: number) =>
    ipcRenderer.send('pty-resize', cols, rows),

  kill: () => ipcRenderer.invoke('pty-kill'),

  onOutput: (cb: (data: string) => void) => {
    const handler = (_event: unknown, data: string) => cb(data);
    ipcRenderer.on('pty-output', handler);
    return () => ipcRenderer.off('pty-output', handler);
  },

  onExit: (cb: (code: number) => void) => {
    const handler = (_event: unknown, code: number) => cb(code);
    ipcRenderer.on('pty-exit', handler);
    return () => ipcRenderer.off('pty-exit', handler);
  },
};

contextBridge.exposeInMainWorld('terminalAPI', terminalAPI);

export type ElectronHandler = typeof electronHandler;
