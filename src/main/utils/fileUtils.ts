/**
 * 文件操作工具函数
 * 提供文件移动、下载等功能
 */

import { exec } from 'child_process';
import fs from 'fs';

// ========== 类型 ==========

interface NodeError extends Error {
  code?: string;
}

// ========== 文件系统 ==========

/**
 * 跨设备移动文件。
 * 同设备直接 rename；跨设备（EXDEV）先 copy 再 unlink。
 */
export async function moveFile(
  source: string,
  destination: string,
): Promise<void> {
  try {
    await fs.promises.rename(source, destination);
  } catch (error: unknown) {
    const err = error as NodeError;
    if (err.code === 'EXDEV') {
      await fs.promises.copyFile(source, destination);
      await fs.promises.unlink(source);
    } else {
      throw err;
    }
  }
}

/**
 * 确保目录存在，不存在则递归创建。
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * 检查文件是否存在。
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除目录及其全部内容（幂等，目录不存在时不报错）。
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.promises.rm(dirPath, { recursive: true, force: true });
}

// ========== 下载 ==========

/**
 * 下载文件到指定路径。
 *
 * - macOS：使用系统内置 curl，避免引入 axios 依赖
 * - 其他平台：使用 Node.js 内置 fetch（Node 18+）
 *
 * 调用方完全控制目标路径，函数严格写入 `destPath`，不自行重命名。
 *
 * @param url              下载 URL
 * @param destPath         目标文件完整路径（含文件名）
 * @param progressCallback 进度回调，参数为 0–100 的整数
 */
export async function downloadFile(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  if (process.platform === 'darwin') {
    return downloadWithCurl(url, destPath, progressCallback);
  }
  return downloadWithFetch(url, destPath, progressCallback);
}

// ——— curl（macOS）———

/**
 * 使用 curl 下载文件。
 * curl 的进度输出格式（`-#`）：`###...` 每个 `#` 约代表 2%，
 * 使用 `--progress-bar` 配合 stderr 解析更可靠，改用 `-` 格式解析百分比。
 */
function downloadWithCurl(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // --progress-bar 输出形如 `  3.5%` 至 `100.0%`，比 -# 更易解析
    // 使用变量名 `curlProc` 避免与全局 `process` 冲突
    const curlProc = exec(
      `curl -L --progress-bar -o "${destPath}" "${url}"`,
    );

    let lastProgress = 0;

    curlProc.stderr?.on('data', (data: Buffer | string) => {
      const text = data.toString();
      // curl --progress-bar 输出形如 " 23.4%"
      const matches = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)];
      if (matches.length === 0) return;
      const latest = parseFloat(matches[matches.length - 1][1]);
      if (Number.isFinite(latest) && latest > lastProgress) {
        lastProgress = latest;
        progressCallback(Math.round(latest));
      }
    });

    curlProc.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`curl exited with code ${code}`));
        return;
      }
      try {
        const { size } = await fs.promises.stat(destPath);
        if (size === 0) {
          reject(new Error('Downloaded file is empty.'));
        } else {
          progressCallback(100);
          resolve();
        }
      } catch (err) {
        reject(new Error(`Failed to verify downloaded file: ${(err as Error).message}`));
      }
    });

    curlProc.on('error', (err) => {
      reject(new Error(`curl execution error: ${err.message}`));
    });
  });
}

// ——— fetch（Windows / Linux）———

/**
 * 使用内置 fetch 下载文件（Node 18+）。
 * 流式写入，实时上报进度。
 */
async function downloadWithFetch(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading: ${url}`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0');
  const writer = fs.createWriteStream(destPath);
  let downloaded = 0;

  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable.');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await new Promise<void>((resolve, reject) => {
        writer.write(value, (err) => (err ? reject(err) : resolve()));
      });

      downloaded += value.byteLength;
      if (contentLength > 0) {
        progressCallback(Math.round((downloaded / contentLength) * 100));
      }
    }

    await new Promise<void>((resolve, reject) => {
      writer.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });

    progressCallback(100);
  } catch (error) {
    // 确保文件句柄关闭后再抛出
    writer.destroy();
    throw error;
  }
}
