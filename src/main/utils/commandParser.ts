/**
 * FFmpeg 命令解析工具
 * 解析和验证 FFmpeg 命令字符串
 */

import path from 'path';
import {
  stripSurroundingQuotes,
  tokenize,
} from '../../shared/commandTokenizer';
import {
  FALLBACK_OPTIONS_WITH_VALUES,
  getOptionsWithValues,
  getOptionsWithValuesSync,
} from './ffmpegOptions';

// ========== 常量 ==========

/** 不支持的 shell 控制符，项目只允许单条 FFmpeg 命令 */
const SHELL_OPERATORS = new Set([
  '&&',
  '||',
  '|',
  ';',
  '>',
  '>>',
  '<',
  '<<',
  '2>',
  '2>>',
  '&>',
  '1>',
  '1>>',
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

/** 带值选项集合的外部可注入版本，供同步/异步场景共享 */
function extractOutputFileWithOptions(
  args: string[],
  optionsWithValues: ReadonlySet<string>,
): string | undefined {
  for (let i = args.length - 1; i >= 0; i--) {
    const token = args[i];

    if (token.startsWith('-')) continue;
    if (i > 0 && optionsWithValues.has(args[i - 1])) continue;

    const output = stripSurroundingQuotes(token).trim();
    if (!output || output === '-') return undefined;

    return output;
  }

  return undefined;
}

/**
 * 从解析后的参数数组中提取输出文件路径。
 *
 * 识别规则（从末尾倒序扫描）：
 * - token 不以 `-` 开头（非选项）
 * - token 不是某个已知接受值选项的参数值
 * - token 不是 `-`（stdout 占位符）或空字符串
 *
 * 带值选项集合优先来自 `ffmpeg -h full` 动态解析（缓存），
 * 未加载完成时回退到内置集合。
 *
 * @param args 解析后的参数数组
 * @param optionsWithValues 可注入的带值选项集合；默认异步解析（测试可注入）
 * @returns    输出文件路径；无法识别时返回 undefined
 */
export async function extractOutputFile(
  args: string[],
  optionsWithValues?: ReadonlySet<string>,
): Promise<string | undefined> {
  // 优先使用已加载的动态表；未加载过则异步解析真实表（失败回退内置集合）
  let opts = optionsWithValues ?? getOptionsWithValuesSync();
  if (!optionsWithValues && opts === FALLBACK_OPTIONS_WITH_VALUES) {
    opts = await getOptionsWithValues();
  }
  return extractOutputFileWithOptions(args, opts);
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
  const inputDir = args.reduce<string | undefined>(
    (directory, token, index) => {
      if (directory || token !== '-i') {
        return directory;
      }

      const input = stripSurroundingQuotes(args[index + 1] ?? '').trim();
      return input && path.isAbsolute(input) ? path.dirname(input) : directory;
    },
    undefined,
  );
  if (inputDir) return inputDir;

  // 无绝对输入时回退到绝对输出目录：相对输出文件会写到该目录。
  // 使用同步兜底集合（此时若动态表已加载则用动态表，否则用内置集合）。
  const optionsWithValues = getOptionsWithValuesSync();
  const outputFile = extractOutputFileWithOptions(args, optionsWithValues);
  if (outputFile && path.isAbsolute(outputFile)) {
    return path.dirname(outputFile);
  }

  return undefined;
}
