import { resolve } from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { time_to_sec } from "@/utils/common";

const tmp = require("tmp");
const exec = require("child_process").exec;
const spawn = require("child_process").spawn;

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

class ChildProcessFFmpeg {
  constructor() {
    this.ffmpeg = null;
    this.vcodec = "";
    this.metaData = {};
    this.outputPath = "";
  }

  // convert
  async convert({ command, onProgress, ...params }) {
    try {
      const commandLine = await this[command]({ ...params });
      this.spawnFFmpeg(commandLine, onProgress);
    } catch (error) {
      this.deskNotification("文件转换失败！", error);
    }
  }

  // node run ffmpeg
  spawnFFmpeg(commandLine, onProgress) {
    console.log(commandLine);
    exec(`${ffmpegPath} -h`, err => {
      if (err) {
        console.log(err);
      }
      this.ffmpeg = spawn(`${ffmpegPath}`, commandLine);
      // 捕获标准输出
      this.ffmpeg.stderr.on("data", data => {
        onProgress(
          this.extractProgress(this.metaData.duration, data.toString())
        );
      });
      // 注册子进程关闭事件
      this.ffmpeg.on("exit", (code, signal) => {
        console.log(code, signal);
        this.deskNotification("文件转换成功！", "点击以在窗口中显示该文件");
      });
      // 注册子进程错误事件
      this.ffmpeg.on("error", err => console.log(err));
    });
  }

  // stop ffmpeg
  stop() {
    this.ffmpeg.kill("SIGINT");
  }

  // 生成文件保存地址和文件名
  outputPathGenerate(outputPath, format) {
    this.outputPath = outputPath;
    return `${outputPath}/${
      this.metaData.fileName
    }${this._dateNow()}.${format}`;
  }

  // convert Video
  // ffmpeg -i test.webm -vcodec h264_videotoolbox -b:v 1744.5k test.mp4
  convertVideo({ inputPath, outputPath, format }) {
    return [
      "-i",
      inputPath,
      "-vcodec",
      this.vcodec,
      "-b:v",
      this.metaData.bit_rate,
      this.outputPathGenerate(outputPath, format)
    ];
  }

  // convert Audio
  // ffmpeg -i test.flac -acodec libmp3lame test.mp3
  convertAudio({ inputPath, outputPath, format }) {
    return [
      "-i",
      inputPath,
      "-acodec",
      "libmp3lame",
      this.outputPathGenerate(outputPath, format)
    ];
  }

  // Cut Audio
  // ffmpeg -i test.mp3 -ss 66 -t 110 -acodec copy test.mp3
  convertCutAudio({ inputPath, time, outputPath, format }) {
    let [startTime, endTime] = time;
    let duration = endTime - startTime;
    return [
      "-i",
      inputPath,
      "-ss",
      startTime,
      "-t",
      duration,
      "-acodec",
      "copy",
      this.outputPathGenerate(outputPath, format)
    ];
  }

  // Cut Video
  // ffmpeg -i test.mp4 -ss 66 -t 110 -vcode copy -acodec copy test.mp4
  // ('-metadata', 'title=song x') 写入媒体信息
  convertCutVideo({ inputPath, time, outputPath, format }) {
    let [startTime, endTime] = time;
    let duration = endTime - startTime;
    return [
      "-i",
      inputPath,
      "-ss",
      startTime,
      "-t",
      duration,
      "-c",
      "copy",
      this.outputPathGenerate(outputPath, format)
    ];
  }

  // Merge
  // ffmpeg -y -i filename1 -i filename2 -vcode copy -acodec copy test.mp4
  convertMerge({ inputPath, outputPath, format }) {
    let { videoPath, aidioPath } = inputPath;
    return [
      "-i",
      videoPath,
      "-i",
      aidioPath,
      "-c",
      "copy",
      this.outputPathGenerate(outputPath, format)
    ];
  }

