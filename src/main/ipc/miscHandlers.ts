/**
 * 终端和其他杂项 IPC 处理器
 */

import axios from 'axios';
import { ipcMain, type BrowserWindow } from 'electron';
import { downloadService } from '../services/DownloadService';
import { ffmpegService } from '../services/FFmpegService';
import { terminalService } from '../services/TerminalService';

/**
 * 注册终端和其他相关的 IPC 处理器
 *
 * @param mainWindow 主窗口引用
 */
export function setupMiscHandlers(mainWindow: BrowserWindow | null) {
  /**
   * 打开终端
   */
  ipcMain.handle('open-terminal', async () => {
    return await terminalService.open(mainWindow);
  });

  /**
   * 下载 FFmpeg
   */
  ipcMain.on('download-ffmpeg', async (event, url: string) => {
    const installed = await downloadService.downloadAndInstall(url, event);
    if (!installed) {
      mainWindow?.webContents.send('ffmpeg-status', false);
      return;
    }

    const exists = await ffmpegService.checkExists();
    mainWindow?.webContents.send('ffmpeg-status', exists);
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

  /**
   * IPC 示例（保留用于测试）
   */
  ipcMain.on('ipc-example', async (event, arg) => {
    const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    event.reply('ipc-example', msgTemplate('pong'));
  });
}
