/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Electron 主进程
 */

import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { ffmpegService } from './services/FFmpegService';
import { terminalService } from './services/TerminalService';
import { setupAllIpcHandlers } from './ipc/setupIpcHandlers';

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

// ========== 环境配置 ==========

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (isDebug) {
  require('electron-debug')();
}

// ========== 自动更新 ==========

function initAutoUpdater(): void {
  log.transports.file.level = 'info';
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();
}

// ========== 窗口配置 ==========

const WIN32_TITLEBAR = {
  dark: { color: '#1E293B', symbolColor: '#ffffff', height: 35 },
  light: { color: '#f0f4f8', symbolColor: '#4a90e2', height: 35 },
};

function getTitleBarOverlay() {
  return nativeTheme.shouldUseDarkColors
    ? WIN32_TITLEBAR.dark
    : WIN32_TITLEBAR.light;
}

// ========== 开发工具 ==========

async function installDevExtensions(): Promise<void> {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  await installer
    .default(
      ['REACT_DEVELOPER_TOOLS'].map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
}

// ========== 窗口管理 ==========

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function getAssetPath(...paths: string[]): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
  return path.join(base, ...paths);
}

function getPreloadPath(): string {
  return app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.join(__dirname, '../../.erb/dll/preload.js');
}

async function createWindow(): Promise<void> {
  if (isDebug) {
    await installDevExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    minWidth: 1024,
    minHeight: 728,
    icon: getAssetPath('icon.png'),
    frame: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'win32' && {
      titleBarOverlay: getTitleBarOverlay(),
    }),
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  // 响应系统主题变化（仅 Windows）
  if (process.platform === 'win32') {
    nativeTheme.on('updated', () => {
      try {
        mainWindow?.setTitleBarOverlay?.(getTitleBarOverlay());
      } catch (error) {
        console.warn('Failed to update title bar overlay:', error);
      }
    });
  }

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.setEnabled(true);
    }
  });

  // macOS：关闭按钮隐藏窗口而非退出
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  new MenuBuilder(mainWindow).buildMenu();
  initAutoUpdater();
}

// ========== 进程清理 ==========

function cleanupProcesses(): void {
  ffmpegService.cleanup();
  terminalService.cleanup();
}

// ========== 单实例锁 ==========

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app
    .whenReady()
    .then(() => {
      setupAllIpcHandlers(getMainWindow);
      createWindow();

      app.on('activate', () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      });
    })
    .catch(console.log);
}

// ========== 应用生命周期 ==========

app.on('window-all-closed', () => {
  cleanupProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

if (process.platform === 'darwin') {
  app.on('before-quit', () => {
    app.isQuitting = true;
    cleanupProcesses();
  });
}
