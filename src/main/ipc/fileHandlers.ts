/**
 * 文件选择相关 IPC 处理器
 */

import { dialog, ipcMain, type BrowserWindow } from 'electron';
import path from 'path';
import { normalizePath } from '../utils/pathUtils';

/**
 * 注册文件选择相关的 IPC 处理器
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupFileHandlers(
  getMainWindow: () => BrowserWindow | null,
) {
  /**
   * 选择输入文件
   */
  ipcMain.handle('select-input-file', async (event, currentPath) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { canceled: true, filePaths: [] };

    let defaultPath;
    if (currentPath && typeof currentPath === 'string') {
      defaultPath = path.dirname(currentPath);
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Input File',
      defaultPath,
      filters: [
        {
          name: 'Media Files',
          extensions: [
            'mp4',
            'mkv',
            'avi',
            'mov',
            'flv',
            'wmv',
            'mp3',
            'wav',
            'flac',
            'aac',
            'm4a',
          ],
        },
        {
          name: 'Video Files',
          extensions: [
            'mp4',
            'mkv',
            'avi',
            'mov',
            'wmv',
            'flv',
            'webm',
            'ts',
            'm4v',
          ],
        },
        {
          name: 'Audio Files',
          extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
        },
        {
          name: 'Image Files',
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    // 标准化路径格式
    if (!result.canceled && result.filePaths.length > 0) {
      result.filePaths = result.filePaths.map(normalizePath);
    }

    return result;
  });

  /**
   * 选择输出文件夹
   */
  ipcMain.handle('select-output-folder', async (event, currentPath) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { canceled: true, filePaths: [] };

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Output Folder',
      defaultPath: currentPath || undefined,
      properties: ['openDirectory', 'createDirectory'],
    });

    // 标准化路径格式
    if (!result.canceled && result.filePaths.length > 0) {
      result.filePaths = result.filePaths.map(normalizePath);
    }

    return result;
  });
}
