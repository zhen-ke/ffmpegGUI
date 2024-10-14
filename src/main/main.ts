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
import axios from 'axios';
import extract from 'extract-zip';
import { extractFull } from 'node-7z';
import sevenBin from '7zip-bin';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

let ffmpegProcess: ReturnType<typeof exec> | null = null;

const get7zaPath = () => {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      '7zip-bin',
      process.platform === 'win32' ? '7za.exe' : '7za',
    );
  }
  return sevenBin.path7za;
};

const extractSeven = (
  source: string,
  destination: string,
  progressCallback: (progress: number) => void,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const seven = extractFull(source, destination, {
      $bin: get7zaPath(),
    });

    seven.on('end', () => {
      progressCallback(100);
      resolve();
    });

    seven.on('error', (err) => {
      console.error('7zip extraction error:', err);
      mainWindow?.webContents.send('main-process-log', {
        type: 'error',
        message: `7zip extraction error: ${err.message}`,
      });
      reject(err);
    });

    seven.on('progress', (progress) => {
      progressCallback(progress.percent);
    });
  });
};

async function extractArchive(
  filePath: string,
  extractPath: string,
  progressCallback: (progress: number) => void,
): Promise<string> {
  console.log(`Extracting file: ${filePath} to ${extractPath}`);
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.zip') {
      await extract(filePath, { dir: extractPath });
      progressCallback(100);
    } else if (ext === '.7z') {
      await extractSeven(filePath, extractPath, progressCallback);
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }
  } catch (error) {
    console.error(`Error during extraction: ${error.message}`);
    throw error;
  }

  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpegPath = await findFFmpegExecutable(extractPath, ffmpegName);

  if (!ffmpegPath) {
    console.error(`FFmpeg executable not found in: ${extractPath}`);
    throw new Error('FFmpeg executable not found in the extracted files');
  }

  console.log(`FFmpeg executable found at: ${ffmpegPath}`);
  return ffmpegPath;
}

async function findFFmpegExecutable(
  dir: string,
  fileName: string,
): Promise<string | null> {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      const found = await findFFmpegExecutable(
        path.join(dir, file.name),
        fileName,
      );
      if (found) return found;
    } else if (file.name === fileName) {
      return path.join(dir, file.name);
    }
  }
  return null;
}

async function moveFile(source: string, destination: string): Promise<void> {
  try {
    await fs.promises.rename(source, destination);
  } catch (error) {
    if (error.code === 'EXDEV') {
      // 如果是跨设备错误，则使用复制然后删除的方法
      await fs.promises.copyFile(source, destination);
      await fs.promises.unlink(source);
    } else {
      throw error;
    }
  }
}

