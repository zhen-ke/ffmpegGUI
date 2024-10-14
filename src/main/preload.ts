import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'start-ffmpeg'
  | 'stop-ffmpeg'
  | 'check-file-exists'
  | 'ffmpeg-output'
  | 'ffmpeg-error'
  | 'ffmpeg-progress'
  | 'ffmpeg-duration'
  | 'open-output-folder'
  | 'ffmpeg-status'
  | 'download-ffmpeg'
  | 'ffmpeg-download-progress'
  | 'ffmpeg-extract-progress'
  | 'ffmpeg-install-complete'
  | 'ffmpeg-install-error'
  | 'ffmpeg-complete';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
