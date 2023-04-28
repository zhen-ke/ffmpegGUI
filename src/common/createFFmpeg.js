import { shell, dialog } from "@tauri-apps/api";
const { Command } = shell;
export const { open, message } = dialog;

const createFFmpeg = (_options = {}) => {
  const {
    log: optLog,
    progress: optProgress,
    success = () => {},
    error = () => {},
  } = {
    ..._options,
  };

  let ffmpeg = null;
  let logging = optLog;
  let progress = optProgress;
  let duration = 0;
  let frames = 0;
  let readFrames = false;
  let ratio = 0;

  const log = (type, message) => {
    if (logging) {
      optLog(`[${type}] ${message}`);
      console.log(`[${type}] ${message}`);
    }
  };

  const ts2sec = (ts) => {
    const [h, m, s] = ts.split(":");
    return parseFloat(h) * 60 * 60 + parseFloat(m) * 60 + parseFloat(s);
  };

  const parseProgress = (message, prog) => {
    if (typeof message === "string") {
      if (message.startsWith("  Duration")) {
        const ts = message.split(", ")[0].split(": ")[1];
        const d = ts2sec(ts);
        prog({ duration: d, ratio });
        if (duration === 0 || duration > d) {
          duration = d;
          readFrames = true;
        }
      } else if (readFrames && message.startsWith("    Stream")) {
        const match = message.match(/([\d.]+) fps/);
        if (match) {
          const fps = parseFloat(match[1]);
          frames = duration * fps;
        } else {
          frames = 0;
        }
        readFrames = false;
      } else if (message.startsWith("frame") || message.startsWith("size")) {
        const ts = message.split("time=")[1].split(" ")[0];
        const t = ts2sec(ts);
        const match = message.match(/frame=\s*(\d+)/);
        if (frames && match) {
          const f = parseFloat(match[1]);
          ratio = Math.min(f / frames, 1);
        } else {
          ratio = t / duration;
        }
        prog({ ratio, time: t });
      } else if (message.startsWith("video:")) {
        prog({ ratio: 1 });
        duration = 0;
      }
    }
  };

  const parseMessage = ({ type, message }) => {
    log(type, message);
    parseProgress(message, progress);
  };

  const run = async (command, outputFolder) => {
    const ffmpegSidecar = Command.sidecar("bin/ffmpeg", command);

    // 注册子进程关闭事件
    ffmpegSidecar.on("close", async ({ code }) => {
      if (code) {
        error();
      } else {
        success();
      }
    });

    // 注册子进程异常事件
    ffmpegSidecar.on("error", (error) => {
      parseMessage({ type: "fferr", message: error });
    });

    // 捕获标准输出
    ffmpegSidecar.stderr.on("data", (line) => {
      parseMessage({ type: "ffout", message: line });
    });

    // 执行 ffmpeg
    ffmpeg = await ffmpegSidecar.spawn();
  };

  const exit = () => {
    try {
      ffmpeg.kill();
    } catch (err) {
      log(err.message);
    }
  };

  return {
    run,
    exit,
  };
};

export default createFFmpeg;
