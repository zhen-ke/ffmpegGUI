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
import { ffmpegService } from './services/FFmpegController';
import { ptyService } from './services/PtyService';
import { setupAllIpcHandlers } from './ipc/setupIpcHandlers';
import { initLocale } from './locales';

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

  try {
    await installer.default(
      ['REACT_DEVELOPER_TOOLS'].map((name) => installer[name]),
      forceDownload,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Does not start with Cr24')) {
      console.warn(
        'Skipping React DevTools auto-install: downloaded extension package is not a CRX file.',
      );
      return;
    }

    console.warn('Failed to install dev extensions:', message);
  }
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
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'win32' && {
      titleBarOverlay: getTitleBarOverlay(),
    }),
    ...(process.platform === 'darwin' && {
      vibrancy: 'under-window',
      visualEffectState: 'active',
      trafficLightPosition: { x: 20, y: 17 },
    }),
    webPreferences: {
      preload: getPreloadPath(),
      // 显式声明安全基线，不依赖 Electron 默认值（当前默认虽安全，但版本升级可能改变）
      contextIsolation: true,
      nodeIntegration: false,
      // preload 只使用 electron API 与 process.platform/arch，沙箱内均可正常工作
      sandbox: true,
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

/**
 * 终止子进程，并等待 ffmpeg 真正退出后再 resolve。
 *
 * 为什么必须等待：cleanup 发出 SIGTERM 后主进程若立即退出，
 * FFmpegProcessManager 里 2s 的 SIGKILL 兜底定时器会随主进程消亡而失效，
 * ffmpeg 可能成为孤儿进程。ptyService/ffmpegService 的 cleanup 均为幂等，
 * 重复调用安全（无进程运行时是 no-op）。
 */
function cleanupProcesses(): Promise<void> {
  ptyService.cleanup();
  ffmpegService.cleanup();
  // 内部 SIGKILL 兜底为 2s，等待 3s 足以覆盖正常退出路径
  return ffmpegService.waitForExit(3_000);
}

/** 清理完成后真正退出主进程。app.exit 不再触发 before-quit，可避免重入 */
function exitAfterCleanup(): void {
  cleanupProcesses().then(
    () => app.exit(0),
    () => app.exit(0),
  );
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
      initLocale();
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
  if (process.platform === 'darwin') {
    // macOS：窗口全关不退出，但仍需终止子进程（幂等，此处不等待）
    ptyService.cleanup();
    ffmpegService.cleanup();
    return;
  }
  // 等待 ffmpeg 真正退出后再结束主进程，避免孤儿进程
  exitAfterCleanup();
});

if (process.platform === 'darwin') {
  app.on('before-quit', (event) => {
    app.isQuitting = true;
    // 取消本次默认退出，待 ffmpeg 终止后由 exitAfterCleanup 主动 app.exit
    event.preventDefault();
    exitAfterCleanup();
  });
}
