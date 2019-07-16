import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { resolve } from "path";

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

console.log(ffmpegPath, ffprobePath);

export function runFFmpeg(
  commandLine,
  stdoutCallback,
  stderrCallback,
  finishCallback,
  errorCallback
) {
  let exec = require("child_process").exec;
  let spawn = require("child_process").spawn;
  exec(`${ffmpegPath} -h`, (err, stdout, stderr) => {
    // -hwaccels
    // console.log(stdout, stderr)
    if (err === null) {
      let ffmpeg = spawn(`${ffmpegPath}`, commandLine);
      // 捕获标准输出并将其打印到控制台
      ffmpeg.stdout.on("data", data => {
        stdoutCallback(data);
      });
      ffmpeg.stderr.on("data", data => {
        stderrCallback(data);
      });
      // 注册子进程关闭事件
      ffmpeg.on("exit", (code, signal) => {
        finishCallback(code, signal);
      });
    } else {
      if (err.toString().indexOf("Command not found") > 0) {
        errorCallback(err);
      }
    }
  });
}

// fluent-ffmpeg
class Fluentffmpeg {
  constructor() {
    this.metaData = {};
    this.command = null;
    this.vcodec =
      process.platform === "darwin" ? "h264_videotoolbox" : "h264_qsv";
  }

  // 开始转换
  async convert(
    inputPath,
    outputPath,
    onProgress = () => {},
    command,
    format,
    time
  ) {
    let originPath = inputPath.length > 1 ? inputPath : inputPath[0];
    try {
      let info = await this.getInfo(originPath);
      await this._gatherData(info);
      await this.run(
        outputPath,
        onProgress,
        this[command](originPath, time),
        format
      );
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
  run(outputPath, onProgress, command, format) {
    return new Promise((resolve, reject) => {
      this.command = command
        .on("start", commandLine => {
          console.log("Spawned Ffmpeg with command: " + commandLine);
        })
        .on("progress", progress => {
          onProgress(progress.percent.toFixed(2));
        })
        .on("end", () => {
          console.log("完成", "success");
          onProgress(0);
          resolve(outputPath);
        })
        .on("error", err => {
          console.log("错误: " + err.message, "error");
          reject(err);
        })
        .saveToFile(
          `${outputPath}/${this.metaData.fileName}${this._dateNow()}.${format}`
        );
    });
  }

  // 转视频
  convertVideo(inputPath) {
    return ffmpeg(inputPath)
      .videoCodec(this.vcodec)
      .videoBitrate(this.metaData.bit_rate);
  }

  // 转音频
  convertAudio(inputPath) {
    return ffmpeg(inputPath).audioCodec("libmp3lame");
  }

  // 合并
  convertMerge(inputPath) {
    let [videoPath, aidioPath] = inputPath;
    return ffmpeg(videoPath)
      .input(aidioPath)
      .videoCodec(this.vcodec)
      .videoBitrate(this.metaData.bit_rate)
      .audioCodec("libmp3lame");
  }

  // 剪切视频
  convertCutVideo(inputPath, time) {
    let [startTime, endTime] = time;
    let duration = endTime - startTime;
    return ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions("-vcodec copy")
      .outputOptions("-acodec copy");
  }

  // 剪切音频
  convertCutAudio(inputPath, time) {
    let [startTime, endTime] = time;
    let duration = endTime - startTime;
    return ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions("-acodec copy");
  }

  // GIF
  convertGIF(inputPath) {
    return ffmpeg(inputPath)
      .size("320x180")
      .outputOptions("-r 15");
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

    this.metaData = {
      fps: this._getFps(stream["r_frame_rate"]),
      width: stream.width,
      height: stream.height,
      start: parseInt(start_time) || 0,
      duration,
      bit_rate,
      tags,
      fileName: this._getFilename(filename)
    };
    return this.metaData;
  }

  // 获取文件名称
  _getFilename(filename) {
    const path = require("path");
    const filenameArr = filename.split(path.sep);
    return filenameArr[filenameArr.length - 1].split(".")[0];
  }

  // 获取fps
  _getFps(fpsStr) {
    const parts = fpsStr.split("/").map(v => parseInt(v, 10));
    return parts[0] / parts[1];
  }

  // 获取当前时间
  _dateNow() {
    return new Date()
      .toLocaleString()
      .replace(/\//g, "-")
      .replace(/\:/g, "-");
  }

  // 停止转码
  stop() {
    this.command.kill();
  }
}
// node child_process
class Spawnffmpeg {}

export const ffmpegBinary = ffmpeg;

export { Fluentffmpeg, Spawnffmpeg };
