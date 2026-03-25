/**
 * FFmpeg 相关 IPC 处理器
 */

import { ipcMain, type BrowserWindow } from 'electron';
import { ffmpegService } from '../services/FFmpegController';
import { safeReply } from '../utils/ipcUtils';

/** 统一的响应结构（用于 invoke 的返回值） */
type IpcResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

/**
 * 注册 FFmpeg 相关的 IPC 处理器。
 * 幂等：重复调用会先移除旧监听器再重新注册，避免事件重复触发。
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupFFmpegHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  // 幂等保护：先移除可能存在的旧监听，再重新注册
  ipcMain.removeAllListeners('start-ffmpeg');
  ipcMain.removeAllListeners('stop-ffmpeg');
  ipcMain.removeHandler('start-ffmpeg');
  ipcMain.removeHandler('stop-ffmpeg');
  ipcMain.removeHandler('check-ffmpeg-status');

  ipcMain.on('start-ffmpeg', async (event, command: string) => {
    await ffmpegService.start(command, event, getMainWindow());
  });

  ipcMain.on('stop-ffmpeg', (event) => {
    if (!ffmpegService.isRunning()) {
      safeReply(event, 'ffmpeg-error', 'No FFmpeg process is running.');
      return;
    }
    ffmpegService.stop();
  });

  ipcMain.handle(
    'start-ffmpeg',
    async (event, command: string): Promise<IpcResult> => {
      return ffmpegService.start(command, event, getMainWindow());
    },
  );

  ipcMain.handle(
    'stop-ffmpeg',
    (event): IpcResult => {
      if (!ffmpegService.isRunning()) {
        const error = 'No FFmpeg process is running.';
        safeReply(event as any, 'ffmpeg-error', error);
        return { success: false, error };
      }

      ffmpegService.stop();
      return { success: true };
    },
  );

  ipcMain.handle('check-ffmpeg-status', () => ffmpegService.checkExists());
}
