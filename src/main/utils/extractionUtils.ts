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

// ========== zip-slip 防护 ==========

/**
 * 判定归档条目路径解析后是否仍在目标目录内。
 *
 * 统一处理 `/` 与 `\` 分隔符，防御跨平台构造的 zip-slip / 路径穿越条目：
 * 恶意归档可能用 `../` 或绝对路径把文件写到目标目录之外。在解压前逐条目校验，
 * 一旦越界即拒绝，配合“渲染进程可传任意 URL 下载并解压”的链路收敛越界写风险。
 */
function isPathWithinDirectory(entryPath: string, baseDir: string): boolean {
  // 兼容 Windows 风格反斜杠分隔符（恶意归档可能混用两种分隔符）
  const normalized = entryPath.replace(/\\/g, '/');
  const resolvedTarget = path.resolve(baseDir, normalized);
  const resolvedBase = path.resolve(baseDir);
  const rel = path.relative(resolvedBase, resolvedTarget);
  // rel 为空串表示命中基目录本身；
  // 以 ".." + 分隔符开头、或等于 ".."、或为绝对路径，均视为越界
  return (
    rel === '' ||
    (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`))
  );
}

// ========== 内部解压实现 ==========

/**
 * 解压 ZIP 文件，通过 onEntry 回调逐文件上报进度。
 * extract-zip 要求 dir 为绝对路径。
 *
 * 解压前先用 yauzl 扫描所有条目并校验路径不越界（zip-slip 防护），
 * 发现恶意条目直接抛错，阻止后续写入。
 */
async function extractZip(
  source: string,
  destination: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  progressCallback(0);

  const resolvedDestination = path.resolve(destination);

  // 先扫描条目：统计总数的同时逐条校验路径不越界（zip-slip 防护）。
  // 只读 zip 元信息，不写入磁盘；发现越界条目直接抛错，阻止后续解压。
  const totalEntries = await scanZipEntries(source, resolvedDestination);
  let processedEntries = 0;

  await extract(source, {
    dir: resolvedDestination,
    onEntry: () => {
      processedEntries++;
      if (totalEntries > 0) {
        progressCallback(Math.round((processedEntries / totalEntries) * 100));
      }
    },
  });

  progressCallback(100);
}

/**
 * 扫描 zip 条目：统计总数，并逐条校验路径不越出目标目录（zip-slip 防护）。
 * 仅读取归档元信息，不写入磁盘。发现越界条目立即 reject 并关闭归档，阻止解压。
 */
function scanZipEntries(
  zipPath: string,
  destinationDir: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: unknown, zipfile: any) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      let totalEntries = 0;
      let rejected = false;

      zipfile.on('entry', (entry: any) => {
        totalEntries++;
        // zip-slip 防护：条目路径解析后必须仍在目标目录内
        if (!isPathWithinDirectory(entry.fileName, destinationDir)) {
          rejected = true;
          reject(
            new Error(
              `Refusing to extract entry outside target directory: "${entry.fileName}"`,
            ),
          );
          zipfile.close();
          return;
        }
        zipfile.readEntry();
      });

      zipfile.once('end', () => {
        if (!rejected) resolve(totalEntries);
      });
      zipfile.once('error', (e: unknown) => reject(e));

      zipfile.readEntry();
    });
  });
}

/**
 * 解压 7z 文件，通过 node-7z 的 progress 事件上报进度。
 *
 * 逐条目校验路径不越界（zip-slip 防护）：node-7z 在 data 事件里上报每个文件路径，
 * 发现越界条目立即销毁流并 reject，阻止继续解压。
 */
function extractSeven(
  source: string,
  destination: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const resolvedDestination = path.resolve(destination);
    const seven = extractFull(source, destination, {
      $bin: get7zaPath(),
    });

    seven.on('progress', (progress) => {
      progressCallback(progress.percent);
    });

    // zip-slip 防护：7z 逐条目上报路径，校验其不越出目标目录。
    // 发现越界条目立即销毁流并 reject，阻止继续解压。
    seven.on('data', (data: { file: string }) => {
      if (!isPathWithinDirectory(data.file, resolvedDestination)) {
        seven.destroy(
          new Error(
            `Refusing to extract entry outside target directory: "${data.file}"`,
          ),
        );
      }
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
