import { shell, dialog } from "@tauri-apps/api";
const { Command } = shell;
export const { open, message } = dialog;

export const runFFmpeg = async (command) => {
  const ffmpeg = Command.sidecar("ffmpeg", command);

  // 注册子进程关闭事件
  ffmpeg.on("close", async ({ code }) => {
    if (code) {
      await message("文件转换失败");
    } else {
      console.log("文件转换成功");
    }
  });

  // 注册子进程异常事件
  ffmpeg.on("error", async (error) => {
    await message("文件转换错误");
    console.error(`command error: "${error}"`);
  });

  // 捕获标准输出
  ffmpeg.stdout.on("data", (line) => console.log(`command stdout: "${line}"`));
  ffmpeg.stderr.on("data", (line) => console.log(`command stderr: "${line}"`));

  // 执行 ffmpeg
  const child = await ffmpeg.execute();
  console.log(child);
};
