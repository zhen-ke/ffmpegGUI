/**
 * 文件操作工具函数
 * 提供文件移动、下载等功能
 */

import { spawn } from 'child_process';
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

export interface DownloadOptions {
  /** 超时时间（毫秒），超过则中止下载 */
  timeoutMs?: number;
  /** 最大允许下载字节数（不含解压），超过则中止下载 */
  maxBytes?: number;
}

/**
 * 下载文件到指定路径。
 *
 * - macOS：使用系统内置 curl，跨平台无需额外 HTTP 依赖
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
  options: DownloadOptions = {},
): Promise<void> {
  if (process.platform === 'darwin') {
    return downloadWithCurl(url, destPath, progressCallback, options);
  }
  return downloadWithFetch(url, destPath, progressCallback, options);
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
  options: DownloadOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 用 spawn + 参数数组，不经过 shell：
    // URL/路径中的 `$()`、反引号、引号等不会被解释，从根本上避免 shell 注入；
    // 同时每个参数独立传递，含空格也无需手动加引号
    // 弱网重试 + 断点续传：连接被拒/超时/HTTP 5xx 时 curl 自动重试最多 3 次，
    // 每次复用已下载的本地部分文件（-C -）继续，避免整包重下。
    const args: string[] = [
      '-L',
      '--progress-bar',
      '--fail',
      '--retry', '3',
      '--retry-delay', '2',
      '--retry-connrefused',
      '-C', '-',
    ];

    // curl 的 --max-time 单位为秒
    if (options.timeoutMs && options.timeoutMs > 0) {
      const timeoutSeconds = Math.ceil(options.timeoutMs / 1000);
      args.push('--max-time', String(timeoutSeconds));
    }

    if (options.maxBytes && options.maxBytes > 0) {
      args.push('--max-filesize', String(Math.floor(options.maxBytes)));
    }

    args.push('-o', destPath, url);

    // --progress-bar 输出形如 `  3.5%` 至 `100.0%`，比 -# 更易解析
    // 使用变量名 `curlProc` 避免与全局 `process` 冲突
    const curlProc = spawn('curl', args);

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

// ——— fetch（Windows / Linux）———

const MAX_DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

/** 不可重试的 HTTP 客户端错误（4xx），携带状态码供重试循环判定 */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 使用内置 fetch 下载文件（Node 18+）。
 *
 * 带重试与断点续传：
 * - 最多重试 MAX_DOWNLOAD_ATTEMPTS 次，每次间隔 RETRY_DELAY_MS；
 * - 若本地存在部分文件，发送 Range 请求续传，追加写入；
 * - 4xx 客户端错误不重试（重试无意义），超时/连接断开/5xx 重试。
 *
 * @param url              下载 URL
 * @param destPath         目标文件完整路径（含文件名）
 * @param progressCallback 进度回调，参数为 0–100 的整数
 * @param options          超时与最大字节数
 */
async function downloadWithFetch(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
  options: DownloadOptions,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      await downloadWithFetchAttempt(url, destPath, progressCallback, options);
      return;
    } catch (error) {
      lastError = error;
      // 4xx 客户端错误不重试；超时/连接断开/5xx 才重试
      if (
        error instanceof HttpError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        break;
      }
      if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Download failed after retries.');
}

/**
 * 单次下载尝试：支持断点续传。
 * 由 downloadWithFetch 在重试循环中调用，复用同一 destPath，使续传生效。
 */
async function downloadWithFetchAttempt(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
  options: DownloadOptions,
): Promise<void> {
  // 断点续传：探测已下载部分的大小
  let resumeFrom = 0;
  try {
    const stat = await fs.promises.stat(destPath);
    resumeFrom = stat.size;
  } catch {
    // 无部分文件，从头下载
  }

  const controller = new AbortController();
  const timer =
    options.timeoutMs && options.timeoutMs > 0
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

  try {
    const headers =
      resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : undefined;
    const response = await fetch(url, { signal: controller.signal, headers });

    // 416：本地已下载完整文件，服务器报告范围越界 → 视为完成
    if (response.status === 416 && resumeFrom > 0) {
      progressCallback(100);
      return;
    }

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `HTTP ${response.status} while downloading: ${url}`,
      );
    }

    // 206 = 服务器接受 Range 续传；200 = 忽略 Range，整包重传
    const serverHonoredRange = response.status === 206;
    const startByte = serverHonoredRange ? resumeFrom : 0;
    // 服务器忽略 Range 时覆盖写，接受 Range 时追加写
    const writer = fs.createWriteStream(destPath, {
      flags: serverHonoredRange ? 'a' : 'w',
    });
    let downloaded = 0;

    try {
      // content-length：206 时为本“剩余”字节数，200 时为整包字节数
      const remaining =
        Number(response.headers.get('content-length') ?? '0') || 0;
      const totalExpected = startByte + remaining;

      if (
        options.maxBytes &&
        options.maxBytes > 0 &&
        totalExpected > 0 &&
        totalExpected > options.maxBytes
      ) {
        controller.abort();
        throw new Error(
          `Download exceeds maxBytes: total=${totalExpected}, maxBytes=${options.maxBytes}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable.');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await new Promise<void>((resolve, reject) => {
          writer.write(value, (err) => (err ? reject(err) : resolve()));
        });

        downloaded += value.byteLength;
        const totalSoFar = startByte + downloaded;

        if (
          options.maxBytes &&
          options.maxBytes > 0 &&
          totalSoFar > options.maxBytes
        ) {
          controller.abort();
          throw new Error(
            `Download exceeds maxBytes: downloaded=${totalSoFar}, maxBytes=${options.maxBytes}`,
          );
        }

        if (totalExpected > 0) {
          progressCallback(Math.round((totalSoFar / totalExpected) * 100));
        }
      }

      await new Promise<void>((resolve, reject) => {
        writer.end((err?: Error | null) => (err ? reject(err) : resolve()));
      });

      progressCallback(100);
    } catch (error) {
      writer.destroy();
      throw error;
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}
