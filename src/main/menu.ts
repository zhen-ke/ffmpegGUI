import {
  app,
  dialog,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from 'electron';
import { downloadService } from './services/DownloadService';
import { ffmpegService } from './services/FFmpegController';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  private async handleClearDownloadedFFmpeg(): Promise<void> {
    const { response } = await dialog.showMessageBox(this.mainWindow, {
      type: 'warning',
      buttons: ['Clear Downloaded FFmpeg', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Clear Downloaded FFmpeg',
      message:
        'This will remove the FFmpeg files downloaded by this app. System-installed FFmpeg will not be affected.',
    });

    if (response !== 0) return;

    try {
      const removedCount = await downloadService.clearManagedInstall();
      const exists = await ffmpegService.checkExists();
      this.mainWindow.webContents.send('ffmpeg-status', exists);

      await dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        buttons: ['OK'],
        title: 'Downloaded FFmpeg Cleared',
        message:
          removedCount > 0
            ? 'Downloaded FFmpeg files have been removed.'
            : 'No downloaded FFmpeg files were found.',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to clear downloaded FFmpeg.';
      await dialog.showMessageBox(this.mainWindow, {
        type: 'error',
        buttons: ['OK'],
        title: 'Clear Downloaded FFmpeg Failed',
        message,
      });
    }
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'FFmpeg GUI',
      submenu: [
        {
          label: 'About FFmpeg GUI',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide FFmpeg GUI',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuView: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Clear Downloaded FFmpeg',
          click: () => {
            void this.handleClearDownloadedFFmpeg();
          },
        },
        { type: 'separator' },
        {
          label: 'FFmpeg Documentation',
          click() {
            shell.openExternal('https://ffmpeg.org/documentation.html');
          },
        },
        {
          label: 'Report an Issue',
          click() {
            shell.openExternal(
              'https://github.com/yourusername/ffmpeg-gui/issues',
            );
          },
        },
      ],
    };

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&File',
        submenu: [
          // {
          //   label: '&Open',
          //   accelerator: 'Ctrl+O',
          //   click: () => {
          //     // 在这里添加打开文件的逻辑
          //   },
          // },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      {
        label: '&View',
        submenu: [
          {
            label: 'Toggle &Full Screen',
            accelerator: 'F11',
            click: () => {
              this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
            },
          },
          {
            label: 'Toggle &Developer Tools',
            accelerator: 'Alt+Ctrl+I',
            click: () => {
              this.mainWindow.webContents.toggleDevTools();
            },
          },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Clear Downloaded FFmpeg',
            click: () => {
              void this.handleClearDownloadedFFmpeg();
            },
          },
          { type: 'separator' },
          {
            label: 'FFmpeg Documentation',
            click() {
              shell.openExternal('https://ffmpeg.org/documentation.html');
            },
          },
          {
            label: 'Report an Issue',
            click() {
              shell.openExternal('https://github.com/zhen-ke/ffmpegGUI/issues');
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
