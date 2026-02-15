/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Electron 主进程（重构版）
 * 使用模块化的服务和 IPC 处理器
 *
 * 主要改进：
 * - 使用服务类管理 FFmpeg、Terminal、Download
 * - 模块化的 IPC 处理器
 * - 统一的工具函数
 * - 更好的代码组织和可维护性
 */

import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

// 导入服务
import { ffmpegService } from './services/FFmpegService';
import { terminalService } from './services/TerminalService';

// 导入 IPC 处理器注册函数
import { setupAllIpcHandlers } from './ipc/setupIpcHandlers';

// 全局类型声明
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

/**
 * 自动更新类
 */
class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

/**
 * 获取主窗口引用（用于 IPC handlers）
 */
function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// ========== 开发环境配置 ==========

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

// ========== 窗口管理 ==========

/**
 * 处理窗口关闭逻辑
 * macOS: 隐藏窗口而不是退出
 * Windows/Linux: 直接退出
 */
function handleWindowClose() {
  if (!mainWindow) return;

  mainWindow.on('close', (event) => {
    // 只在 macOS 平台实现隐藏窗口的行为
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
    return true;
  });
}

/**
 * 创建主窗口
 */
const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    minWidth: 1024,
    minHeight: 728,
    icon: getAssetPath('icon.png'),
    frame: true,
    titleBarStyle: 'hidden',
    // 根据平台设置标题栏样式
    ...(process.platform === 'win32' && {
      titleBarOverlay: {
        color: nativeTheme.shouldUseDarkColors ? '#1E293B' : '#f0f4f8',
        symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#4a90e2',
        height: 35,
      },
    }),
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    if (process.platform === 'win32' && mainWindow?.setTitleBarOverlay) {
      try {
        mainWindow.setTitleBarOverlay({
          color: nativeTheme.shouldUseDarkColors ? '#1E293B' : '#f0f4f8',
          symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#4a90e2',
          height: 35,
        });
      } catch (error) {
        console.warn('Failed to set title bar overlay:', error);
      }
    }
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.setEnabled(true);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  new AppUpdater();

  // 添加处理窗口关闭的逻辑
  handleWindowClose();
};

// ========== 进程清理 ==========

/**
 * 清理所有子进程
 */
function cleanupProcesses() {
  ffmpegService.cleanup();
  terminalService.cleanup();
}

// ========== 应用生命周期事件 ==========

/**
 * 所有窗口关闭时
 */
app.on('window-all-closed', () => {
  cleanupProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 退出前清理（仅 macOS）
 */
if (process.platform === 'darwin') {
  app.on('before-quit', () => {
    console.log('Application is quitting...');
    app.isQuitting = true;
    cleanupProcesses();
  });
}

/**
 * 单实例锁
 * 确保应用程序只有一个实例
 */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // 当运行第二个实例时，重新激活主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.show();
    }
  });

  // 应用准备就绪
  app
    .whenReady()
    .then(() => {
      // IPC handlers 只注册一次，使用 getter 确保引用最新窗口
      setupAllIpcHandlers(getMainWindow);

      createWindow();

      // 合并后的 activate handler：窗口存在则显示，不存在则重建
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
