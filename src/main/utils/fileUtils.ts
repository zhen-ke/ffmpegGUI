/**
 * 文件操作工具函数
 * 提供文件移动、下载等功能
 */

import axios from 'axios';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ExtractError extends Error {
  code?: string;
}

/**
 * 跨设备移动文件
 * 如果是同一设备直接 rename，跨设备则先复制后删除
 *
 * @param source 源文件路径
 * @param destination 目标文件路径
 */
export async function moveFile(
  source: string,
  destination: string,
): Promise<void> {
  try {
    await fs.promises.rename(source, destination);
  } catch (error: unknown) {
    const err = error as ExtractError;
    if (err.code === 'EXDEV') {
      // 跨设备错误，使用复制然后删除的方法
      await fs.promises.copyFile(source, destination);
      await fs.promises.unlink(source);
    } else {
      throw err;
    }
  }
}

/**
 * 确保目录存在，不存在则创建
 *
 * @param dirPath 目录路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * 下载文件
 * 支持 macOS 使用 curl，其他平台使用 axios
 *
 * @param url 下载 URL
 * @param destPath 目标路径
 * @param progressCallback 进度回调
 * @returns 下载后的文件路径
 */
export async function downloadFile(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
): Promise<string> {
  const downloadedFileName =
    process.platform === 'darwin' ? 'ffmpeg-macos.zip' : path.basename(url);
  const downloadedFilePath = path.join(
    path.dirname(destPath),
    downloadedFileName,
  );

  if (process.platform === 'darwin') {
    // macOS 使用 curl 下载
    return downloadWithCurl(url, downloadedFilePath, progressCallback);
  }
  // 其他平台使用 axios
  return downloadWithAxios(url, downloadedFilePath, progressCallback);
}

/**
 * 使用 curl 下载文件（macOS）
 */
function downloadWithCurl(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const tempFileName = 'ffmpeg-temp-download';
    const finalFileName = 'ffmpeg-macos.zip';
    const tempFilePath = path.join(path.dirname(destPath), tempFileName);
    const finalFilePath = path.join(path.dirname(destPath), finalFileName);

    const curlCommand = `curl -L "${url}" -o "${tempFilePath}" -#`;
    const process = exec(curlCommand);

    let lastProgress = 0;

    process.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('#')) {
          const progressMatch = line.match(/(\d+\.\d+)%/);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            if (progress > lastProgress) {
              lastProgress = progress;
              progressCallback(progress);
            }
          }
        }
      }
    });

    process.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.promises.stat(tempFilePath);
          if (stats.size > 0) {
            await fs.promises.rename(tempFilePath, finalFilePath);
            resolve(finalFilePath);
          } else {
            reject(new Error('Downloaded file is empty'));
          }
        } catch (error: unknown) {
          const err = error as Error;
          reject(new Error(`Error processing file: ${err.message}`));
        }
      } else {
        reject(new Error(`Download failed with code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Execution error: ${error.message}`));
    });
  });
}

/**
 * 使用 axios 下载文件
 */
function downloadWithAxios(
  url: string,
  destPath: string,
  progressCallback: (progress: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    axios({
      url,
      method: 'GET',
      responseType: 'stream',
    })
      .then((response) => {
        const totalLength = parseInt(response.headers['content-length'], 10);
        let downloadedLength = 0;

        response.data.on('data', (chunk: Buffer) => {
          downloadedLength += chunk.length;
          const progress = Math.round((downloadedLength / totalLength) * 100);
          progressCallback(progress);
        });

        response.data.pipe(writer);

        writer.on('finish', () => resolve(destPath));
        writer.on('error', (err) => reject(err));
      })
      .catch((err) => reject(err));
  });
}

/**
 * 检查文件是否存在
 *
 * @param filePath 文件路径
 * @returns 是否存在
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
 * 删除目录及其内容
 *
 * @param dirPath 目录路径
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.promises.rm(dirPath, { recursive: true, force: true });
}
