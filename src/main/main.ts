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
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  Notification,
  nativeTheme,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { ChildProcess, spawn, exec, execFile } from 'child_process';
import fs from 'fs';
import axios from 'axios';
import extract from 'extract-zip';
import { extractFull } from 'node-7z';
import sevenBin from '7zip-bin';

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

interface ExtractError extends Error {
  code?: string;
}

interface FFmpegProgress {
  time: number;
}

interface FFmpegDuration {
  duration: number;
}

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

let ffmpegProcess: ChildProcess | null = null;

let terminalProcess: ChildProcess | null = null;

let terminalStarted = false;

const isWindows = process.platform === 'win32';

const get7zaPath = () => {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      '7zip-bin',
      isWindows ? '7za.exe' : '7za',
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`Error during extraction: ${err.message}`);
    throw err;
  }

  const ffmpegName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
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
  } catch (error: unknown) {
    const err = error as ExtractError;
    if (err.code === 'EXDEV') {
      // 如果是跨设备错误，则使用复制然后删除的方法
      await fs.promises.copyFile(source, destination);
      await fs.promises.unlink(source);
    } else {
      throw err;
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
          } catch (error: unknown) {
            const err = error as Error;
            reject(new Error(`Error processing file: ${err.message}`));
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
      return path.join(process.resourcesPath, 'binaries', 'ffmpeg');
    } else if (isWindows) {
      // Windows
      return path.join(process.resourcesPath, 'binaries', 'ffmpeg.exe');
    } else {
      // Linux 或其他平台
      return path.join(process.resourcesPath, 'binaries', 'ffmpeg');
    }
  } else {
    // 开发环境
    return path.join(
      app.getAppPath(),
      'binaries',
      isWindows ? 'ffmpeg.exe' : 'ffmpeg',
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

function parseFFmpegCommand(command: string): string[] {
  const args: string[] = [];
  let currentArg = '';
  let inQuotes = false;
  let escapeNext = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escapeNext) {
      currentArg += char;
      escapeNext = false;
    } else if (char === '\\') {
      if (i + 1 < command.length && command[i + 1] === '"') {
        currentArg += '"';
        i++;
      } else {
        currentArg += char;
      }
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (currentArg) {
        args.push(currentArg);
        currentArg = '';
      }
    } else {
      currentArg += char;
    }
  }

  if (currentArg) {
    args.push(currentArg);
  }

  // 处理路径
  return args.map((arg) => {
    // 如果是选项标志，直接返回
    if (arg.startsWith('-')) return arg;

    // 如果路径包含空格且没有被引号包围，添加引号
    if (arg.includes(' ') && !arg.startsWith('"')) {
      return `"${arg}"`;
    }

    return arg;
  });
}

function executeFFmpegCommand(
  command: string,
  event: Electron.IpcMainEvent,
  outputFile?: string,
) {
  const ffmpegPath = `"${getFfmpegPath()}"`; // 用引号括起来 FFmpeg 路径
  const args = parseFFmpegCommand(command);

  console.log('FFmpeg path:', ffmpegPath);
  console.log('Parsed FFmpeg arguments:', args);

  // 检查文件是否存在
  if (outputFile && fs.existsSync(outputFile)) {
    dialog
      .showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm Overwrite',
        message: `File '${outputFile}' already exists. Overwrite?`,
      })
      .then((response) => {
        if (response.response === 1) {
          // 用户选择 "No"
          event.reply(
            'ffmpeg-error',
            'Operation cancelled: File not overwritten.',
          );
          return;
        } else {
          // 用户选择 "Yes"，添加 -y 参数并执行命令
          args.unshift('-y');
          runFFmpegCommand(ffmpegPath, args, event, outputFile);
        }
      });
  } else {
    // 文件不存在，直接执行命令
    runFFmpegCommand(ffmpegPath, args, event, outputFile);
  }
}

