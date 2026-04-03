/**
 * 文件选择相关 IPC 处理器
 */

import {
  dialog,
  ipcMain,
  shell,
  type BrowserWindow,
  type FileFilter,
  type OpenDialogReturnValue,
} from 'electron';
import fs from 'fs';
import path from 'path';
import { mediaProbeService } from '../services/MediaProbeService';
import { normalizePath } from '../utils/pathUtils';

// ========== 常量 ==========

/**
 * 视频文件扩展名
 */
const VIDEO_EXTENSIONS = [
  'mp4',
  'mkv',
  'avi',
  'mov',
  'wmv',
  'flv',
  'webm',
  'ts',
  'm4v',
  'rmvb',
] as const;

/**
 * 音频文件扩展名
 */
const AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'flac',
  'aac',
  'ogg',
  'm4a',
  'wma',
  'opus',
] as const;

/**
 * 图片文件扩展名
 */
const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'tiff',
] as const;

/**
 * 文件对话框过滤器：输入文件（媒体 + 分类 + 全部）
 * Media Files 由各分类合并而来，保持唯一性。
 */
const INPUT_FILE_FILTERS: FileFilter[] = [
  {
    name: 'Media Files',
    extensions: [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS],
  },
  { name: 'Video Files', extensions: [...VIDEO_EXTENSIONS] },
  { name: 'Audio Files', extensions: [...AUDIO_EXTENSIONS] },
  { name: 'Image Files', extensions: [...IMAGE_EXTENSIONS] },
  { name: 'All Files', extensions: ['*'] },
];

// ========== 工具函数 ==========

/**
 * 将路径字符串提取为对话框 defaultPath。
 * 非字符串或空值统一返回 undefined。
 */
function toDefaultPath(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * 规范化对话框返回结果中的路径列表，返回新对象避免修改只读属性。
 */
function normalizeResult(result: OpenDialogReturnValue): {
  canceled: boolean;
  filePaths: string[];
} {
  return {
    canceled: result.canceled,
    filePaths: result.canceled ? [] : result.filePaths.map(normalizePath),
  };
}

type IpcResult = { success: true } | { success: false; error: string };
type ProbeMediaResult =
  | { success: true; data: Awaited<ReturnType<typeof mediaProbeService.probe>> }
  | { success: false; error: string };

function toResolvedTargetPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  return path.resolve(value.trim());
}

function getExistingContainerPath(targetPath: string): string | null {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    return targetPath;
  }

  const directory = path.dirname(targetPath);
  return fs.existsSync(directory) ? directory : null;
}

// ========== Handler 注册 ==========

/**
 * 注册文件选择相关的 IPC 处理器。
 * 幂等：重复调用会先移除旧处理器再重新注册。
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupFileHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  // 幂等保护
  ipcMain.removeHandler('open-output-file');
  ipcMain.removeHandler('open-output-folder');
  ipcMain.removeHandler('select-input-file');
  ipcMain.removeHandler('select-output-folder');
  ipcMain.removeHandler('check-media-probe-status');
  ipcMain.removeHandler('probe-media');

  ipcMain.handle(
    'open-output-file',
    async (_event, targetPath: unknown): Promise<IpcResult> => {
      const resolvedPath = toResolvedTargetPath(targetPath);
      if (!resolvedPath) {
        return { success: false, error: 'Output file path is required.' };
      }

      if (
        !fs.existsSync(resolvedPath) ||
        fs.statSync(resolvedPath).isDirectory()
      ) {
        return { success: false, error: 'Output file does not exist.' };
      }

      const error = await shell.openPath(resolvedPath);
      return error ? { success: false, error } : { success: true };
    },
  );

  ipcMain.handle(
    'open-output-folder',
    async (_event, targetPath: unknown): Promise<IpcResult> => {
      const resolvedPath = toResolvedTargetPath(targetPath);
      if (!resolvedPath) {
        return { success: false, error: 'Output path is required.' };
      }

      if (
        fs.existsSync(resolvedPath) &&
        !fs.statSync(resolvedPath).isDirectory()
      ) {
        shell.showItemInFolder(resolvedPath);
        return { success: true };
      }

      const containerPath = getExistingContainerPath(resolvedPath);
      if (!containerPath) {
        return { success: false, error: 'Output folder does not exist.' };
      }

      const error = await shell.openPath(containerPath);
      return error ? { success: false, error } : { success: true };
    },
  );

  ipcMain.handle('check-media-probe-status', async () => {
    return mediaProbeService.isAvailable();
  });

  /**
   * 选择输入文件。
   * @param currentPath 当前已选路径，用于定位对话框初始目录（可选）
   */
  ipcMain.handle('select-input-file', async (_event, currentPath: unknown) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return { canceled: true, filePaths: [] };

    const defaultPath =
      typeof currentPath === 'string' && currentPath.trim() !== ''
        ? path.dirname(currentPath)
        : undefined;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Input File',
      defaultPath,
      filters: INPUT_FILE_FILTERS,
      properties: ['openFile'],
    });

    return normalizeResult(result);
  });

  /**
   * 选择输出文件夹。
   * @param currentPath 当前已选路径，用于定位对话框初始目录（可选）
   */
  ipcMain.handle(
    'select-output-folder',
    async (_event, currentPath: unknown) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return { canceled: true, filePaths: [] };

      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Output Folder',
        defaultPath: toDefaultPath(currentPath),
        properties: ['openDirectory', 'createDirectory'],
      });

      return normalizeResult(result);
    },
  );

  ipcMain.handle('probe-media', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
      return {
        success: false,
        error: 'Input file path is required.',
      } satisfies ProbeMediaResult;
    }

    try {
      const result = await mediaProbeService.probe(filePath);
      return { success: true, data: result } satisfies ProbeMediaResult;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to probe media.',
      } satisfies ProbeMediaResult;
    }
  });
}
