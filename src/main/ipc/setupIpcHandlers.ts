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
 * 注册所有 IPC 处理器。
 * 使用 getter 函数确保始终获取最新的窗口引用。
 * 任一子模块注册失败时记录错误并继续，确保其余处理器正常可用。
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupAllIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  const handlers: Array<{ name: string; setup: () => void }> = [
    { name: 'FFmpeg',  setup: () => setupFFmpegHandlers(getMainWindow) },
    { name: 'File',    setup: () => setupFileHandlers(getMainWindow) },
    { name: 'Misc',    setup: () => setupMiscHandlers(getMainWindow) },
    { name: 'PTY',     setup: () => setupPtyHandlers(getMainWindow) },
  ];

  for (const { name, setup } of handlers) {
    try {
      setup();
    } catch (error) {
      console.error(`Failed to register ${name} IPC handlers:`, error);
    }
  }
}
