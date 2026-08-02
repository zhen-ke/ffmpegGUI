/**
 * FFmpeg 选项表工具
 *
 * 从 `ffmpeg -h full` 输出动态解析「带值选项」集合，替代硬编码列表。
 * 动机：
 * - ffmpeg 选项多达数百个，硬编码 ~70 个必然漏（-x264-params / -hls_time / -sdp_file …）
 * - 漏一个带值选项就会导致 extractOutputFile 把选项值误判为输出文件，
 *   进而覆盖确认弹错文件、输出目录替换错位。
 *
 * 解析规则（基于 ffmpeg 8.x `-h full` 的稳定格式）：
 * - 带值选项：`-opt <type>` 或 `-opt <type> desc`（含 `< >` 空类型，如 -vsync <>）
 * - flag 选项：`-opt` 后无 `<...>`（如 -y / -n / -stdin），或 `-opt 描述`（无 <>）
 *
 * 注意：`-hide_banner <hide_banner>` 语义上是 flag 但语法带值类型，属个例，
 * 解析为带值对输出识别无影响（它不会出现在命令末尾附近）。
 *
 * 结果带 7 天内存缓存；解析失败时回退到内置的最小集合。
 */

import { execFile } from 'child_process';

/** 兼容旧代码导出的最小硬编码集合（缓存不可用时兜底） */
export const FALLBACK_OPTIONS_WITH_VALUES: ReadonlySet<string> = new Set([
  '-i',
  '-f',
  '-c',
  '-b',
  '-map',
  '-map_metadata',
  '-map_chapters',
  '-itsoffset',
  '-itsscale',
  '-loop',
  '-framerate',
  '-readrate',
  '-stream_loop',
  '-video_size',
  '-pixel_format',
  '-rtbufsize',
  '-safe',
  '-vf',
  '-filter',
  '-filter:v',
  '-filter_complex',
  '-lavfi',
  '-vcodec',
  '-c:v',
  '-b:v',
  '-maxrate',
  '-bufsize',
  '-r',
  '-s',
  '-aspect',
  '-vframes',
  '-fpsmax',
  '-vsync',
  '-vtag',
  '-tag:v',
  '-qscale',
  '-q:v',
  '-qmin',
  '-qmax',
  '-vbsf',
  '-bsf',
  '-bsf:v',
  '-profile:v',
  '-level',
  '-af',
  '-filter:a',
  '-acodec',
  '-c:a',
  '-b:a',
  '-ar',
  '-ac',
  '-vol',
  '-ab',
  '-aq',
  '-q:a',
  '-atag',
  '-tag:a',
  '-absf',
  '-bsf:a',
  '-scodec',
  '-c:s',
  '-sbsf',
  '-bsf:s',
  '-ss',
  '-t',
  '-to',
  '-duration',
  '-metadata',
  '-disposition',
  '-attach',
  '-preset',
  '-tune',
  '-crf',
  '-pix_fmt',
  '-threads',
  '-pass',
  '-passlogfile',
  '-filter_threads',
  '-qcomp',
  '-psy-rd',
  '-aq-mode',
  '-aq-strength',
  '-cpu-used',
  '-row-mt',
  '-qp',
  '-qp_i',
  '-qp_p',
  '-global_quality',
  '-cq',
  '-quality',
  '-allow_sw',
  '-movflags',
  '-fflags',
  '-flags',
  '-sws_flags',
  '-id3v2_version',
]);

/**
 * 从 `ffmpeg -h full` 的 stdout 文本中解析出所有带值选项。
 * 纯函数，便于测试。
 *
 * 解析规则：
 * - 带值：`-opt <type>...` / `-opt <>...`（含空类型，如 -vsync <>）
 * - flag：`-opt` 后无 `<...>`（如 -y / -n / -stdin）
 * - 行首可选空白缩进（per-stream 段），选项名可含 . 和 :（如 -c:v、-filter:a）
 */
export function parseHelpFullOutput(stdout: string): Set<string> {
  const options = new Set<string>();
  const re = /^\s*-([A-Za-z0-9_.:-]+)\s*<\s*([^>]*)\s*>/;
  for (const line of stdout.split('\n')) {
    const m = re.exec(line);
    if (m) options.add(`-${m[1]}`);
  }
  return options;
}

/** 运行一次 `ffmpeg -h full` 并解析出所有带值选项 */
function runFfmpegHelpFull(
  ffmpegPath: string,
  timeoutMs: number,
): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ['-hide_banner', '-h', 'full'],
      {
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const options = parseHelpFullOutput(stdout);
        if (options.size === 0) {
          reject(new Error('No options parsed from ffmpeg -h full'));
          return;
        }
        resolve(options);
      },
    );
  });
}

/** 内存缓存：undefined=未加载，null=加载失败，Set=已解析 */
let cachedOptions: ReadonlySet<string> | null | undefined;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 加载带值选项集合。
 *
 * @param ffmpegPath ffmpeg 可执行文件路径。由调用方解析（resolveFfmpegPath），
 *                   保持本模块不依赖 electron 与路径探测。
 */
export async function loadOptionsFrom(
  ffmpegPath: string,
): Promise<ReadonlySet<string>> {
  // 快路径：缓存有效期内直接返回
  if (cachedOptions && Date.now() - lastLoadedAt < CACHE_TTL_MS) {
    return cachedOptions;
  }

  try {
    const parsed = await runFfmpegHelpFull(ffmpegPath, 10_000);
    cachedOptions = parsed;
  } catch {
    cachedOptions = null;
  }
  lastLoadedAt = Date.now();
  return cachedOptions ?? FALLBACK_OPTIONS_WITH_VALUES;
}

/**
 * 获取 ffmpeg 带值选项集合。
 * 优先使用 `-h full` 动态解析结果（7 天缓存），失败时回退到内置集合。
 *
 * @param resolveFfmpeg 获取 ffmpeg 路径的回调，默认直接调用 pathUtils.resolveFfmpegPath。
 *                      延迟引用避免模块顶层 import electron（便于测试）。
 */
export async function getOptionsWithValues(
  resolveFfmpeg: () => Promise<string | null> = () =>
    import('./pathUtils').then((m) => m.resolveFfmpegPath()),
): Promise<ReadonlySet<string>> {
  const ffmpegPath = await resolveFfmpeg();
  if (!ffmpegPath) return FALLBACK_OPTIONS_WITH_VALUES;
  return loadOptionsFrom(ffmpegPath);
}

/**
 * 同步获取带值选项集合。
 * 若尚未加载完成，返回内置兜底集合；仅供无法 await 的场景使用。
 */
export function getOptionsWithValuesSync(): ReadonlySet<string> {
  return cachedOptions ?? FALLBACK_OPTIONS_WITH_VALUES;
}

/** 测试/失效场景：清空缓存强制重新解析 */
export function invalidateOptionsCache(): void {
  cachedOptions = undefined;
  lastLoadedAt = 0;
}
