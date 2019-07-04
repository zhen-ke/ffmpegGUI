import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { resolve } from 'path';

let ffmpegPath = ffmpegStatic.path;
let ffprobePath = ffprobeStatic.path;
let basePath = resolve(__dirname, '../../../core/');

// 更新打包后 ffmpeg、ffprobe 路径
if (process.env.NODE_ENV == 'production') {
  const fs = require('fs');

  let realFfmpegPath = basePath + '/ffmpeg';
  let realFfprobePath = basePath + '/ffprobe';

  fs.stat(realFfmpegPath, (err, stats) => {
    if (err) return;
    // 如果 ffmpeg、ffprobe 非 777 权限，则设置成 777
    if (stats.mode !== 33279) {
      fs.chmod(realFfmpegPath, '0777', (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('ffmpeg 修改权限成功');
      });
      fs.chmod(realFfprobePath, '0777', (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('ffprobe 修改权限成功');
      });
    }
  });

  ffmpegPath = realFfmpegPath;
  ffprobePath = realFfprobePath;
}

// 设置 fluent-ffmpeg 的 ffmpeg 、ffprobe路径
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log(ffmpegPath,ffprobePath)

export function runFFmpeg(
  commandLine,
  stdoutCallback,
  stderrCallback,
  finishCallback,
  errorCallback
) {
  let exec = require('child_process').exec;
  let spawn = require('child_process').spawn;
  exec(`${ffmpegPath} -h`, (err, stdout, stderr) => {
    // -hwaccels
    // console.log(stdout, stderr)
    if (err === null) {
      let ffmpeg = spawn(`${ffmpegPath}`, commandLine);
      // 捕获标准输出并将其打印到控制台
      ffmpeg.stdout.on('data', data => {
        stdoutCallback(data);
      });
      ffmpeg.stderr.on('data', data => {
        stderrCallback(data);
      });
      // 注册子进程关闭事件
      ffmpeg.on('exit', (code, signal) => {
        finishCallback(code, signal);
      });
    } else {
      if (err.toString().indexOf('Command not found') > 0) {
        errorCallback(err);
      }
    }
  });
}

export const ffmpegBinary = ffmpeg;
