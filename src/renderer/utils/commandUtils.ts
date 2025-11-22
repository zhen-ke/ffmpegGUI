/**
 * FFmpeg 命令处理工具函数
 * 提供命令解析、路径更新等功能
 */

/**
 * 从命令中解析输出文件名
 * @param command FFmpeg 命令字符串
 * @returns 输出文件名，默认为 'output.mp4'
 */
export function parseOutputFileName(command: string): string {
  const parts = command.trim().split(/\s+/);
  const lastPart = parts[parts.length - 1];

  // 检查最后一个参数是否是有效的输出文件名
  if (lastPart && !lastPart.startsWith('-') && !lastPart.includes('input')) {
    // 提取文件名和扩展名
    const match = lastPart.match(/([^/\\]+\.[a-zA-Z0-9]+)$/);
    if (match) {
      return match[1];
    }
  }

  return 'output.mp4';
}

/**
 * 更新命令中的输入和输出路径
 * 统一的命令路径更新逻辑，消除重复代码
 *
 * @param command 原始 FFmpeg 命令
 * @param inputFile 输入文件路径（可选）
 * @param outputFolder 输出文件夹路径（可选）
 * @returns 更新后的命令
 */
export function updateCommandPaths(
  command: string,
  inputFile?: string,
  outputFolder?: string,
): string {
  let newCommand = command;

  // 替换输入文件路径
  if (inputFile) {
    // 匹配并替换 -i 后的输入文件
    newCommand = newCommand.replace(
      /-i\s+["']?[^"'\s]+["']?/g,
      `-i "${inputFile}"`,
    );
    // 如果命令中没有 -i 参数，则在开头添加
    if (!newCommand.includes('-i')) {
      newCommand = `-i "${inputFile}" ${newCommand}`;
    }
  }

  // 替换输出文件路径
  if (outputFolder) {
    // 从原命令中提取输出文件名
    const outputFileName = parseOutputFileName(newCommand);
    const outputPath = `${outputFolder}/${outputFileName}`;

    // 替换最后一个不是参数的部分作为输出文件
    newCommand = newCommand.replace(/\s+[^-\s][^\s]*$/, ` "${outputPath}"`);
  }

  return newCommand;
}

/**
 * 在命令的指定位置插入文件路径
 * 用于处理拖放文件的场景
 *
 * @param command 原始命令
 * @param files 文件列表
 * @param position 插入位置（光标位置）
 * @returns 更新后的命令
 */
export function insertFilesIntoCommand(
  command: string,
  files: File[],
  position: number,
): string {
  const filePaths = files.map((file) => `"${file.path}"`).join(' ');
  const newCommand =
    command.substring(0, position) + filePaths + command.substring(position);
  return newCommand;
}

/**
 * 验证 FFmpeg 命令是否有效
 * @param command 要验证的命令
 * @returns 是否有效
 */
export function isValidFFmpegCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;

  // 至少应该包含一些参数
  return trimmed.length > 0;
}

/**
 * 清理命令字符串
 * 移除多余的空格和换行符
 *
 * @param command 原始命令
 * @returns 清理后的命令
 */
export function cleanCommand(command: string): string {
  return command
    .replace(/\s+/g, ' ') // 多个空格替换为单个空格
    .trim();
}
