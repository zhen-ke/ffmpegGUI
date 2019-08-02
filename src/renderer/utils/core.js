import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { resolve } from "path";

const tmp = require("tmp");

let ffmpegPath = ffmpegStatic.path;
let ffprobePath = ffprobeStatic.path;
let basePath = resolve(__dirname, "../../../core/");

// 更新打包后 ffmpeg、ffprobe 路径
if (process.env.NODE_ENV == "production") {
  const fs = require("fs");

  let realFfmpegPath = basePath + "/ffmpeg";
  let realFfprobePath = basePath + "/ffprobe";

  fs.stat(realFfmpegPath, (err, stats) => {
    if (err) return;
    // 如果 ffmpeg、ffprobe 非 777 权限，则设置成 777
    if (stats.mode !== 33279) {
      fs.chmod(realFfmpegPath, "0777", err => {
        if (err) {
          console.error(err);
          return;
        }
        console.log("ffmpeg 修改权限成功");
      });
      fs.chmod(realFfprobePath, "0777", err => {
        if (err) {
          console.error(err);
          return;
        }
        console.log("ffprobe 修改权限成功");
      });
    }
  });

  ffmpegPath = realFfmpegPath;
  ffprobePath = realFfprobePath;
}

// 设置 fluent-ffmpeg 的 ffmpeg 、ffprobe路径
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// fluent-ffmpeg
class Fluentffmpeg {
  constructor() {
    this.metaData = {};
    this.command = null;
    this.vcodec = "";
  }

  // 开始转码
  async convert({ inputPath, outputPath, onProgress, command, format, time }) {
    let originPath = inputPath.length > 1 ? inputPath : inputPath[0];
    try {
      let info = await this.getInfo(originPath);
      await this._gatherData(info, outputPath);
      if (format === "gif") {
        this.convertGIF(
          originPath,
          onProgress,
          `${outputPath}/${this.metaData.fileName}${this._dateNow()}.${format}`
        );
      } else {
        await this.run(
          onProgress,
          this[command]({ originPath, time }),
          `${outputPath}/${this.metaData.fileName}${this._dateNow()}.${format}`
        );
      }
    } catch (error) {
      this.deskNotification("文件转换失败！", error);
      console.error(error);
    }
  }

  // 读取媒体信息
  async getMediaInfo(inputPath) {
    try {
      let info = await this.getInfo(inputPath);
      let mediaInfo = await this._gatherData(info);
      let hwaccels = await this._getAvailableHwaccels();
      console.log(hwaccels);
      this.vcodec = hwaccels.length ? hwaccels[0] : "libx264"; //如果不支持硬解就用软解
      return mediaInfo;
    } catch (error) {
      console.log(error);
    }
  }

