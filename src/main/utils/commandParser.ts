/**
 * FFmpeg 命令解析工具
 * 解析和验证 FFmpeg 命令字符串
 */

import {
    stripSurroundingQuotes,
    tokenize,
} from '../../shared/commandTokenizer';

const UNSUPPORTED_SHELL_OPERATOR_TOKENS = new Set([
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

/**
 * 解析 FFmpeg 命令为参数数组
 * 正确处理引号、转义字符和特殊情况
 *
 * @param command FFmpeg 命令字符串
 * @returns 参数数组
 */
export function parseFFmpegCommand(command: string): string[] {
  // 移除命令开头的 ffmpeg 如果存在
  let normalized = command.trim();
  if (normalized.toLowerCase().startsWith('ffmpeg ')) {
    normalized = normalized.substring(7);
  }

  const { tokens, unmatchedQuote } = tokenize(normalized);

  if (unmatchedQuote) {
    throw new Error('Unmatched quotes in command');
  }

  return tokens;
}

/**
 * 检查命令参数中是否包含不支持的 shell 控制符
 * 该项目只支持单条 FFmpeg 命令
 */
export function containsUnsupportedShellOperators(args: string[]): boolean {
  return args.some((arg) => UNSUPPORTED_SHELL_OPERATOR_TOKENS.has(arg));
}

/**
 * 从解析后的参数中提取输出文件路径
 *
 * @param args 解析后的参数数组
 * @returns 输出文件路径，如果找不到则返回 undefined
 */
export function extractOutputFile(args: string[]): string | undefined {
  // 查找可能的输出文件：最后一个不是选项且不跟在 -i 后面的参数
  for (let i = args.length - 1; i >= 0; i--) {
    if (
      !args[i].startsWith('-') &&
      i > 0 &&
      args[i - 1] !== '-i' &&
      args[i - 1] !== '-f'
    ) {
      const output = stripSurroundingQuotes(args[i]).trim();
      if (!output || output === '-') {
        return undefined;
      }
      return output;
    }
  }
  return undefined;
}
