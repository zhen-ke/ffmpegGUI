/**
 * IPC 处理器统一注册
 * 集中管理所有 IPC 处理器的注册
 */

import type { BrowserWindow } from 'electron';
import { setupFFmpegHandlers } from './ffmpegHandlers';
import { setupFileHandlers } from './fileHandlers';
import { setupMiscHandlers } from './miscHandlers';

/**
 * 注册所有 IPC 处理器
 *
 * @param mainWindow 主窗口引用
 */
export function setupAllIpcHandlers(mainWindow: BrowserWindow | null) {
  setupFFmpegHandlers(mainWindow);
  setupFileHandlers(mainWindow);
  setupMiscHandlers(mainWindow);
}
