/**
 * 杂项 IPC 处理器
 */

import axios from 'axios';
import { ipcMain, type BrowserWindow } from 'electron';
import { downloadService } from '../services/DownloadService';
import { ffmpegService } from '../services/FFmpegService';

/**
 * 注册杂项相关的 IPC 处理器
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupMiscHandlers(getMainWindow: () => BrowserWindow | null) {
  /**
   * 下载 FFmpeg
   */
  ipcMain.on('download-ffmpeg', async (event, url: string) => {
    const installed = await downloadService.downloadAndInstall(url, event);
    if (!installed) {
      getMainWindow()?.webContents.send('ffmpeg-status', false);
      return;
    }

    const exists = await ffmpegService.checkExists();
    getMainWindow()?.webContents.send('ffmpeg-status', exists);
  });

  /**
   * 获取 OSXExperts 网站 HTML（用于获取 macOS FFmpeg 下载链接）
   */
  ipcMain.handle('fetch-osx-experts-html', async () => {
    try {
      const response = await axios.get('http://www.osxexperts.net/');
      return response.data;
    } catch (error) {
      console.error('Error fetching OSXExperts HTML:', error);
      throw error;
    }
  });
}
