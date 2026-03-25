/**
 * 杂项 IPC 处理器
 */

import { ipcMain, type BrowserWindow } from 'electron';
import { downloadService } from '../services/DownloadService';
import { ffmpegService } from '../services/FFmpegController';

/** OSXExperts 页面地址，使用 HTTPS 防止中间人篡改下载链接 */
const OSX_EXPERTS_URL = 'https://www.osxexperts.net/';

/** 请求超时（毫秒） */
const FETCH_TIMEOUT_MS = 15_000;

/** 允许的最大响应体（字节），防止异常大响应撑爆内存 */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * 注册杂项相关的 IPC 处理器。
 * 幂等：重复调用会先移除旧监听器再重新注册。
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupMiscHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  // 幂等保护
  ipcMain.removeAllListeners('download-ffmpeg');
  ipcMain.removeHandler('fetch-osx-experts-html');

  /**
   * 下载并安装 FFmpeg，完成后通知 renderer 最新状态。
   * 安装失败时由 downloadService 内部发送 `ffmpeg-install-error`，
   * 此处无需重复发送错误状态。
   */
  ipcMain.on('download-ffmpeg', async (event, url: string) => {
    const installed = await downloadService.downloadAndInstall(url, event);
    if (!installed) return;

    const exists = await ffmpegService.checkExists();
    getMainWindow()?.webContents.send('ffmpeg-status', exists);
  });

  /**
   * 获取 OSXExperts 页面 HTML，供 renderer 解析 macOS FFmpeg 下载链接。
   * 使用内置 fetch（Node 18+），设置超时与响应大小上限。
   */
  ipcMain.handle('fetch-osx-experts-html', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(OSX_EXPERTS_URL, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch OSXExperts page: HTTP ${response.status}`,
        );
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) {
        throw new Error(
          `Response too large: ${contentLength} bytes exceeds limit of ${MAX_RESPONSE_BYTES} bytes.`,
        );
      }

      return await response.text();
    } catch (error) {
      console.error('Error fetching OSXExperts HTML:', error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  });
}
