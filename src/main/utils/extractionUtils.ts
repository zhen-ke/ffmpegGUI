/**
 * 文件解压工具
 * 支持 ZIP 和 7z 格式的解压
 */

import extract from 'extract-zip';
import fs from 'fs';
import { extractFull } from 'node-7z';
import path from 'path';
import { get7zaPath } from './pathUtils';

const isWindows = process.platform === 'win32';

/**
 * 使用 7zip 解压文件
 *
 * @param source 源文件路径
 * @param destination 目标目录
 * @param progressCallback 进度回调
 */
export function extractSeven(
  source: string,
  destination: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const seven = extractFull(source, destination, {
      $bin: get7zaPath(),
    });

    seven.on('end', () => {
      progressCallback(100);
      resolve();
    });

    seven.on('error', (err) => {
      console.error('7zip extraction error:', err);
      reject(err);
    });

    seven.on('progress', (progress) => {
      progressCallback(progress.percent);
    });
  });
}

/**
 * 解压归档文件（支持 ZIP 和 7z）
 *
 * @param filePath 归档文件路径
 * @param extractPath 解压目标路径
 * @param progressCallback 进度回调
 * @returns FFmpeg 可执行文件路径
 */
export async function extractArchive(
  filePath: string,
  extractPath: string,
  progressCallback: (progress: number) => void,
): Promise<string> {
  console.log(`Extracting file: ${filePath} to ${extractPath}`);
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.zip') {
      await extract(filePath, { dir: extractPath });
      progressCallback(100);
    } else if (ext === '.7z') {
      await extractSeven(filePath, extractPath, progressCallback);
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`Error during extraction: ${err.message}`);
    throw err;
  }

  const ffmpegName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpegPath = await findFFmpegExecutable(extractPath, ffmpegName);

  if (!ffmpegPath) {
    console.error(`FFmpeg executable not found in: ${extractPath}`);
    throw new Error('FFmpeg executable not found in the extracted files');
  }

  console.log(`FFmpeg executable found at: ${ffmpegPath}`);
  return ffmpegPath;
}

/**
 * 递归查找 FFmpeg 可执行文件
 *
 * @param dir 搜索目录
 * @param fileName 文件名
 * @returns 文件路径，如果未找到则返回 null
 */
export async function findFFmpegExecutable(
  dir: string,
  fileName: string,
): Promise<string | null> {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      const found = await findFFmpegExecutable(
        path.join(dir, file.name),
        fileName,
      );
      if (found) return found;
    } else if (file.name === fileName) {
      return path.join(dir, file.name);
    }
  }
  return null;
}
