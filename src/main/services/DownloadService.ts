/**
 * 下载服务
 * 管理 FFmpeg 的下载、解压和安装
 */

import { app, type IpcMainEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import { extractArchive } from '../utils/extractionUtils';
import {
  downloadFile,
  ensureDir,
  moveFile,
  removeDir,
} from '../utils/fileUtils';
import { getFfmpegPath } from '../utils/pathUtils';

/**
 * FFmpeg 下载和安装服务类
 */
class DownloadService {
  /**
   * 下载并安装 FFmpeg
   *
   * @param url 下载 URL
   * @param event IPC 事件对象
   */
  async downloadAndInstall(url: string, event: IpcMainEvent): Promise<void> {
    const tempDir = app.getPath('temp');
    const downloadPath = path.join(tempDir, 'ffmpeg-download');
    const extractPath = path.join(tempDir, 'ffmpeg-extract');
    const binariesPath = path.dirname(getFfmpegPath());

    try {
      // 创建必要的目录
      await ensureDir(downloadPath);
      await ensureDir(extractPath);
      await ensureDir(binariesPath);

      const fileName = path.basename(url);
      const filePath = path.join(downloadPath, fileName);

      // 下载文件
      event.reply('ffmpeg-download-progress', 0);
      const downloadedFilePath = await downloadFile(
        url,
        filePath,
        (progress) => {
          event.reply('ffmpeg-download-progress', progress);
        },
      );

      // 检查下载的文件是否存在
      if (!fs.existsSync(downloadedFilePath)) {
        throw new Error(`Downloaded file not found: ${downloadedFilePath}`);
      }

      // 解压文件
      event.reply('ffmpeg-extract-progress', 0);
      const ffmpegSourcePath = await extractArchive(
        downloadedFilePath,
        extractPath,
        (progress) => {
          event.reply('ffmpeg-extract-progress', progress);
        },
      );

      // 移动 FFmpeg 到目标位置
      const ffmpegDestPath = getFfmpegPath();
      await ensureDir(path.dirname(ffmpegDestPath));
      await moveFile(ffmpegSourcePath, ffmpegDestPath);

      // 设置执行权限（Mac 和 Linux）
      if (process.platform !== 'win32') {
        await fs.promises.chmod(ffmpegDestPath, '755');
      }

      console.log('FFmpeg installed successfully');
      event.reply('ffmpeg-install-complete');

      // 清理临时文件
      await this.cleanup(downloadPath, extractPath);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error during FFmpeg installation:', err);
      event.reply('ffmpeg-install-error', err.message);

      // 尝试清理临时文件
      try {
        await this.cleanup(downloadPath, extractPath);
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }
  }

  /**
   * 清理临时文件
   */
  private async cleanup(
    downloadPath: string,
    extractPath: string,
  ): Promise<void> {
    await removeDir(downloadPath);
    await removeDir(extractPath);
  }
}

// 导出单例
export const downloadService = new DownloadService();
