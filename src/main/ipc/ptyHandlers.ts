import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { ptyService } from '../services/PtyService';

export function setupPtyHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('pty-start', (_event, cols: number, rows: number) => {
    const win = getMainWindow();
    if (!win) return { success: false, error: 'No window' };
    ptyService.start(win.webContents, cols, rows);
    return { success: true };
  });

  ipcMain.on('pty-input', (_event, data: string) => {
    ptyService.write(data);
  });

  ipcMain.on('pty-resize', (_event, cols: number, rows: number) => {
    ptyService.resize(cols, rows);
  });

  ipcMain.handle('pty-kill', () => {
    ptyService.kill();
    return { success: true };
  });
}
