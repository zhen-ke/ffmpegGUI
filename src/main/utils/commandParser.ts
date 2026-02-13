/**
 * FFmpeg 命令解析工具
 * 解析和验证 FFmpeg 命令字符串
 */

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

function stripSurroundingQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * 解析 FFmpeg 命令为参数数组
 * 正确处理引号、转义字符和特殊情况
 *
 * @param command FFmpeg 命令字符串
 * @returns 参数数组
 */
export function parseFFmpegCommand(command: string): string[] {
  const args: string[] = [];
  let currentArg = '';
  let inQuotes = false;
  let inSingleQuotes = false;

  // 移除命令开头的 ffmpeg 如果存在
  command = command.trim();
  if (command.toLowerCase().startsWith('ffmpeg ')) {
    command = command.substring(7);
  }

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    // 反斜杠转义（兼容 Windows 路径和常见转义语法）
    if (char === '\\' && !inSingleQuotes) {
      const nextChar = command[i + 1];
      if (nextChar === undefined) {
        currentArg += '\\';
        continue;
      }

      if (inQuotes) {
        if (nextChar === '"' || nextChar === '\\') {
          currentArg += nextChar;
          i += 1;
          continue;
        }
        currentArg += '\\';
        continue;
      }

      if (/\s|["'\\]/.test(nextChar)) {
        currentArg += nextChar;
        i += 1;
        continue;
      }

      currentArg += '\\';
      continue;
    }

    // 处理双引号
    if (char === '"' && !inSingleQuotes) {
      inQuotes = !inQuotes;
      continue;
    }

    // 处理单引号
    if (char === "'" && !inQuotes) {
      inSingleQuotes = !inSingleQuotes;
      continue;
    }

    // 处理空格
    if (char === ' ' && !inQuotes && !inSingleQuotes) {
      if (currentArg) {
        args.push(currentArg);
        currentArg = '';
      }
      continue;
    }

    currentArg += char;
  }

  if (currentArg) {
    args.push(currentArg);
  }

  // 验证引号是否配对
  if (inQuotes || inSingleQuotes) {
    throw new Error('Unmatched quotes in command');
  }

  return args.filter((arg) => arg.length > 0).map(stripSurroundingQuotes);
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
    if (!args[i].startsWith('-') && i > 0 && args[i - 1] !== '-i') {
      const output = stripSurroundingQuotes(args[i]).trim();
      if (!output || output === '-') {
        return undefined;
      }
      return output;
    }
  }
  return undefined;
}

/**
 * 验证命令是否有效
 *
 * @param command 命令字符串
 * @returns 是否有效
 */
export function isValidCommand(command: string): boolean {
  const trimmed = command.trim();
  return trimmed.length > 0;
}
