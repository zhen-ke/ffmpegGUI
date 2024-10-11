/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { exec } from 'child_process';
import fs from 'fs';
import { execFile } from 'child_process';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

let ffmpegProcess: ReturnType<typeof exec> | null = null;

function getFfmpegPath(): string {
  if (app.isPackaged) {
    // 生产环境
    return path.join(
      process.resourcesPath,
      'binaries',
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    );
  } else {
    // 开发环境
    return path.join(
      process.cwd(),
      'binaries',
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    );
  }
}

// 应用启动时检查 FFmpeg 是否可用
async function checkFfmpeg(): Promise<void> {
  const ffmpegPath = getFfmpegPath();
  log.info('Checking FFmpeg availability...');
  log.info('FFmpeg path:', ffmpegPath);

  try {
    await fs.promises.access(ffmpegPath, fs.constants.X_OK);
  } catch (err) {
    log.error('FFmpeg is not accessible:', err);
    throw new Error(`FFmpeg is not accessible: ${err.message}`);
  }

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, ['-version'], (error, stdout) => {
      if (error) {
        log.error('Error running FFmpeg:', error);
        reject(new Error(`Error running FFmpeg: ${error.message}`));
      } else {
        log.info('FFmpeg version:', stdout.trim());
        resolve();
      }
    });
  });
}

ipcMain.on('start-ffmpeg', async (event, command) => {
  const ffmpegPath = getFfmpegPath();
  let fullCommand = `${ffmpegPath} ${command}`;

  // 解析命令以检查是否有输出文件
  const args = command.split(/\s+/);
  const outputFileIndex = args.findIndex(
    (arg, index) =>
      index > 0 && !arg.startsWith('-') && args[index - 1] !== '-i',
  );

  if (outputFileIndex === -1) {
    // 如果没有找到可能的输出文件，直接执行命令
    executeFFmpegCommand(fullCommand, event);
  } else {
    const outputFile = args[args.length - 1].replace(/^"|"$/g, '');
    // 检查文件是否存在
    if (fs.existsSync(outputFile)) {
      const response = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm Overwrite',
        message: `File '${outputFile}' already exists. Overwrite?`,
      });

      if (response.response === 1) {
        event.reply(
          'ffmpeg-error',
          'Operation cancelled: File not overwritten.',
        );
        return;
      } else {
        // 用户确认覆盖，添加 -y 参数
        fullCommand = `${ffmpegPath} -y ${command}`;
      }
    }

    // 执行 FFmpeg 命令
    executeFFmpegCommand(fullCommand, event, outputFile);
  }
});

function executeFFmpegCommand(
  fullCommand: string,
  event: Electron.IpcMainEvent,
  outputFile?: string,
) {
  const ffmpegProcess = exec(fullCommand, (error, stdout, stderr) => {
    if (error) {
      event.reply('ffmpeg-error', error.message);
    } else {
      if (stdout) {
        stdout.split('\n').forEach((line) => {
          if (line.trim()) {
            event.reply('ffmpeg-output', line);
          }
        });
      }
      event.reply('ffmpeg-complete');

      if (outputFile) {
        // 根据操作系统类型来决定是否需要规范化路径
        const normalizedOutputFile =
          process.platform === 'win32'
            ? outputFile.replace(/\//g, '\\')
            : outputFile;
        // Show dialog after process completes
        dialog
          .showMessageBox(mainWindow!, {
            type: 'info',
            title: 'Conversion Complete',
            message: 'FFmpeg process has completed successfully.',
            buttons: ['OK', 'Open Folder'],
            defaultId: 0,
            cancelId: 0,
          })
          .then((result) => {
            if (result.response === 1) {
              shell.showItemInFolder(normalizedOutputFile);
            }
          });
      }
    }
  });

  ffmpegProcess.stderr?.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach((line) => {
      if (line.trim()) {
        event.reply('ffmpeg-output', line);
      }
    });
    // 解析进度信息
    const progressMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (progressMatch) {
      const [, hours, minutes, seconds] = progressMatch;
      const currentTime =
        parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
      event.reply('ffmpeg-progress', { time: currentTime });
    }

    // 解析总时长信息
    const durationMatch = output.match(
      /Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/,
    );
    if (durationMatch) {
      const [, hours, minutes, seconds] = durationMatch;
      const totalDuration =
        parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
      event.reply('ffmpeg-duration', { duration: totalDuration });
    }
  });

  ffmpegProcess.on('exit', (code) => {
    if (code === 0) {
      event.reply('ffmpeg-complete');
    } else {
      event.reply('ffmpeg-error', `FFmpeg process exited with code ${code}`);
    }
  });
}

ipcMain.on('stop-ffmpeg', () => {
  if (ffmpegProcess) {
    ffmpegProcess.kill();
  }
});

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

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
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
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
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    try {
      await checkFfmpeg();
      createWindow();
      app.on('activate', () => {
        if (mainWindow === null) createWindow();
      });
    } catch (error) {
      log.error('FFmpeg check failed:', error);
      dialog.showErrorBox(
        'FFmpeg Error',
        `FFmpeg is not available: ${error?.message}`,
      );
      app.quit();
    }
  })
  .catch((error) => {
    log.error('Application failed to start:', error);
    dialog.showErrorBox(
      'Startup Error',
      `Application failed to start: ${error?.message}`,
    );
    app.quit();
  });
