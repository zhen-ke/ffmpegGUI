/**
 * 路径处理工具函数
 * 提供跨平台的路径处理功能
 */

import sevenBin from '7zip-bin';
import { app } from 'electron';
import path from 'path';

const isWindows = process.platform === 'win32';

/**
 * 获取 FFmpeg 可执行文件路径
 * 根据环境（开发/生产）和平台返回正确的路径
 */
export function getFfmpegPath(): string {
  if (app.isPackaged) {
    // 生产环境
    if (process.platform === 'darwin') {
      return path.join(process.resourcesPath, 'binaries', 'ffmpeg');
    }
    if (isWindows) {
      return path.join(process.resourcesPath, 'binaries', 'ffmpeg.exe');
    }
    // Linux
    return path.join(process.resourcesPath, 'binaries', 'ffmpeg');
  }
  // 开发环境
  return path.join(
    app.getAppPath(),
    'binaries',
    isWindows ? 'ffmpeg.exe' : 'ffmpeg',
  );
}

/**
 * 获取 7za 压缩工具路径
 */
export function get7zaPath(): string {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      '7zip-bin',
      isWindows ? '7za.exe' : '7za',
    );
  }
  return sevenBin.path7za;
}

/**
 * 标准化路径格式
 * 将 Windows 反斜杠转换为正斜杠（FFmpeg 兼容）
 *
 * @param filePath 原始文件路径
 * @returns 标准化后的路径
 */
export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * 获取 FFmpeg 二进制文件目录
 */
export function getFfmpegBinDir(): string {
  return path.dirname(getFfmpegPath());
}

/**
 * 检查是否为 Windows 平台
 */
export function isWindowsPlatform(): boolean {
  return isWindows;
}