  // convert GIF
  // ffmpeg -ss 2.6 -t 1.3 -i video.mp4 -vf fps = 15，scale = 320：-1：flags = lanczos，palettegen palette.png
  // ffmpeg -ss 2.6 -t 1.3 -i video.mp4 -i palette.png -filter_complex “fps=15,scale=400:-1:flags=lanczos[x];[x][1:v]paletteuse” sixthtry.gif
  async convertGIF({ inputPath, time, outputPath, format }) {
    let [startTime, endTime] = time;
    let duration = endTime - startTime;

    this.metaData = { ...this.metaData, duration };

    // 生成调色板
    const palettePath = tmp.tmpNameSync({ postfix: ".png" });

    await this._run([
      "-ss",
      startTime,
      "-t",
      duration,
      "-i",
      inputPath,
      "-vf",
      "fps=15,scale=-1:-1::flags=lanczos,palettegen",
      palettePath
    ]);

    // 生成gif
    return [
      "-ss",
      startTime,
      "-t",
      duration,
      "-i",
      inputPath,
      "-i",
      palettePath,
      "-filter_complex",
      "fps=15,scale=-1:-1:flags=lanczos[x]; [x][1:v]paletteuse",
      this.outputPathGenerate(outputPath, format)
    ];
  }

  // 字符转对象
  parseProgressLine(line) {
    var progress = {};

    // Remove all spaces after = and trim
    line = line.replace(/=\s+/g, "=").trim();
    var progressParts = line.split(" ");

    // Split every progress part by "=" to get key and value
    for (var i = 0; i < progressParts.length; i++) {
      var progressSplit = progressParts[i].split("=", 2);
      var key = progressSplit[0];
      var value = progressSplit[1];

      // This is not a progress line
      if (typeof value === "undefined") return null;

      progress[key] = value;
    }

    return progress;
  }

  // 获取进度
  extractProgress(duration, stderrLine) {
    var progress = this.parseProgressLine(stderrLine);

    if (progress) {
      // build progress report object
      var ret = {
        frames: parseInt(progress.frame, 10),
        currentFps: parseInt(progress.fps, 10),
        currentKbps: progress.bitrate
          ? parseFloat(progress.bitrate.replace("kbits/s", ""))
          : 0,
        targetSize: parseInt(progress.size || progress.Lsize, 10),
        timemark: progress.time
      };

      // calculate percent progress using duration
      if (duration) {
        var duration = Number(duration);
        if (!isNaN(duration))
          ret.percent = (time_to_sec(ret.timemark) / duration) * 100;
      }
      return ret.percent.toFixed(2);
    }
  }

  // run
  _run(commandLine) {
    return new Promise((resolve, reject) => {
      exec(`${ffmpegPath} -h`, err => {
        if (err) {
          reject(err);
        }
        this.ffmpeg = spawn(`${ffmpegPath}`, commandLine);
        this.ffmpeg.on("exit", (code, signal) => {
          resolve();
        });
      });
    });
  }

  // 读取媒体信息
  async getMediaInfo(inputPath) {
    try {
      let info = await this._getInfo(inputPath);
      this.metaData = await this._gatherData(info);
      let hwaccels = await this._getAvailableHwaccels();
      console.log(hwaccels);
      this.vcodec = hwaccels.length ? hwaccels[0] : "libx264"; //如果不支持硬解就用软解
      return this.metaData;
    } catch (error) {
      console.log(error);
    }
  }

  // 获取媒体相关信息
  _getInfo(inputPath) {
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

  // 解析并整合媒体相关信息
  _gatherData(data) {
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

    return {
      fps: this._getFps(stream["r_frame_rate"]),
      width: stream.width,
      height: stream.height,
      start: parseInt(start_time) || 0,
      duration,
      bit_rate: parseInt(bit_rate / 1000) * 1.5 + "K",
      tags,
      fileName: this._getFilename(filename)
    };
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

  // 打开文件或者文件夹
  _openFolder(filepath) {
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
      this._openFolder(this.outputPath);
    };
  }

  // 获取当前时间
  _dateNow() {
    return this._timetrans(new Date().getTime());
  }

  // 解析时间
  _timetrans(date) {
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

export default ChildProcessFFmpeg;
