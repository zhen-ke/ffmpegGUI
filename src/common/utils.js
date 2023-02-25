import { shell, dialog } from "@tauri-apps/api";
const { Command } = shell;
export const { open, message } = dialog;

let duration = "";

export const runFFmpeg = async (command, outputFolder, onProgress) => {
  onProgress(1, `ffmpeg params：${command}`);

  const ffmpeg = Command.sidecar("ffmpeg", command.split(" "));

  // 注册子进程关闭事件
  ffmpeg.on("close", async ({ code }) => {
    if (code) {
      await message("转换失败");
    } else {
      await shell.open(outputFolder);
      console.log("done");
    }
  });

  // 注册子进程异常事件
  ffmpeg.on("error", async (error) => {
    await message("文件转换错误");
    console.error(`command error: "${error}"`);
  });

  // 捕获标准输出
  ffmpeg.stdout.on("data", (line) => console.log(`command stdout: "${line}"`));

  ffmpeg.stderr.on("data", (line) => {
    onProgress(getProgress(line), line);
    console.log(`command stderr: "${line}"`);
  });

  // 执行 ffmpeg
  const child = await ffmpeg.execute();
  console.log(child);
};

// 字符转对象
const parseProgressLine = (line) => {
  var progress = {};

  if (line.startsWith("  Duration")) {
    duration = line.split(",")[0].replace(/:\s+/g, "=");
  }
  // Remove all spaces after = and trim
  line = duration.trim() + " " + line.replace(/=\s+/g, "=").trim();
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
};

// hh:mm:ss to ss
const getSeconds = (hms) => {
  if (typeof hms !== "string") {
    return 0;
  }
  const [h, m, s] = hms.split(":");
  return +h * 60 * 60 + +m * 60 + +s;
};

// 获取进度
const getProgress = (line) => {
  const { time, Duration } = parseProgressLine(line.toString()) || {};

  if (time && Duration) {
    const t = getSeconds(time) / getSeconds(Duration);
    return (100 * t).toFixed(2);
  }
  return 0;
};
