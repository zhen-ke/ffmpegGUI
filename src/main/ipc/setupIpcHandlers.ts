/**
 * IPC 处理器统一注册
 * 集中管理所有 IPC 处理器的注册
 */

import type { BrowserWindow } from 'electron';
import { setupFFmpegHandlers } from './ffmpegHandlers';
import { setupFileHandlers } from './fileHandlers';
import { setupMiscHandlers } from './miscHandlers';
import { setupPtyHandlers } from './ptyHandlers';

/**
 * 注册所有 IPC 处理器
 * 使用 getter 函数确保始终获取最新的窗口引用
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupAllIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  setupFFmpegHandlers(getMainWindow);
  setupFileHandlers(getMainWindow);
  setupMiscHandlers(getMainWindow);
  setupPtyHandlers(getMainWindow);
}
