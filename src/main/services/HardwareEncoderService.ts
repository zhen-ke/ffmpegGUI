/**
 * 硬件编码器探测服务
 *
 * 运行 `ffmpeg -hide_banner -encoders`，解析出当前机器可用的硬件编码器集合。
 * 供渲染层动态化模板可用性（NVENC/QSV/AMF/VideoToolbox 模板置灰或标记）。
 *
 * `-encoders` 输出行格式（首个字符为类型，第二字符 E 表示可编码）：
 * ```
 *  V....D libx264              libx264 H.264 / AVC ...
 *  V....D h264_videotoolbox    VideoToolbox H.264 Encoder (codec h264)
 *  V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 * ```
 * 编码器名是第 2 个字段。硬件编码器通过已知后缀/前缀识别。
 *
 * 结果带会话级内存缓存；ffmpeg 下载/更新后由调用方失效。
 */

import { execFile } from 'child_process';

/**
 * 硬件编码器标识：匹配已知硬件后缀或前缀。
 * 覆盖 NVENC/QSV/AMF/VideoToolbox/VAAPI/Vulkan/OpenCL 及 Apple 系编码器。
 */
const HARDWARE_ENCODER_RE =
  /(?:^|_)(nvenc|qsv|amf|videotoolbox|vaapi|vulkan|opencl)(?:_|$)|^(h264|hevc|av1|vp9|prores)_(videotoolbox|nvenc|qsv|amf|vaapi)|_(at|mft|mediacodec)$/i;

/** 常见纯软件编码器名（显式排除，避免误判） */
const SOFTWARE_ENCODERS = new Set([
  'libx264',
  'libx264rgb',
  'libx265',
  'libvpx',
  'libvpx-vp9',
  'libaom-av1',
  'libsvtav1',
  'librav1e',
  'libopus',
  'libmp3lame',
  'libvorbis',
  'libtheora',
  'libwebp',
  'aac',
  'ac3',
  'eac3',
  'mp3',
  'flac',
  'pcm_*',
]);

/** 从 `-encoders` 输出中解析硬件编码器名集合。纯函数，便于测试。 */
export function parseHardwareEncoders(output: string): Set<string> {
  const result = new Set<string>();
  for (const line of output.split('\n')) {
    // 行结构：` V....D <name>  <desc>`。首字符类型（V/A/S），随后 5 个标志位
    // （. / E / D，如 ....D、...E. 等）。仅提取编码器名（第二个 token）。
    // header 行（` V..... = Video`）的第二个 token 是 `=`，会被 name 正则跳过。
    const match = /^\s[VAS][\.ED]{5}\s+([A-Za-z0-9_-]+)\s+/.exec(line);
    if (!match) continue;
    const name = match[1];
    if (SOFTWARE_ENCODERS.has(name)) continue;
    if (HARDWARE_ENCODER_RE.test(name)) {
      result.add(name);
    }
  }
  return result;
}

/** 内存缓存：undefined=未探测，null=探测失败，Set=已解析 */
let cachedEncoders: Set<string> | null | undefined = undefined;

/** 使编码器缓存失效。在 FFmpeg 下载/更新后调用。 */
export function invalidateHardwareEncoderCache(): void {
  cachedEncoders = undefined;
}

/**
 * 探测当前机器可用的硬件编码器集合。
 * 结果带会话缓存；ffmpeg 不可用时返回空集。
 *
 * @param deps 可注入的路径解析/环境构建依赖（默认延迟加载 pathUtils，
 *              避免模块顶层依赖 electron，便于测试）
 */
export async function getAvailableHardwareEncoders(
  deps: {
    resolveFfmpegPath?: () => Promise<string | null>;
    buildProbeEnv?: () => NodeJS.ProcessEnv;
  } = {},
): Promise<string[]> {
  if (cachedEncoders) return [...cachedEncoders];

  // 延迟加载 pathUtils，保持本模块在测试环境（无 electron）下可独立运行
  let resolveFfmpegPath: () => Promise<string | null>;
  let buildProbeEnv: () => NodeJS.ProcessEnv;
  if (deps.resolveFfmpegPath && deps.buildProbeEnv) {
    resolveFfmpegPath = deps.resolveFfmpegPath;
    buildProbeEnv = deps.buildProbeEnv;
  } else {
    const pathUtils = await import('../utils/pathUtils');
    resolveFfmpegPath = pathUtils.resolveFfmpegPath;
    buildProbeEnv = pathUtils.buildProbeEnv;
  }

  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) {
    cachedEncoders = new Set();
    return [];
  }

  try {
    const encoders = await new Promise<Set<string>>((resolve, reject) => {
      execFile(
        ffmpegPath,
        ['-hide_banner', '-encoders'],
        {
          timeout: 10_000,
          windowsHide: true,
          maxBuffer: 8 * 1024 * 1024,
          env: buildProbeEnv(),
        },
        (error, stdout) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(parseHardwareEncoders(stdout));
        },
      );
    });
    cachedEncoders = encoders;
  } catch {
    cachedEncoders = new Set();
  }

  return [...cachedEncoders];
}

/** 同步视图：缓存未就绪时返回空集（渲染层通常等待异步结果后再渲染） */
export function getCachedHardwareEncodersSync(): string[] {
  return cachedEncoders ? [...cachedEncoders] : [];
}
