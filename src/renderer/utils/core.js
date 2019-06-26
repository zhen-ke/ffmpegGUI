import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

let ffmpegPath = ffmpegStatic.path;
let ffprobePath = ffprobeStatic.path;
// 修复 electron asar 不能访问二进制文件的问题
if (process.env.NODE_ENV !== "development") {
  ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked");
  ffprobePath = ffprobePath.replace("app.asar", "app.asar.unpacked");
}
// 设置 fluent-ffmpeg 的 ffmpeg 、ffprobe路径
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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
    console.log(stdout, stderr)
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

export const ffmpegBinary = ffmpeg;
