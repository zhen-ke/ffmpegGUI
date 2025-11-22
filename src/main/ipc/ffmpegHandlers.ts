/**
 * FFmpeg 相关 IPC 处理器
 */

import { ipcMain, type BrowserWindow } from 'electron';
import { ffmpegService } from '../services/FFmpegService';

/**
 * 注册 FFmpeg 相关的 IPC 处理器
 *
 * @param mainWindow 主窗口引用
 */
export function setupFFmpegHandlers(mainWindow: BrowserWindow | null) {
  /**
   * 启动 FFmpeg
   */
  ipcMain.on('start-ffmpeg', async (event, command: string) => {
    await ffmpegService.start(command, event, mainWindow);
  });

  /**
   * 停止 FFmpeg
   */
  ipcMain.on('stop-ffmpeg', () => {
    ffmpegService.stop();
  });

  /**
   * 检查 FFmpeg 状态
   */
  ipcMain.handle('check-ffmpeg-status', async () => {
    return await ffmpegService.checkExists();
  });
}
