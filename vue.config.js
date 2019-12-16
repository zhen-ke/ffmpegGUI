/**
 * @describe vue-cli 配置文件
 */
const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const PermissionsOutputPlugin = require("webpack-permissions-plugin");

const { platform, arch } = process;

let plugins = [
  new webpack.DefinePlugin({
    "process.env.FLUENTFFMPEG_COV": false
  })
];

if (process.env.NODE_ENV === "production") {
  // 打包不同平台的 ffmpeg 到 app
  const ffmpegBasePath = "./node_modules/ffmpeg-static/bin/"; // ffmpeg-static
  const ffprobeBasePath = "./node_modules/ffprobe-static/bin/"; // ffprobe-static
  const ffmpegPath = path.join(
    ffmpegBasePath,
    platform,
    arch,
    platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  );
  const ffprobePath = path.join(
    ffprobeBasePath,
    platform,
    arch,
    platform === "win32" ? "ffprobe.exe" : "ffprobe"
  );
  plugins.push(
    // 复制二进制文件到core文件夹中
    new CopyWebpackPlugin([
      {
        from: path.join(__dirname, ffmpegPath),
        to: path.join(__dirname, "core"),
        ignore: [".*"]
      },
      {
        from: path.join(__dirname, ffprobePath),
        to: path.join(__dirname, "core"),
        ignore: [".*"]
      }
    ]),
    // 调整二进制文件的权限
    new PermissionsOutputPlugin({
      buildFiles: [
        {
          path: path.resolve(__dirname, "core/ffmpeg"),
          fileMode: "777"
        },
        {
          path: path.resolve(__dirname, "core/ffprobe"),
          fileMode: "777"
        }
      ]
    })
  );
}

module.exports = {
  lintOnSave: false, // 取消 eslint 验证
  configureWebpack: {
    node: {
      __dirname: process.env.NODE_ENV !== "production",
      __filename: process.env.NODE_ENV !== "production"
    },
    plugins
  },
  chainWebpack: config => {
    config.module
      .rule("varialbes")
      .test(/\.node$/)
      .use("node-loader")
      .loader("node-loader")
      .end();
  },
  pluginOptions: {
    electronBuilder: {
      builderOptions: {
        productName: "ffmpegGUI",
        appId: "com.xmit.ffmpegGUI",
        mac: {
          icon: "public/icons/icon.icns",
          target: ["dmg", "zip"],
          type: "distribution",
          extraResources: {
            from: "./core/",
            to: "./core/",
            filter: ["**/*"]
          }
        },
        win: {
          icon: "public/icons/icon.ico",
          target: [
            {
              target: "nsis",
              arch: ["x64", "ia32"]
            },
            {
              target: "zip",
              arch: ["x64", "ia32"]
            },
            {
              target: "portable",
              arch: ["x64", "ia32"]
            }
          ],
          extraResources: {
            from: "./core/",
            to: "./core/",
            filter: ["**/*"]
          }
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true
        },
        linux: {
          icon: "public/icons",
          category: "Network",
          target: ["deb", "snap", "AppImage"],
          extraResources: {
            from: "./core/",
            to: "./core/",
            filter: ["**/*"]
          }
        }
      }
    }
  }
};
