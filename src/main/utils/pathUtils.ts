/**
 * 路径处理工具函数
 * 提供跨平台的路径处理功能
 */

import sevenBin from '7zip-bin';
import { app } from 'electron';
import path from 'path';

// ========== 平台常量 ==========

export const IS_WINDOWS = process.platform === 'win32';

/** FFmpeg 可执行文件名（含平台扩展名） */
const FFMPEG_BIN = IS_WINDOWS ? 'ffmpeg.exe' : 'ffmpeg';

/** 7za 可执行文件名（含平台扩展名） */
const SEVENZIP_BIN = IS_WINDOWS ? '7za.exe' : '7za';

// ========== 路径工具 ==========

/**
 * 获取 FFmpeg 可执行文件的完整路径。
 *
 * - 生产环境：`<resourcesPath>/binaries/<ffmpeg>`
 * - 开发环境：`<appPath>/binaries/<ffmpeg>`
 *
 * macOS 与 Linux 生产路径相同，无需分支。
 */
export function getFfmpegPath(): string {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(base, 'binaries', FFMPEG_BIN);
}

/**
 * 获取 FFmpeg 二进制文件所在目录。
 */
export function getFfmpegBinDir(): string {
  return path.dirname(getFfmpegPath());
}

/**
 * 获取 7za 压缩工具的完整路径。
 *
 * - 生产环境：打包时需将 7zip-bin 内容复制到 `<resourcesPath>/7zip-bin/`
 * - 开发环境：直接使用 `7zip-bin` 包提供的路径
 */
export function get7zaPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, '7zip-bin', SEVENZIP_BIN);
  }
  return sevenBin.path7za;
}

/**
 * 将路径中的反斜杠统一转换为正斜杠，确保 FFmpeg 命令行兼容性。
 * 仅在 Windows 上执行转换，其他平台直接返回原值。
 *
 * @param filePath 原始文件路径
 * @returns        正斜杠格式的路径
 */
export function normalizePath(filePath: string): string {
  return IS_WINDOWS ? filePath.replaceAll('\\', '/') : filePath;
}
