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
const DEFAULT_APP_STORAGE_DIRNAME = 'ffmpeg-gui';
const LEGACY_STORAGE_DIRNAMES = ['com.zhenke.ffmpeg-gui'];

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
    path.join(
      process.env.ChocolateyInstall ?? 'C:\\ProgramData\\chocolatey',
      'bin',
    ),
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

function normalizeStorageDirname(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || DEFAULT_APP_STORAGE_DIRNAME;
}

function getAppStorageDirname(): string {
  return normalizeStorageDirname(app.getName() || DEFAULT_APP_STORAGE_DIRNAME);
}

/**
 * 获取 FFmpeg 可执行文件的完整路径。
 *
 * - 生产环境：`<cache>/<app-name>/binaries/<ffmpeg>`（可写，且更适合可重新下载的资源）
 * - 开发环境：`<appPath>/binaries/<ffmpeg>`
 *
 * 生产环境不再依赖打包内置 FFmpeg，统一走首次下载流程。
 */
export function getFfmpegPath(): string {
  const base = app.isPackaged
    ? path.join(app.getPath('cache'), getAppStorageDirname())
    : app.getAppPath();
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
 * 获取应用自身管理的 FFmpeg 目录（新目录 + 兼容旧目录）。
 */
export function getManagedFfmpegDirs(): string[] {
  const legacyCacheDirs = app.isPackaged
    ? LEGACY_STORAGE_DIRNAMES.map((dirname) =>
        path.join(app.getPath('cache'), dirname, 'binaries'),
      )
    : [];

  return [
    ...new Set([
      path.dirname(getFfmpegPath()),
      ...legacyCacheDirs,
      path.dirname(getLegacyFfmpegPath()),
    ]),
  ];
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

/**
 * 构建探测 ffmpeg/ffprobe 等可执行文件时使用的环境变量。
 * 将 FFmpeg 搜索目录前置到 PATH，确保打包内置/历史路径优先于系统 PATH。
 */
export function buildProbeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  env.PATH = [...getFfmpegSearchDirs(), process.env.PATH ?? '']
    .filter(Boolean)
    .join(path.delimiter);
  return env;
}

/**
 * 检查文件是否可访问（Windows 仅判断存在，类 Unix 判断存在且可执行）。
 */
export async function canExecute(filePath: string): Promise<boolean> {
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

/**
 * 探测可执行文件是否可用（执行 `<command> -version`，5s 超时）。
 * 通用：可用于 ffmpeg、ffprobe 等任意命令。
 */
export function probeExecutableExists(command: string): Promise<boolean> {
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

/** 路径探测结果缓存：undefined = 还未探测，null = 确认不存在，string = 已确认路径 */
let _cachedFfmpegPath: string | null | undefined = undefined;

/** FFmpeg 版本缓存：undefined = 还未探测，string = 版本号 */
let _cachedFfmpegVersion: string | undefined = undefined;

/**
 * 使 resolveFfmpegPath 缓存失效。
 * 在下载/更新 FFmpeg 二进制后调用，确保下次解析时重新探测。
 * 版本号来自同一二进制，一并失效。
 */
export function invalidateFfmpegPathCache(): void {
  _cachedFfmpegPath = undefined;
  _cachedFfmpegVersion = undefined;
}

/**
 * 解析当前可用的 FFmpeg 路径。
 *
 * 优先级：
 * 1. 当前版本下载到 cache 的 FFmpeg
 * 2. 旧版本遗留在 userData 的 FFmpeg
 * 3. 系统已安装的 FFmpeg（PATH 与常见安装目录）
 *
 * 结果会被缓存；当缓存路径不再可执行时自动失效并重新探测。
 */
export async function resolveFfmpegPath(): Promise<string | null> {
  // 快路径：验证缓存路径仍可用
  if (typeof _cachedFfmpegPath === 'string') {
    if (await canExecute(_cachedFfmpegPath)) {
      return _cachedFfmpegPath;
    }
    // 缓存失效（如重新下载替换了二进制），重新探测
    _cachedFfmpegPath = undefined;
  }

  // 首次探测或缓存失效后重新探测
  const absoluteCandidates = [getFfmpegPath(), getLegacyFfmpegPath()];

  for (const candidate of absoluteCandidates) {
    if (await canExecute(candidate)) {
      _cachedFfmpegPath = candidate;
      return _cachedFfmpegPath;
    }
  }

  const systemCandidates = [
    'ffmpeg',
    ...getFfmpegSearchDirs().map((dir) => path.join(dir, FFMPEG_BIN)),
  ];

  for (const candidate of [...new Set(systemCandidates)]) {
    const isAbsolute = path.isAbsolute(candidate);
    if (isAbsolute && !(await canExecute(candidate))) continue;
    if (await probeExecutableExists(candidate)) {
      _cachedFfmpegPath = candidate;
      return _cachedFfmpegPath;
    }
  }

  _cachedFfmpegPath = null;
  return null;
}

/**
 * 获取当前 FFmpeg 版本号（解析 `ffmpeg -version` 首行，如 `7.1.1`）。
 *
 * 带缓存：路径缓存失效时同步失效（见 invalidateFfmpegPathCache）。
 * 解析失败或未安装返回 null；null 不缓存，下次调用重试。
 */
export async function getFfmpegVersion(): Promise<string | null> {
  if (_cachedFfmpegVersion !== undefined) return _cachedFfmpegVersion;

  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) return null;

  const version = await new Promise<string | null>((resolve) => {
    execFile(
      ffmpegPath,
      ['-version'],
      { timeout: 5_000, windowsHide: true },
      (error, stdout) => {
        const match = error
          ? null
          : stdout.match(/version\s+(\d+(?:\.\d+)*)/);
        resolve(match ? match[1] : null);
      },
    );
  });

  if (version) _cachedFfmpegVersion = version;
  return version;
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
