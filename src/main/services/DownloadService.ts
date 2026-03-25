/**
 * 下载服务
 * 管理 FFmpeg 的下载、解压和安装
 */

import { app, type IpcMainEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import { extractArchive } from '../utils/extractionUtils';
import { downloadFile, ensureDir, moveFile, removeDir } from '../utils/fileUtils';
import { safeReply } from '../utils/ipcUtils';
import { getFfmpegPath } from '../utils/pathUtils';

// ========== 工具函数 ==========

/**
 * 将任意 catch 捕获值规范化为 Error 对象。
 * 直接 `error as Error` 在 reject 传非 Error 值时会导致 `.message` 为 undefined。
 */
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : JSON.stringify(value));
}

/**
 * 校验 URL 是否为合法的 HTTP/HTTPS 地址。
 * 在调用网络层之前提前失败，错误信息更明确。
 */
function validateUrl(url: string): void {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error('Download URL must not be empty.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid download URL: "${trimmed}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Unsupported URL protocol "${parsed.protocol}". Only http and https are allowed.`,
    );
  }
}

const DOWNLOAD_TIMEOUT_MS = 180_000; // 3 分钟
const MAX_DOWNLOAD_BYTES_DEFAULT = 250 * 1024 * 1024; // 250MB

function getMaxDownloadBytes(): number {
  const env = process.env.FFMPEG_GUI_MAX_DOWNLOAD_BYTES;
  if (!env) return MAX_DOWNLOAD_BYTES_DEFAULT;
  const parsed = Number(env);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_DOWNLOAD_BYTES_DEFAULT;
  return parsed;
}

// ========== DownloadService ==========

/**
 * FFmpeg 下载和安装服务
 */
class DownloadService {
  /**
   * 下载并安装 FFmpeg。
   *
   * @param url   下载 URL（必须为 http/https）
   * @param event IPC 事件对象，用于向 renderer 推送进度
   * @returns     安装成功返回 true，失败返回 false
   */
  async downloadAndInstall(url: string, event: IpcMainEvent): Promise<boolean> {
    // 前置校验：在触碰文件系统或网络之前快速失败
    try {
      validateUrl(url);
    } catch (error) {
      safeReply(event, 'ffmpeg-install-error', toError(error).message);
      return false;
    }

    const tempDir = app.getPath('temp');
    const downloadDir = path.join(tempDir, 'ffmpeg-download');
    const extractDir = path.join(tempDir, 'ffmpeg-extract');

    try {
      // 准备临时目录（安装目标目录推迟到 move 前创建，避免失败后留下残留）
      await ensureDir(downloadDir);
      await ensureDir(extractDir);

      // ── 阶段 1：下载 ──────────────────────────────────────
      const fileName = path.basename(new URL(url).pathname) || 'ffmpeg-archive';
      const archivePath = path.join(downloadDir, fileName);

      safeReply(event, 'ffmpeg-download-progress', 0);
      // downloadFile 返回 void，严格写入 archivePath，无需捕获返回值
      await downloadFile(url, archivePath, (progress) => {
        safeReply(event, 'ffmpeg-download-progress', progress);
      }, { timeoutMs: DOWNLOAD_TIMEOUT_MS, maxBytes: getMaxDownloadBytes() });

      // ── 阶段 2：解压 ──────────────────────────────────────
      safeReply(event, 'ffmpeg-extract-progress', 0);
      const ffmpegSourcePath = await extractArchive(
        archivePath,
        extractDir,
        (progress) => {
          safeReply(event, 'ffmpeg-extract-progress', progress);
        },
      );

      // ── 阶段 3：安装 ──────────────────────────────────────
      const ffmpegDestPath = getFfmpegPath();
      const ffmpegDestDir = path.dirname(ffmpegDestPath);

      // 仅在确认解压成功后才创建安装目录
      await ensureDir(ffmpegDestDir);
      await moveFile(ffmpegSourcePath, ffmpegDestPath);

      // 设置执行权限（macOS / Linux）
      if (process.platform !== 'win32') {
        await fs.promises.chmod(ffmpegDestPath, 0o755);
      }

      console.log('FFmpeg installed successfully to:', ffmpegDestPath);
      safeReply(event, 'ffmpeg-install-complete');
      return true;
    } catch (error) {
      const err = toError(error);
      console.error('FFmpeg installation failed:', err);
      safeReply(event, 'ffmpeg-install-error', err.message);
      return false;
    } finally {
      // 无论成功或失败，始终清理临时目录
      await Promise.allSettled([removeDir(downloadDir), removeDir(extractDir)]);
    }
  }
}

// 导出单例
export const downloadService = new DownloadService();
