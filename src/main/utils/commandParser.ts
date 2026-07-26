/**
 * FFmpeg 命令解析工具
 * 解析和验证 FFmpeg 命令字符串
 */

import path from 'path';
import { stripSurroundingQuotes, tokenize } from '../../shared/commandTokenizer';

// ========== 常量 ==========

/** 不支持的 shell 控制符，项目只允许单条 FFmpeg 命令 */
const SHELL_OPERATORS = new Set([
  '&&', '||', '|', ';',
  '>', '>>', '<', '<<',
  '2>', '2>>', '&>', '1>', '1>>',
]);

/**
 * 接受附加值的 FFmpeg 选项集合。
 * 这些选项后面跟的 token 是选项的值，不是输出文件。
 *
 * 注：此列表覆盖常见场景，无法穷举 FFmpeg 全部选项。
 * 识别输出文件的核心规则是：args 末尾最后一个非选项 token。
 *
 * 重要：只收录“带值”选项。`-vn` / `-an` / `-sn` / `-dn` / `-shortest`
 * 等是不带值的 flag，绝不能放入本集合——否则会把紧随其后的输出文件
 * 误当作“选项值”而跳过，导致输出识别失败（曾导致“移除音频”模板的
 * 输出文件识别不到）。
 */
const OPTIONS_WITH_VALUES = new Set([
  // 输入 / 容器 / demuxer 选项
  '-i', '-f', '-c', '-b', '-map', '-map_metadata', '-map_chapters',
  '-itsoffset', '-itsscale', '-loop', '-framerate', '-readrate',
  '-stream_loop', '-video_size', '-pixel_format', '-rtbufsize', '-safe',
  // 视频
  '-vf', '-filter', '-filter:v', '-filter_complex', '-lavfi',
  '-vcodec', '-c:v', '-b:v', '-maxrate', '-bufsize',
  '-r', '-s', '-aspect', '-vframes', '-fpsmax', '-vsync',
  '-vtag', '-tag:v', '-qscale', '-q:v', '-qmin', '-qmax',
  '-vbsf', '-bsf', '-bsf:v', '-profile:v', '-level',
  // 音频
  '-af', '-filter:a', '-acodec', '-c:a', '-b:a',
  '-ar', '-ac', '-vol', '-ab', '-aq', '-q:a', '-atag', '-tag:a',
  '-absf', '-bsf:a',
  // 字幕
  '-scodec', '-c:s', '-sbsf', '-bsf:s',
  // 时间
  '-ss', '-t', '-to', '-duration',
  // 元数据 / 章节 / 处置
  '-metadata', '-disposition', '-attach',
  // 编码器调参（通用 + 硬件）
  '-preset', '-tune', '-crf', '-pix_fmt', '-threads',
  '-pass', '-passlogfile', '-filter_threads',
  '-qcomp', '-psy-rd', '-aq-mode', '-aq-strength',
  '-cpu-used', '-row-mt',
  '-qp', '-qp_i', '-qp_p', '-global_quality', '-cq', '-quality', '-allow_sw',
  // 容器 / 标志位 / 其他
  '-movflags', '-fflags', '-flags', '-sws_flags', '-id3v2_version',
]);

// ========== 公共 API ==========

/**
 * 将 FFmpeg 命令字符串解析为参数数组。
 * 自动剥离开头的 `ffmpeg` 可执行文件名（大小写不敏感）。
 *
 * @param command FFmpeg 命令字符串
 * @returns       参数数组（不含 `ffmpeg` 本身）
 * @throws        引号未闭合时抛出
 */
export function parseFFmpegCommand(command: string): string[] {
  const trimmed = command.trim();

  // 剥离开头的 `ffmpeg` 可执行文件名
  // 使用正则处理大小写、多余空白及 Windows 上的 ffmpeg.exe
  const normalized = trimmed.replace(/^ffmpeg(?:\.exe)?\s+/i, '');

  const { tokens, unmatchedQuote } = tokenize(normalized);

  if (unmatchedQuote) {
    throw new Error('Unmatched quotes in command.');
  }

  return tokens;
}

/**
 * 检查参数列表中是否含有不支持的 shell 控制符。
 * 项目只支持单条 FFmpeg 命令，不允许管道、重定向等操作。
 */
export function containsUnsupportedShellOperators(args: string[]): boolean {
  return args.some((arg) => SHELL_OPERATORS.has(arg));
}

/**
 * 从解析后的参数数组中提取输出文件路径。
 *
 * 识别规则（从末尾倒序扫描）：
 * - token 不以 `-` 开头（非选项）
 * - token 不是某个已知接受值选项的参数值
 * - token 不是 `-`（stdout 占位符）或空字符串
 *
 * @param args 解析后的参数数组
 * @returns    输出文件路径；无法识别时返回 undefined
 */
export function extractOutputFile(args: string[]): string | undefined {
  for (let i = args.length - 1; i >= 0; i--) {
    const token = args[i];

    // 跳过选项 flag（以 - 开头）
    if (token.startsWith('-')) continue;

    // 跳过已知选项的值（当前 token 是前一个选项 flag 的参数）
    if (i > 0 && OPTIONS_WITH_VALUES.has(args[i - 1])) continue;

    // 规范化：剥离多余引号（tokenizer 未完全处理时的兜底）
    const output = stripSurroundingQuotes(token).trim();

    // 排除空值和 stdout 占位符
    if (!output || output === '-') return undefined;

    return output;
  }

  return undefined;
}

/**
 * 推导 FFmpeg 进程的工作目录。
 *
 * 规则：
 * - 若输出文件为绝对路径，优先使用其所在目录
 * - 否则使用第一个绝对输入文件所在目录
 * - 都无法识别时返回 undefined，交给进程继承默认 cwd
 *
 * 这样可以让模板中的相对输出文件、字幕文件、水印文件等，
 * 在用户已选择输入文件或输出目录时，尽量相对到更符合直觉的位置。
 */
export function deriveWorkingDirectory(args: string[]): string | undefined {
  // 优先使用第一个绝对路径输入文件所在目录。
  //
  // 理由：辅助输入（字幕 / 水印 / concat 列表 / 图片序列 / 背景音乐等）
  // 通常与主输入文件放在同一目录，相对解析到主输入目录更符合用户直觉。
  // 此前“输出目录优先”会让这些相对辅助文件落到输出目录而找不到，
  // 导致 ffmpeg 报 No such file，命令“不生效”。
  //
  // 输出文件由 GUI 改写为绝对路径（绑定用户选择的输出目录），因此 cwd
  // 不再影响输出写入位置——改优先级对输出无影响，对辅助输入是修复。
  const inputDir = args.reduce<string | undefined>((directory, token, index) => {
    if (directory || token !== '-i') {
      return directory;
    }

    const input = stripSurroundingQuotes(args[index + 1] ?? '').trim();
    return input && path.isAbsolute(input) ? path.dirname(input) : directory;
  }, undefined);
  if (inputDir) return inputDir;

  // 无绝对输入时回退到绝对输出目录：相对输出文件会写到该目录
  const outputFile = extractOutputFile(args);
  if (outputFile && path.isAbsolute(outputFile)) {
    return path.dirname(outputFile);
  }

  return undefined;
}