  // 获取媒体相关信息
  getInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputPath)
        .ffprobe((err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
    });
  }

  // 执行 ffmpeg
  run(onProgress, command, savePath) {
    return new Promise((resolve, reject) => {
      this.command = command
        .on("start", commandLine => {
          console.log("Spawned Ffmpeg with command: " + commandLine);
        })
        .on("progress", progress => {
          onProgress(
            progress && progress.percent && progress.percent.toFixed(2)
          );
        })
        .on("end", () => {
          onProgress(0);
          this.deskNotification("文件转换成功！", "点击以在窗口中显示该文件");
          resolve("success");
        })
        .on("error", err => {
          reject(err);
        })
        .saveToFile(savePath);
    });
  }

  // 转视频
  convertVideo({ originPath }) {
    return ffmpeg(originPath)
      .videoCodec(this.vcodec)
      .videoBitrate(this.metaData.bit_rate);
  }

  // 转音频
  convertAudio({ originPath }) {
    return ffmpeg(originPath).audioCodec("libmp3lame");
  }

  // 合并
  convertMerge({ originPath }) {
    let [videoPath, aidioPath] = originPath;
    return ffmpeg(videoPath)
      .input(aidioPath)
      .videoCodec(this.vcodec)
      .videoBitrate(this.metaData.bit_rate)
      .audioCodec("libmp3lame");
  }

  // 剪切视频
  convertCutVideo({ originPath, time }) {
    let [startTime, endTime] = time;
    let duration = endTime - startTime;
    return ffmpeg(originPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions("-vcodec copy")
      .outputOptions("-acodec copy");
    // .outputOptions('-metadata', 'title=song x') 写入媒体信息
  }

  // 剪切音频
  convertCutAudio({ originPath, time }) {
    let [startTime, endTime] = time;
    let duration = endTime - startTime;
    return ffmpeg(originPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions("-acodec copy");
  }

  // 执行命令
  _spawnFfmpeg(commandLine) {
    return new Promise((resolve, reject) => {
      ffmpeg.prototype._spawnFfmpeg(
        commandLine,
        { captureStdout: true, stdoutLines: 0 },
        (err, stdoutRing) => {
          if (err) {
            reject(err);
          }
          resolve(stdoutRing);
        }
      );
    });
  }

  // 视频转 gif
  // ffmpeg -ss 2.6 -t 1.3 -i MVI_7035.MOV -vf fps = 15，scale = 320：-1：flags = lanczos，palettegen palette.png
  // ffmpeg -ss 2.6 -t 1.3 -i MVI_7035.MOV -i palette.png -filter_complex “fps=15,scale=400:-1:flags=lanczos[x];[x][1:v]paletteuse” sixthtry.gif
  async convertGIF(originPath, onProgress, outputPath) {
    // 生成调色板
    const palettePath = tmp.tmpNameSync({ postfix: ".png" });
    await this._spawnFfmpeg([
      "-ss",
      40,
      "-t",
      5,
      "-i",
      originPath,
      "-vf",
      "fps=15,scale=-1:-1::flags=lanczos,palettegen",
      palettePath
    ]);
    // 转码
    await this.run(
      onProgress,
      ffmpeg(originPath)
        .addOptions(["-i", palettePath]) // "-ss", 0, "-to", 5
        .complexFilter([
          "fps=15,scale=-1:-1:flags=lanczos[x]; [x][1:v]paletteuse"
        ]),
      outputPath
    );
  }

  // 解析并整合媒体相关信息
  _gatherData(data, outputPath) {
    let stream = data.streams[0];
    let {
      format: {
        bit_rate = 0,
        tags = {},
        duration = 0,
        filename = "",
        start_time = ""
      }
    } = data;

    this.metaData = {
      fps: this._getFps(stream["r_frame_rate"]),
      width: stream.width,
      height: stream.height,
      start: parseInt(start_time) || 0,
      duration,
      bit_rate: parseInt(bit_rate / 1000) * 1.5,
      tags,
      fileName: this._getFilename(filename),
      outputPath
    };
    return this.metaData;
  }

  // 获取文件名称
  _getFilename(filename) {
    const path = require("path");
    const filenameArr = filename.split(path.sep);
    let fullName = filenameArr[filenameArr.length - 1];
    return fullName.slice(0, fullName.lastIndexOf("."));
  }

  // 获取fps
  _getFps(fpsStr) {
    const parts = fpsStr.split("/").map(v => parseInt(v, 10));
    return parts[0] / parts[1];
  }

  // 解析时间
  timetrans(date) {
    let d = new Date((date + "").length <= 10 ? date * 1000 : +date);
    let day = d.getDate();
    let month = d.getMonth() + 1;
    let h = d.getHours();
    let m = d.getMinutes();
    let s = d.getSeconds();
    return (
      [
        d.getFullYear(),
        month < 10 ? "0" + month : month,
        day < 10 ? "0" + day : day
      ].join("-") +
      "_" +
      [h < 10 ? "0" + h : h, m < 10 ? "0" + m : m, s < 10 ? "0" + s : s].join(
        "-"
      )
    );
  }

  // 打开文件或者文件夹
  openFolder(filepath) {
    const { shell } = require("electron");
    shell.openItem(filepath);
  }

  // 桌面通知
  // new Notification("title", {body: "message", icon: "path/to/image.png"});
  deskNotification(title, body) {
    let myNotification = new Notification(title, {
      body
    });
    myNotification.onclick = () => {
      this.openFolder(this.metaData.outputPath);
    };
  }

  // 获取当前时间
  _dateNow() {
    return this.timetrans(new Date().getTime());
  }

  // 停止转码
  stop() {
    this.command.kill();
  }

  // 获取可用的硬件加速方法
  _getAvailableHwaccels = () => {
    return new Promise((resolve, reject) => {
      ffmpeg.prototype._spawnFfmpeg(
        ["-hwaccels"],
        { captureStdout: true, stdoutLines: 0 },
        (err, stdoutRing) => {
          if (err) {
            reject(err);
          }
          let stdout = stdoutRing.get();
          let lines = [
            ...new Set(
              stdout
                .replace("Hardware acceleration methods:", "")
                .replace(/\n/g, " ")
                .trim()
                .split(" ")
            )
          ];
          ffmpeg.getAvailableEncoders((err, encoders) => {
            if (err) {
              reject(err);
            }
            let reslut = lines.reduce((total, it) => {
              return total.concat(
                Object.keys(encoders).filter(encodersName =>
                  encodersName.includes(it)
                )
              );
            }, []);
            resolve(reslut);
          });
        }
      );
    });
  };
}

export default Fluentffmpeg;
