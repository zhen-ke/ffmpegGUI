/**
 * FFmpeg 命令解析工具
 * 解析和验证 FFmpeg 命令字符串
 */

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
 */
const OPTIONS_WITH_VALUES = new Set([
  // 输入 / 输出
  '-i', '-f',
  // 视频
  '-vf', '-vcodec', '-c:v', '-b:v', '-r', '-s', '-vn',
  // 音频
  '-af', '-acodec', '-c:a', '-b:a', '-ar', '-ac', '-an',
  // 时间
  '-ss', '-t', '-to', '-duration',
  // 流映射
  '-map', '-map_metadata', '-map_chapters',
  // 元数据 / 字幕
  '-metadata', '-disposition', '-scodec', '-c:s',
  // 其他常用
  '-preset', '-crf', '-pix_fmt', '-aspect', '-threads',
  '-pass', '-passlogfile', '-profile:v', '-level',
  '-movflags', '-fflags', '-flags',
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