function runFFmpegCommand(
  ffmpegPath: string,
  args: string[],
  event: Electron.IpcMainEvent,
  outputFile?: string,
) {
  // 构建完整的命令字符串
  const fullCommand = `${ffmpegPath} ${args.join(' ')}`;

  ffmpegProcess = spawn(fullCommand, [], { shell: true });

  ffmpegProcess.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log('FFmpeg stdout:', output);
      // 只有当输出非空时才发送到渲染进程
      event.reply('ffmpeg-output', `${output}`);
    }
  });

  ffmpegProcess.stderr?.on('data', (data: Buffer) => {
    const output = data.toString();
    output.split('\n').forEach((line: string) => {
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
      const progress: FFmpegProgress = { time: currentTime };
      event.reply('ffmpeg-progress', progress);
    }

    // 解析总时长信息
    const durationMatch = output.match(
      /Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/,
    );
    if (durationMatch) {
      const [, hours, minutes, seconds] = durationMatch;
      const totalDuration =
        parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
      const duration: FFmpegDuration = { duration: totalDuration };
      event.reply('ffmpeg-duration', duration);
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log('FFmpeg process closed with code:', code);
    if (code === 0) {
      event.reply('ffmpeg-complete');

      if (outputFile) {
        // 创建系统通知
        const notification = new Notification({
          title: 'FFmpeg Process Complete',
          body: 'The FFmpeg process has completed successfully.',
          silent: false,
          sound: process.platform === 'darwin' ? 'Ping' : undefined, // macOS 特有的通知声音
        });

        // 当用户点击通知或选择操作时打开输出文件夹
        notification.on('click', () => {
          shell.showItemInFolder(outputFile);
        });

        // 显示通知
        notification.show();
      }
    } else {
      event.reply('ffmpeg-error', `FFmpeg process exited with code ${code}`);
    }
  });

  ffmpegProcess.on('error', (err) => {
    console.error('FFmpeg process error:', err);
    event.reply('ffmpeg-error', `FFmpeg process error: ${err.message}`);
  });
}

ipcMain.on('start-ffmpeg', async (event, command) => {
  try {
    // 检查命令是否为空
    if (!command) {
      event.reply(
        'ffmpeg-error',
        'Empty command. Please provide a valid FFmpeg command.',
      );
      return;
    }

    const args = parseFFmpegCommand(command);

    // 查找可能的输出文件
    let outputFile: string | undefined;
    for (let i = args.length - 1; i >= 0; i--) {
      if (!args[i].startsWith('-') && i > 0 && args[i - 1] !== '-i') {
        outputFile = args[i].replace(/^"|"$/g, '').trim(); // 移除引号和多余的空白字符
        break;
      }
    }

    executeFFmpegCommand(command, event, outputFile);
  } catch (error) {
    console.error('Error processing FFmpeg command:', error);
    event.reply('ffmpeg-error', `Error processing command: ${error.message}`);
  }
});

ipcMain.on('stop-ffmpeg', () => {
  if (ffmpegProcess && ffmpegProcess.stdin) {
    ffmpegProcess.stdin.write('q');

    // 设置一个超时，如果 FFmpeg 没有在 5 秒内退出，则强制终止
    setTimeout(() => {
      if (ffmpegProcess) {
        console.warn('FFmpeg did not exit gracefully, force killing...');
        ffmpegProcess.kill('SIGKILL');
      }
    }, 5000);
  } else {
    console.warn('No FFmpeg process to stop or stdin is not available');
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error during FFmpeg installation:', err);
    event.reply('ffmpeg-install-error', err.message);
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

// 处理窗口隐藏和显示的逻辑
function handleWindowHideShow() {
  if (!mainWindow) return;

  // 处理窗口关闭按钮点击事件
  mainWindow.on('close', (event) => {
    // 只在 macOS 平台实现隐藏窗口的行为
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
    // Windows 和 Linux 平台直接关闭退出
    return true;
  });

  // 处理 dock 图标点击（仅 macOS）
  if (process.platform === 'darwin') {
    app.on('activate', () => {
      mainWindow?.show();
    });
  }
}

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
    // 检查平台和方法是否可用
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

  // IPC 监听器来处理 FFmpeg 状态请求
  ipcMain.handle('check-ffmpeg-status', async () => {
    const ffmpegExists = await checkFFmpegExists();
    return ffmpegExists;
  });

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
  // eslint-disable-next-line
  new AppUpdater();

  // 添加处理窗口隐藏和显示的逻辑
  handleWindowHideShow();
};

/**
 * Add event listeners...
 */

// 修改 window-all-closed 事件处理
app.on('window-all-closed', () => {
  cleanupProcesses();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在退出前设置 isQuitting 标志（仅 macOS 需要）
if (process.platform === 'darwin') {
  app.on('before-quit', () => {
    console.log('Application is quitting...');
    app.isQuitting = true;
    cleanupProcesses();
  });
}

// 确保应用程序只有一个实例
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

  // 原有的 app.whenReady() 部分保持不变
  app
    .whenReady()
    .then(() => {
      createWindow();
      app.on('activate', () => {
        if (mainWindow === null) createWindow();
      });
    })
    .catch(console.log);
}

// 在文件顶部添加新的变量来跟踪终端窗口
let terminalWindowId: string | null = null;

// 修改 openTerminalAtPath 函数
function openTerminalAtPath(dirPath: string) {
  switch (process.platform) {
    case 'darwin': {
      try {
        // 转义路径中的特殊字符
        const escapedPath = dirPath.replace(/"/g, '\\"');

        // 构建 FFmpeg 命令，使用单引号避免过度转义
        const ffmpegCommand = `clear && cd '${escapedPath}' && echo 'FFmpeg version information:' && ./ffmpeg -version`;

        // 构建 AppleScript，改进窗口 ID 的检查逻辑
        const script = `
          tell application "Terminal"
            try
              if "${terminalWindowId}" is not "" then
                -- 尝试访问已存在的窗口
                set existingWindow to window id ${terminalWindowId}
                do script "${ffmpegCommand}" in existingWindow
              end if
            on error
              -- 如果窗口不存在或出错，创建新窗口
              set newWindow to do script "${ffmpegCommand}"
              set windowId to id of window 1
              return windowId
            end try
            activate
          end tell`;

        terminalProcess = spawn('osascript', ['-e', script]);

        // 捕获新窗口的 ID
        terminalProcess.stdout?.on('data', (data) => {
          const windowId = data.toString().trim();
          if (windowId && !Number.isNaN(Number(windowId))) {
            terminalWindowId = windowId;
            console.log('Terminal window ID:', terminalWindowId);
          }
        });

        terminalProcess.stderr?.on('data', (data) => {
          console.error('AppleScript stderr:', data.toString());
          // 如果出现错误，重置窗口 ID
          if (data.toString().includes('error')) {
            terminalWindowId = null;
          }
        });

        terminalProcess.on('error', (error) => {
          console.error('Failed to execute AppleScript:', error);
          terminalWindowId = null;
        });

        terminalProcess.on('exit', (code) => {
          console.log(`Terminal AppleScript exited with code ${code}`);
          if (code !== 0) {
            console.error('AppleScript execution failed');
            terminalWindowId = null;
          }
          terminalProcess = null;
        });
      } catch (error) {
        console.error('Failed to open macOS terminal:', error);
        terminalWindowId = null;
      }
      break;
    }
    case 'win32': {
      try {
        // 使用 CMD
        const ffmpegExe = getFfmpegPath();
        terminalProcess = spawn('cmd', ['/K', `"${ffmpegExe}" -version`], {
          shell: true,
          cwd: dirPath,
          windowsVerbatimArguments: true,
          env: {
            ...process.env,
            PATH: `${dirPath}${path.delimiter}${process.env.PATH || ''}`,
          },
          stdio: 'inherit',
          detached: true,
        });
        terminalStarted = true;
      } catch (cmdError) {
        try {
          // 使用 powershell
          terminalProcess = spawn(
            'cmd.exe',
            [
              '/c',
              'start',
              '/wait',
              'powershell.exe',
              '-NoExit',
              '-Command',
              `cd "${dirPath}" ; ffmpeg -version`,
            ],
            {
              shell: true,
              detached: false, // 不分离进程
              stdio: 'ignore',
            },
          );

          // 在 Windows 上使用 taskkill 确保子进程被终止
          terminalProcess.on('exit', () => {
            try {
              exec(`taskkill /F /T /PID ${terminalProcess?.pid}`);
            } catch (error) {
              console.error('Error killing terminal process:', error);
            }
            terminalProcess = null;
          });

          terminalStarted = true;
        } catch (psError) {
          console.error('Failed to start PowerShell:', psError);
        }
      }
      break;
    }
    default: {
      const terminals = [
        [
          'gnome-terminal',
          [
            '--working-directory',
            dirPath,
            '--',
            'bash',
            '-c',
            'ffmpeg -version; echo "\nCurrent directory: $(pwd)"; exec bash',
          ],
        ],
        [
          'konsole',
          [
            '--workdir',
            dirPath,
            '-e',
            'bash',
            '-c',
            'ffmpeg -version; echo "\nCurrent directory: $(pwd)"; exec bash',
          ],
        ],
        [
          'xterm',
          [
            '-e',
            `cd "${dirPath}" && ffmpeg -version && echo "\nCurrent directory: $(pwd)" && exec bash`,
          ],
        ],
      ];

      terminals.some(([terminal, args]) => {
        try {
          terminalProcess = spawn(terminal as string, args as string[], {
            stdio: 'inherit',
            detached: true,
          });
          terminalStarted = true;
          console.log(`Linux terminal (${terminal}) spawn successful`);
          return true; // Exit the loop if successful
        } catch (error) {
          console.error(`Failed to open ${terminal}:`, error);
          return false; // Continue to the next iteration
        }
      });
    }
  }

  if (terminalStarted && terminalProcess) {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(false);
    }

    terminalProcess.on('exit', () => {
      console.log('Terminal process exited');
      if (mainWindow) {
        mainWindow.focus();
      }
      terminalProcess = null;
    });

    terminalProcess.on('error', (error) => {
      console.error('Terminal process error:', error);
      if (mainWindow) {
        mainWindow.focus();
      }
      terminalProcess = null;
    });

    // Windows 平台特殊处理
    if (process.platform === 'win32') {
      terminalProcess.unref();
    }
  } else {
    console.error('Failed to start terminal');
    terminalProcess = null;
  }
}

// 修改 IPC 处理器
ipcMain.handle('open-terminal', async () => {
  const ffmpegPath = path.dirname(getFfmpegPath());
  openTerminalAtPath(ffmpegPath);
  return true;
});

// 添加一个清理进程的函数
function cleanupProcesses() {
  console.log('Cleaning up processes...');

  // 清理终端进程
  if (terminalProcess) {
    try {
      // 对于 Windows，使用 taskkill 来确保子进程也被终止
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${terminalProcess.pid} /T /F`);
      } else {
        // 对于 Unix 系统，发送 SIGTERM 信号
        terminalProcess.kill('SIGTERM');
      }
      terminalProcess = null;
      terminalWindowId = null; // 重置终端窗口 ID
      console.log('Terminal process cleaned up');
    } catch (error) {
      console.error('Error cleaning up terminal process:', error);
    }
  }

  // 清理 FFmpeg 进程
  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill('SIGTERM');
      ffmpegProcess = null;
      console.log('FFmpeg process cleaned up');
    } catch (error) {
      console.error('Error cleaning up FFmpeg process:', error);
    }
  }
}