async function downloadFile(
  url: string,
  filePath: string,
  progressCallback: (progress: number) => void,
): Promise<string> {
  const downloadedFileName =
    process.platform === 'darwin' ? 'ffmpeg-macos.zip' : path.basename(url);
  const downloadedFilePath = path.join(
    path.dirname(filePath),
    downloadedFileName,
  );

  if (process.platform === 'darwin') {
    console.log('Starting Mac FFmpeg download');
    return new Promise<string>((resolve, reject) => {
      const tempFileName = 'ffmpeg-temp-download';
      const finalFileName = 'ffmpeg-macos.zip';
      const tempFilePath = path.join(path.dirname(filePath), tempFileName);
      const finalFilePath = path.join(path.dirname(filePath), finalFileName);

      console.log(`Downloading to temporary file: ${tempFilePath}`);

      // 使用 -# 选项来获取进度条输出
      const curlCommand = `curl -L "${url}" -o "${tempFilePath}" -#`;
      const process = exec(curlCommand);

      let lastProgress = 0;

      process.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.includes('#')) {
            const progressMatch = line.match(/(\d+\.\d+)%/);
            if (progressMatch) {
              const progress = parseFloat(progressMatch[1]);
              if (progress > lastProgress) {
                lastProgress = progress;
                progressCallback(progress);
              }
            }
          } else {
            console.log(`curl output: ${line}`);
          }
        }
      });

      process.on('close', async (code) => {
        if (code === 0) {
          try {
            const stats = await fs.promises.stat(tempFilePath);
            if (stats.size > 0) {
              await fs.promises.rename(tempFilePath, finalFilePath);
              console.log(`File renamed successfully: ${finalFilePath}`);
              resolve(finalFilePath);
            } else {
              reject(new Error('Downloaded file is empty'));
            }
          } catch (error) {
            reject(new Error(`Error processing file: ${error.message}`));
          }
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Execution error: ${error.message}`));
      });
    });
  } else {
    return new Promise<string>((resolve, reject) => {
      const writer = fs.createWriteStream(downloadedFilePath);
      axios({
        url,
        method: 'GET',
        responseType: 'stream',
      })
        .then((response) => {
          const totalLength = parseInt(response.headers['content-length'], 10);
          let downloadedLength = 0;

          response.data.on('data', (chunk: Buffer) => {
            downloadedLength += chunk.length;
            const progress = Math.round((downloadedLength / totalLength) * 100);
            progressCallback(progress);
          });

          response.data.pipe(writer);

          writer.on('finish', () => resolve(downloadedFilePath));
          writer.on('error', (err) => reject(err));
        })
        .catch((err) => reject(err));
    });
  }
}

function getFfmpegPath(): string {
  if (app.isPackaged) {
    // 生产环境
    if (process.platform === 'darwin') {
      // Mac OS
      return path.join(app.getAppPath(), '..', 'binaries', 'ffmpeg');
    } else if (process.platform === 'win32') {
      // Windows
      return path.join(process.resourcesPath, 'binaries', 'ffmpeg.exe');
    } else {
      // Linux 或其他平台
      return path.join(process.resourcesPath, 'binaries', 'ffmpeg');
    }
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
async function checkFFmpegExists(): Promise<boolean> {
  const ffmpegPath = getFfmpegPath();
  try {
    await fs.promises.access(ffmpegPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
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
    // 如果没有找到可能的输出文件，直接执行命
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

ipcMain.on('download-ffmpeg', async (event, url: string) => {
  try {
    const tempDir = app.getPath('temp');
    const downloadPath = path.join(tempDir, 'ffmpeg-download');
    const extractPath = path.join(tempDir, 'ffmpeg-extract');
    const binariesPath = path.dirname(getFfmpegPath()); // 使用 getFfmpegPath 来确定正确的安装路径

    // 确保目录存在
    await fs.promises.mkdir(downloadPath, { recursive: true });
    await fs.promises.mkdir(extractPath, { recursive: true });
    await fs.promises.mkdir(binariesPath, { recursive: true });

    const fileName = path.basename(url);
    const filePath = path.join(downloadPath, fileName);

    // 下载文件
    event.reply('ffmpeg-download-progress', 0);
    const downloadedFilePath = await downloadFile(url, filePath, (progress) => {
      event.reply('ffmpeg-download-progress', progress);
    });

    // 检查下载的文件是否存在
    if (!fs.existsSync(downloadedFilePath)) {
      throw new Error(`Downloaded file not found: ${downloadedFilePath}`);
    }

    // 解压文件
    event.reply('ffmpeg-extract-progress', 0);
    const ffmpegSourcePath = await extractArchive(
      downloadedFilePath,
      extractPath,
      (progress) => {
        console.log(`Extraction progress: ${progress}%`);
        event.reply('ffmpeg-extract-progress', progress);
      },
    );

    console.log('Extraction completed');

    // 移动 FFmpeg 到正确的 binaries 目录
    const ffmpegDestPath = getFfmpegPath(); // 使用之前定义的 getFfmpegPath 函数
    await fs.promises.mkdir(path.dirname(ffmpegDestPath), { recursive: true });
    await moveFile(ffmpegSourcePath, ffmpegDestPath);

    // 设置执行权限（对于 Mac 和 Linux）
    if (process.platform !== 'win32') {
      await fs.promises.chmod(ffmpegDestPath, '755');
    }

    console.log('FFmpeg installed successfully');
    event.reply('ffmpeg-install-complete');

    // 更新 FFmpeg 状态
    mainWindow?.webContents.send('ffmpeg-status', true);
    // 清理临时文件
    await fs.promises.rm(downloadPath, { recursive: true, force: true });
    await fs.promises.rm(extractPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Error during FFmpeg installation:', error);
    event.reply('ffmpeg-install-error', error.message);
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

  // 检查 FFmpeg 是否存在
  const ffmpegExists = await checkFFmpegExists();

  // 等待页面加载完成后发送 FFmpeg 状态
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('ffmpeg-status', ffmpegExists);
  });

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
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
