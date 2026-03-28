/**
 * 路径处理工具函数
 * 提供跨平台的路径处理功能
 */

import { execFile } from 'child_process';
import fs from 'fs';
import sevenBin from '7zip-bin';
import { app } from 'electron';
import path from 'path';

// ========== 平台常量 ==========

export const IS_WINDOWS = process.platform === 'win32';

/** FFmpeg 可执行文件名（含平台扩展名） */
const FFMPEG_BIN = IS_WINDOWS ? 'ffmpeg.exe' : 'ffmpeg';

/** 7za 可执行文件名（含平台扩展名） */
const SEVENZIP_BIN = IS_WINDOWS ? '7za.exe' : '7za';

const COMMON_FFMPEG_DIRS: Readonly<Record<NodeJS.Platform, string[]>> = {
  darwin: ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin'],
  linux: ['/usr/local/bin', '/usr/bin', '/bin', '/snap/bin'],
  win32: [
    'C:\\ffmpeg\\bin',
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'ffmpeg', 'bin'),
    path.join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'ffmpeg',
      'bin',
    ),
    path.join(process.env.ChocolateyInstall ?? 'C:\\ProgramData\\chocolatey', 'bin'),
  ],
  aix: [],
  freebsd: [],
  openbsd: [],
  sunos: [],
  android: [],
  cygwin: [],
  haiku: [],
  netbsd: [],
};

// ========== 路径工具 ==========

/**
 * 获取 FFmpeg 可执行文件的完整路径。
 *
 * - 生产环境：`<cache>/binaries/<ffmpeg>`（可写，且更适合可重新下载的资源）
 * - 开发环境：`<appPath>/binaries/<ffmpeg>`
 *
 * 生产环境不再依赖打包内置 FFmpeg，统一走首次下载流程。
 */
export function getFfmpegPath(): string {
  const base = app.isPackaged ? app.getPath('cache') : app.getAppPath();
  return path.join(base, 'binaries', FFMPEG_BIN);
}

/**
 * 兼容旧版本：此前 FFmpeg 下载到 userData 目录。
 */
export function getLegacyFfmpegPath(): string {
  const base = app.isPackaged ? app.getPath('userData') : app.getAppPath();
  return path.join(base, 'binaries', FFMPEG_BIN);
}

/**
 * 获取 FFmpeg 二进制文件所在目录。
 */
export function getFfmpegBinDir(): string {
  return path.dirname(getFfmpegPath());
}

/**
 * 获取 FFmpeg 解析时需要补充到 PATH 中的目录。
 */
export function getFfmpegSearchDirs(): string[] {
  const pathEntries = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean);

  const candidates = [
    path.dirname(getFfmpegPath()),
    path.dirname(getLegacyFfmpegPath()),
    ...(COMMON_FFMPEG_DIRS[process.platform] ?? []),
    ...pathEntries,
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function buildProbeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  env.PATH = [...getFfmpegSearchDirs(), process.env.PATH ?? '']
    .filter(Boolean)
    .join(path.delimiter);
  return env;
}

async function canExecute(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(
      filePath,
      IS_WINDOWS ? fs.constants.F_OK : fs.constants.F_OK | fs.constants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

function probeFfmpeg(command: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const child = execFile(command, ['-version'], {
      timeout: 5_000,
      windowsHide: true,
      env: buildProbeEnv(),
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

/**
 * 解析当前可用的 FFmpeg 路径。
 *
 * 优先级：
 * 1. 当前版本下载到 cache 的 FFmpeg
 * 2. 旧版本遗留在 userData 的 FFmpeg
 * 3. 系统已安装的 FFmpeg（PATH 与常见安装目录）
 */
export async function resolveFfmpegPath(): Promise<string | null> {
  const absoluteCandidates = [getFfmpegPath(), getLegacyFfmpegPath()];

  for (const candidate of absoluteCandidates) {
    if (await canExecute(candidate)) {
      return candidate;
    }
  }

  const systemCandidates = [
    'ffmpeg',
    ...getFfmpegSearchDirs().map((dir) => path.join(dir, FFMPEG_BIN)),
  ];

  for (const candidate of [...new Set(systemCandidates)]) {
    const isAbsolute = path.isAbsolute(candidate);
    if (isAbsolute && !(await canExecute(candidate))) continue;
    if (await probeFfmpeg(candidate)) {
      return candidate;
    }
  }

  return null;
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
