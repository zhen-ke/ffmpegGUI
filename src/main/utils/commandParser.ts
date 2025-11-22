/**
 * FFmpeg 命令解析工具
 * 解析和验证 FFmpeg 命令字符串
 */

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
  let escapeNext = false;

  // 移除命令开头的 ffmpeg 如果存在
  command = command.trim();
  if (command.toLowerCase().startsWith('ffmpeg ')) {
    command = command.substring(7);
  }

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escapeNext) {
      currentArg += `\\${char}`;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    // 处理双引号
    if (char === '"' && !inSingleQuotes) {
      inQuotes = !inQuotes;
      currentArg += char;
      continue;
    }

    // 处理单引号
    if (char === "'" && !inQuotes) {
      inSingleQuotes = !inSingleQuotes;
      currentArg += char;
      continue;
    }

    // 处理空格
    if (char === ' ' && !inQuotes && !inSingleQuotes) {
      if (currentArg) {
        // 处理特殊情况：数字后的冒号不应被分割 (例如 scale=480:-1)
        if (
          args.length > 0 &&
          currentArg === ':' &&
          /^\d+$/.test(args[args.length - 1])
        ) {
          args[args.length - 1] += ':';
        } else {
          args.push(currentArg);
        }
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
    console.warn('Warning: Unmatched quotes in command');
  }

  // 处理空参数和添加必要的引号
  return args
    .filter((arg) => arg.length > 0)
    .map((arg) => {
      // 如果参数是选项标志，保持原样
      if (arg.startsWith('-')) {
        return arg;
      }

      // 如果参数包含特殊字符但没有引号，添加双引号
      if (
        !arg.startsWith('"') &&
        !arg.startsWith("'") &&
        (arg.includes(' ') || arg.includes(';') || arg.includes('|'))
      ) {
        return `"${arg}"`;
      }

      return arg;
    });
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
      // 移除引号
      return args[i].replace(/^"|"$/g, '').trim();
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
