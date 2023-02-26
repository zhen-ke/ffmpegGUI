import { shell, dialog } from "@tauri-apps/api";
const { Command } = shell;
export const { open, message } = dialog;

let duration = "";

export const runFFmpeg = async (command, outputFolder, onProgress) => {
  // onProgress(1, `ffmpeg params：${command}`);

  const ffmpeg = Command.sidecar("ffmpeg", command.split(" "));

  // 注册子进程关闭事件
  ffmpeg.on("close", async ({ code }) => {
    if (code) {
      await message("转换失败");
      onProgress(-1);
    } else {
      await shell.open(outputFolder);
      console.log("转换成功");
      onProgress(100);
    }
  });

  // 注册子进程异常事件
  ffmpeg.on("error", async (error) => {
    await message("文件转换错误");
    console.error(`command error: "${error}"`);
  });

  // 捕获标准输出
  ffmpeg.stderr.on("data", (line) => {
    onProgress(getProgress(line), line);
    console.log(`command stderr: "${line}"`);
  });

  // 执行 ffmpeg
  const child = await ffmpeg.execute();
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
    return Math.floor(100 * +t);
  }
  return 0;
};

export const formatDate = (date, format) => {
  const map = {
    MM: date.getMonth() + 1,
    DD: date.getDate(),
    YY: date.getFullYear().toString(),
    hh: date.getHours(),
    mm: date.getMinutes(),
    ss: date.getSeconds(),
  };

  return format.replace(/MM|DD|YY|hh|mm|ss/gi, (matched) => map[matched]);
};
