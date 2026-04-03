/**
 * IPC 通道名称定义（共享模块）
 * 主进程和渲染进程的唯一事实来源
 */

/**
 * 所有 IPC 通道名称
 */
export const IPC_CHANNELS = [
  // FFmpeg 控制
  'start-ffmpeg',
  'stop-ffmpeg',
  'check-ffmpeg-status',

  // FFmpeg 事件
  'ffmpeg-output',
  'ffmpeg-error',
  'ffmpeg-cancelled',
  'ffmpeg-progress',
  'ffmpeg-duration',
  'ffmpeg-complete',
  'ffmpeg-status',

  // FFmpeg 下载安装
  'download-ffmpeg',
  'ffmpeg-download-progress',
  'ffmpeg-extract-progress',
  'ffmpeg-install-complete',
  'ffmpeg-install-error',

  // 文件操作
  'check-file-exists',
  'open-output-file',
  'open-output-folder',
  'select-input-file',
  'select-output-folder',
  'check-media-probe-status',
  'probe-media',

  // 其他
  'fetch-osx-experts-html',
] as const;

/**
 * IPC 通道类型（从数组自动推导）
 */
export type IpcChannel = (typeof IPC_CHANNELS)[number];
