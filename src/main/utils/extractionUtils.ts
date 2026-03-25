/**
 * 文件解压工具
 * 支持 ZIP 和 7z 格式的解压
 */

import extract from 'extract-zip';
import fs from 'fs';
import { extractFull } from 'node-7z';
import path from 'path';
import { get7zaPath } from './pathUtils';

// yauzl 没有 TypeScript 类型声明；这里使用 as any 避免 TS 编译失败
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yauzl = require('yauzl') as any;

// ========== 常量 ==========

const IS_WINDOWS = process.platform === 'win32';
const FFMPEG_EXECUTABLE = IS_WINDOWS ? 'ffmpeg.exe' : 'ffmpeg';

// ========== 工具函数 ==========

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : JSON.stringify(value));
}

// ========== 内部解压实现 ==========

/**
 * 解压 ZIP 文件，通过 onEntry 回调逐文件上报进度。
 * extract-zip 要求 dir 为绝对路径。
 */
async function extractZip(
  source: string,
  destination: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  progressCallback(0);

  // 先“遍历条目”统计总数：只读 zip 元信息，不把文件写入磁盘
  const totalEntries = await countZipEntries(source);
  let processedEntries = 0;

  await extract(source, {
    dir: path.resolve(destination),
    onEntry: () => {
      processedEntries++;
      if (totalEntries > 0) {
        progressCallback(
          Math.round((processedEntries / totalEntries) * 100),
        );
      }
    },
  });

  progressCallback(100);
}

/**
 * 统计 zip 内条目数（不实际解压写入磁盘）
 * 用于在抽取时计算百分比进度。
 */
function countZipEntries(zipPath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: unknown, zipfile: any) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      let totalEntries = 0;

      zipfile.on('entry', () => {
        totalEntries++;
        zipfile.readEntry();
      });

      zipfile.once('end', () => resolve(totalEntries));
      zipfile.once('error', (e: unknown) => reject(e));

      zipfile.readEntry();
    });
  });
}

/**
 * 解压 7z 文件，通过 node-7z 的 progress 事件上报进度。
 */
function extractSeven(
  source: string,
  destination: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const seven = extractFull(source, destination, {
      $bin: get7zaPath(),
    });

    seven.on('progress', (progress) => {
      progressCallback(progress.percent);
    });

    seven.on('end', () => {
      progressCallback(100);
      resolve();
    });

    seven.on('error', (err) => {
      console.error('7zip extraction error:', err);
      reject(toError(err));
    });
  });
}

// ========== 公共 API ==========

/**
 * 解压归档文件（支持 ZIP 和 7z），返回解压后 FFmpeg 可执行文件的路径。
 *
 * @param filePath         归档文件路径
 * @param extractPath      解压目标目录
 * @param progressCallback 进度回调（0–100）
 * @returns                FFmpeg 可执行文件的绝对路径
 */
export async function extractArchive(
  filePath: string,
  extractPath: string,
  progressCallback: (progress: number) => void,
): Promise<string> {
  console.log(`Extracting: ${filePath} → ${extractPath}`);

  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.zip') {
      await extractZip(filePath, extractPath, progressCallback);
    } else if (ext === '.7z') {
      await extractSeven(filePath, extractPath, progressCallback);
    } else {
      throw new Error(`Unsupported archive format: "${ext}"`);
    }
  } catch (error) {
    const err = toError(error);
    console.error(`Extraction failed: ${err.message}`);
    throw err;
  }

  const ffmpegPath = await findFFmpegExecutable(extractPath, FFMPEG_EXECUTABLE);

  if (!ffmpegPath) {
    throw new Error(
      `FFmpeg executable ("${FFMPEG_EXECUTABLE}") not found in extracted files at: ${extractPath}`,
    );
  }

  console.log(`FFmpeg executable found: ${ffmpegPath}`);
  return ffmpegPath;
}

/**
 * 递归查找指定文件名的可执行文件。
 * 深度优先搜索，找到第一个匹配即返回。
 *
 * @param dir      搜索根目录
 * @param fileName 目标文件名
 * @returns        文件绝对路径，未找到返回 null
 */
async function findFFmpegExecutable(
  dir: string,
  fileName: string,
): Promise<string | null> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    console.warn(`Cannot read directory "${dir}":`, toError(error).message);
    return null;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFFmpegExecutable(fullPath, fileName);
      if (found) return found;
    } else if (entry.name === fileName) {
      return fullPath;
    }
  }

  return null;
}
