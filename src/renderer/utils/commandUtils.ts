/**
 * FFmpeg 命令处理工具函数
 * 提供命令解析、路径更新等功能
 */

import { tokenize } from '../../shared/commandTokenizer';

/**
 * 将命令拆分为 token，保留引号原样
 * 用于命令重建场景（需要保持用户原始格式）
 */
function tokenizeCommand(command: string): string[] {
  const regex = /"[^"]*"|'[^']*'|\S+/g;
  return command.match(regex) || [];
}

/**
 * 将命令拆分为 token 并去除引号
 * 用于命令分析场景（需要纯值）
 */
function tokenizeAndStrip(command: string): string[] {
  return tokenize(command).tokens;
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function quotePath(pathValue: string): string {
  return `"${pathValue.replace(/"/g, '\\"')}"`;
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

function isInputPlaceholderToken(token: string): boolean {
  const normalized = getFileName(stripWrappingQuotes(token));
  return /^input\d*(\.[a-zA-Z0-9]+)?$/i.test(normalized);
}

function buildOutputPath(outputFolder: string, outputFileName: string): string {
  const normalizedFolder = outputFolder.replace(/[\\/]+$/, '');
  if (!normalizedFolder) {
    return outputFileName;
  }
  const separator =
    normalizedFolder.includes('\\') && !normalizedFolder.includes('/')
      ? '\\'
      : '/';
  return `${normalizedFolder}${separator}${outputFileName}`;
}

/**
 * 统计命令中输入参数（-i）的数量
 */
export function countInputArguments(command: string): number {
  const tokens = tokenizeCommand(command);
  let count = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === '-i' && tokens[i + 1]) {
      count += 1;
      i += 1;
    }
  }

  return count;
}

/**
 * 从命令中解析输出文件名
 * @param command FFmpeg 命令字符串
 * @returns 输出文件名，默认为 'output.mp4'
 */
export function parseOutputFileName(command: string): string {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    return 'output.mp4';
  }

  const lastIndex = tokens.length - 1;
  const lastToken = tokens[lastIndex];
  const previousToken = tokens[lastIndex - 1];

  // 末尾是 `-i <path>` 时，说明尚未指定输出文件
  if (previousToken === '-i') {
    return 'output.mp4';
  }

  const cleanLastToken = stripWrappingQuotes(lastToken);
  if (!cleanLastToken || cleanLastToken.startsWith('-')) {
    return 'output.mp4';
  }

  const outputFileName = getFileName(cleanLastToken);
  if (!/\.[a-zA-Z0-9]+$/.test(outputFileName)) {
    return 'output.mp4';
  }

  if (isInputPlaceholderToken(lastToken)) {
    return 'output.mp4';
  }

  return outputFileName;
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
  const tokens = tokenizeCommand(command);

  // 替换输入文件路径
  if (inputFile) {
    const inputIndexes: number[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i] === '-i') {
        inputIndexes.push(i);
      }
    }

    if (inputIndexes.length === 0) {
      tokens.unshift(quotePath(inputFile));
      tokens.unshift('-i');
    } else {
      const preferredIndex = inputIndexes.find((index) =>
        isInputPlaceholderToken(tokens[index + 1] ?? ''),
      );
      const targetIndex = preferredIndex ?? inputIndexes[0];

      if (tokens[targetIndex + 1]) {
        tokens[targetIndex + 1] = quotePath(inputFile);
      } else {
        tokens.splice(targetIndex + 1, 0, quotePath(inputFile));
      }
    }
  }

  // 替换输出文件路径
  if (outputFolder) {
    const outputFileName = parseOutputFileName(tokens.join(' '));
    const outputPath = buildOutputPath(outputFolder, outputFileName);
    const quotedOutputPath = quotePath(outputPath);

    if (tokens.length === 0) {
      tokens.push(quotedOutputPath);
    } else {
      const lastIndex = tokens.length - 1;
      const lastToken = tokens[lastIndex];
      const previousToken = tokens[lastIndex - 1];

      // 若命令末尾仍是选项或选项值（尚未给出输出文件），则追加输出路径
      const shouldAppendOutput =
        lastToken.startsWith('-') || (previousToken?.startsWith('-') ?? false);

      if (shouldAppendOutput) {
        tokens.push(quotedOutputPath);
      } else {
        tokens[lastIndex] = quotedOutputPath;
      }
    }
  }

  return tokens.join(' ').trim();
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
