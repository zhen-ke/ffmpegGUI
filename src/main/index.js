import { app, BrowserWindow, Menu } from "electron";
const { platform } = process;

const template = [
  {
    label: "Application",
    submenu: [
      {
        label: "关于",
        selector: "orderFrontStandardAboutPanel:"
      },
      { type: "separator" },
      {
        label: "退出",
        accelerator: "Command+Q",
        click: function() {
          app.quit();
        }
      }
    ]
  },
  {
    label: "编辑",
    submenu: [
      { label: "剪切", accelerator: "CmdOrCtrl+X", selector: "cut:" },
      { label: "复制", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "粘贴", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      {
        label: "全选",
        accelerator: "CmdOrCtrl+A",
        selector: "selectAll:"
      }
    ]
  },
  {
    role: "help",
    id: "menu.help",
    submenu: [{ id: "help.toggle-dev-tools", role: "toggledevtools" }]
  }
];
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */

// 禁用安全警告
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";

if (process.env.NODE_ENV !== "development") {
  global.__static = require("path")
    .join(__dirname, "/static")
    .replace(/\\/g, "\\\\");
}

let mainWindow;
const winURL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 563,
    useContentSize: true,
    titleBarStyle: "hidden",
    width: 1000,
    show: false, //默认隐藏
    webPreferences: {
      nodeIntegration: true
    }
  });

  mainWindow.loadURL(winURL);
  mainWindow.on("ready-to-show", function() {
    mainWindow.show(); // 初始化后再显示
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 在 win 下，启用 electron 桌面通知后,修改默认通知应用名 electron.app.Electron 为自己应用的名称
if (platform === "win32" && platform === "win64") {
  app.setAppUserModelId("ffmpegGUI");
}

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
