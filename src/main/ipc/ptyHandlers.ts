/**
 * PTY 相关 IPC 处理器
 */

import { ipcMain, type BrowserWindow } from 'electron';
import { ptyService } from '../services/PtyService';

/** 统一的响应结构 */
type IpcResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

/**
 * 注册 PTY 相关的 IPC 处理器。
 * 幂等：重复调用会先移除旧监听器再重新注册。
 *
 * @param getMainWindow 获取主窗口的函数
 */
export function setupPtyHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  // 幂等保护
  ipcMain.removeHandler('pty-start');
  ipcMain.removeHandler('pty-kill');
  ipcMain.removeAllListeners('pty-input');
  ipcMain.removeAllListeners('pty-resize');

  /**
   * 启动 PTY 会话。
   * 若主窗口不可用或 spawn 失败，返回结构化错误供 renderer 处理。
   */
  ipcMain.handle(
    'pty-start',
    (_event, cols: number, rows: number): IpcResult => {
      const win = getMainWindow();
      if (!win) {
        return { success: false, error: 'Main window is not available.' };
      }
      if (win.webContents.isDestroyed()) {
        return { success: false, error: 'Main window has been destroyed.' };
      }
      try {
        ptyService.start(win.webContents, cols, rows);
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start PTY.';
        console.error('PTY start failed:', error);
        return { success: false, error: message };
      }
    },
  );

  /**
   * 向 PTY 写入用户输入。
   * 使用 fire-and-forget（ipcMain.on），输入延迟敏感，不需要等待响应。
   */
  ipcMain.on('pty-input', (_event, data: string) => {
    try {
      ptyService.write(data);
    } catch (error) {
      console.warn('PTY write failed:', error);
    }
  });

  /**
   * 调整 PTY 终端尺寸。
   */
  ipcMain.on('pty-resize', (_event, cols: number, rows: number) => {
    try {
      ptyService.resize(cols, rows);
    } catch (error) {
      console.warn('PTY resize failed:', error);
    }
  });

  /**
   * 终止 PTY 会话。
   * kill() 是幂等的，无论是否有进程在运行都安全调用。
   */
  ipcMain.handle('pty-kill', (): IpcResult => {
    try {
      ptyService.kill();
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to kill PTY.';
      console.error('PTY kill failed:', error);
      return { success: false, error: message };
    }
  });
}
