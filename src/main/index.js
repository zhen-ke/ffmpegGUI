import { app, BrowserWindow, Menu } from "electron";
const template = [
  {
    label: "Application",
    submenu: [
      {
        label: "关于七牛",
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
    submenu: [
      { id: "help.toggle-dev-tools", role: "toggledevtools" }
    ]
  }
];
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
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
    width: 1000
  });

  mainWindow.loadURL(winURL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  // var ses = mainWindow.webContents.session;
  // mainWindow.webContents.session.setProxy('socks5://23.28.195.172:10200', function () {
  //   mainWindow.loadUrl('http://whatismyipaddress.com');
  // });
  // mainWindow.webContents.session.setProxy(
  //   { proxyRules: "socks5://127.0.0.1:1086", proxyBypassRules: winURL },
  //   function() {
  //     // mainWindow.loadURL("https://www.youtube.com");
  //     mainWindow.loadURL(winURL);
  //   }
  // );
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
