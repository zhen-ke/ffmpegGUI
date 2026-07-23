/**
 * 类型化的 FFmpeg IPC 事件订阅层
 *
 * 统一封装 `window.electron.ipcRenderer.on` 对 ffmpeg-* 通道的订阅：
 * - 载荷按 `FFmpegEventPayloads` 自动窄化，调用方无需再写 `as ...`；
 * - 多个消费者可各自订阅同一通道（Electron 为每个 listener 独立派发），
 *   关注点分离：状态机(useFFmpegState)只看 status 类事件、进度条只看
 *   progress/duration、日志终端只看 output/error/cancelled/complete。
 *
 * 取消订阅：返回的函数调用一次即移除 listener（与 preload 的 on 对称）。
 */
import type { FFmpegEventPayloads } from '../../shared/ipc';

export function onFFmpegEvent<K extends keyof FFmpegEventPayloads>(
  channel: K,
  handler: (payload: FFmpegEventPayloads[K]) => void,
): () => void {
  // preload 的 on(...) 会把 IPC 的 (event, payload) 拆成 (payload) 传入回调；
  // 此处再做一次类型断言把 unknown 收敛为目标载荷类型。
  return window.electron.ipcRenderer.on(channel, (raw: unknown) => {
    handler(raw as FFmpegEventPayloads[K]);
  });
}

export default onFFmpegEvent;
