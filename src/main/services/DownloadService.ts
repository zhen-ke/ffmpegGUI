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
import { safeReply } from '../utils/ipcUtils';
import {
  getFfmpegPath,
  getManagedFfmpegDirs,
  invalidateFfmpegPathCache,
} from '../utils/pathUtils';
import { invalidateFfprobePathCache } from './MediaProbeService';
import { invalidateHardwareEncoderCache } from './HardwareEncoderService';

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
  if (!Number.isFinite(parsed) || parsed <= 0)
    return MAX_DOWNLOAD_BYTES_DEFAULT;
  return parsed;
}

// ========== DownloadService ==========

/**
 * FFmpeg 下载和安装服务
 */
class DownloadService {
  /**
   * 安装互斥锁：同一时间只允许一个下载安装任务。
   * 否则两个任务会同时写入同一批临时文件，互相覆盖/删除对方数据。
   */
  private activeInstall: Promise<boolean> | null = null;

  /**
   * 下载并安装 FFmpeg。
   *
   * @param url   下载 URL（必须为 http/https）
   * @param event IPC 事件对象，用于向 renderer 推送进度
   * @returns     安装成功返回 true，失败（或已有任务进行中）返回 false
   */
  async downloadAndInstall(url: string, event: IpcMainEvent): Promise<boolean> {
    if (this.activeInstall) {
      safeReply(
        event,
        'ffmpeg-install-error',
        'Another installation is already in progress. Please wait for it to finish.',
      );
      return false;
    }

    this.activeInstall = this.performInstall(url, event);
    try {
      return await this.activeInstall;
    } finally {
      this.activeInstall = null;
    }
  }

  /**
   * 实际的下载安装流程，由 downloadAndInstall 在互斥锁保护下调用。
   */
  private async performInstall(
    url: string,
    event: IpcMainEvent,
  ): Promise<boolean> {
    // 前置校验：在触碰文件系统或网络之前快速失败
    try {
      validateUrl(url);
    } catch (error) {
      safeReply(event, 'ffmpeg-install-error', toError(error).message);
      return false;
    }

    // 每次任务使用独立的临时目录（mkdtemp 随机后缀）：
    // 即使历史任务异常残留，也不会与本任务互相覆盖
    const tempDirs: string[] = [];

    try {
      const tempDir = app.getPath('temp');
      const downloadDir = await fs.promises.mkdtemp(
        path.join(tempDir, 'ffmpeg-download-'),
      );
      tempDirs.push(downloadDir);
      const extractDir = await fs.promises.mkdtemp(
        path.join(tempDir, 'ffmpeg-extract-'),
      );
      tempDirs.push(extractDir);

      // ── 阶段 1：下载 ──────────────────────────────────────
      const fileName = path.basename(new URL(url).pathname) || 'ffmpeg-archive';
      const archivePath = path.join(downloadDir, fileName);

      safeReply(event, 'ffmpeg-download-progress', 0);
      // downloadFile 返回 void，严格写入 archivePath，无需捕获返回值
      await downloadFile(
        url,
        archivePath,
        (progress) => {
          safeReply(event, 'ffmpeg-download-progress', progress);
        },
        { timeoutMs: DOWNLOAD_TIMEOUT_MS, maxBytes: getMaxDownloadBytes() },
      );

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

      // 安装完成，使路径缓存失效确保下次启动时重新探测
      invalidateFfmpegPathCache();
      // ffprobe 通常随 ffmpeg 一同下载，同步失效其探测缓存
      invalidateFfprobePathCache();
      // 新安装的 ffmpeg 可能有不同的硬件编码器，失效探测缓存
      invalidateHardwareEncoderCache();

      console.log('FFmpeg installed successfully to:', ffmpegDestPath);
      safeReply(event, 'ffmpeg-install-complete');
      return true;
    } catch (error) {
      const err = toError(error);
      console.error('FFmpeg installation failed:', err);
      safeReply(event, 'ffmpeg-install-error', err.message);
      return false;
    } finally {
      // 无论成功或失败，始终清理本任务的临时目录
      await Promise.allSettled(tempDirs.map((dir) => removeDir(dir)));
    }
  }

  /**
   * 清理应用自身下载的 FFmpeg 文件，不影响系统已安装的 FFmpeg。
   *
   * @returns 实际删除的目录数量
   */
  async clearManagedInstall(): Promise<number> {
    const dirs = getManagedFfmpegDirs();
    let removedCount = 0;

    for (const dir of dirs) {
      try {
        const stat = await fs.promises.stat(dir);
        if (!stat.isDirectory()) continue;
        await removeDir(dir);
        removedCount += 1;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') continue;
        throw error;
      }
    }

    return removedCount;
  }
}

// 导出单例
export const downloadService = new DownloadService();
