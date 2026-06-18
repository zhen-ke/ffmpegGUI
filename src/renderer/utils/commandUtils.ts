/**
 * FFmpeg 命令处理工具函数
 * 提供命令解析、路径更新等功能
 */

import {
  stripSurroundingQuotes,
  tokenize,
} from '../../shared/commandTokenizer';

// ========== 常量 ==========

const DEFAULT_OUTPUT_FILENAME = 'output.mp4';

// ========== 内部工具 ==========

/**
 * 将命令拆分为 token，**保留原始引号**。
 * 用于命令重建场景——需要维持用户输入的原始格式做 round-trip。
 * 复用共享的字符级 tokenize，与主进程分词语义保持一致。
 */
function tokenizePreservingQuotes(command: string): string[] {
  return tokenize(command, { preserveQuotes: true }).tokens;
}

/**
 * 将路径用双引号包裹，转义内部双引号。
 * 前提：路径来自系统文件选择器，不含换行或 null 字节等非法字符。
 */
function quotePath(p: string): string {
  return `"${p.replace(/"/g, '\\"')}"`;
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

/** 判断 token 是否为输入占位符（如 `input.mp4`、`input2.mkv`、`input`） */
function isInputPlaceholder(token: string): boolean {
  return /^input\d*(\.[a-zA-Z0-9]+)?$/i.test(
    getFileName(stripSurroundingQuotes(token)),
  );
}

/**
 * 拼接输出目录与文件名。
 * 统一使用正斜杠（FFmpeg 跨平台兼容），去除尾部多余分隔符。
 */
function buildOutputPath(folder: string, fileName: string): string {
  const normalized = folder.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  return normalized ? `${normalized}/${fileName}` : fileName;
}

function sanitizeOutputFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/[\\/]/g, '');
  return trimmed || DEFAULT_OUTPUT_FILENAME;
}

// ========== 公共 API ==========

/**
 * 统计命令中 `-i` 输入参数的数量。
 */
export function countInputArguments(command: string): number {
  const tokens = tokenizePreservingQuotes(command);
  return tokens.reduce((count, token, index) => {
    if (token !== '-i' || index >= tokens.length - 1) {
      return count;
    }

    return count + 1;
  }, 0);
}

/**
 * 提取命令中所有 `-i` 对应的输入值。
 */
export function parseInputArguments(command: string): string[] {
  const tokens = tokenizePreservingQuotes(command);
  return tokens.reduce<string[]>((inputs, token, index) => {
    if (token === '-i' && index < tokens.length - 1) {
      inputs.push(stripSurroundingQuotes(tokens[index + 1] ?? '').trim());
    }

    return inputs;
  }, []);
}

/**
 * 从命令中解析输出文件名。
 * 无法识别时返回默认值 `'output.mp4'`。
 */
export function parseOutputFileName(command: string): string {
  const tokens = tokenizePreservingQuotes(command);
  if (tokens.length === 0) return DEFAULT_OUTPUT_FILENAME;

  const last = tokens.at(-1)!;
  const prev = tokens.at(-2);

  // 末尾是 `-i <path>` 说明尚未指定输出文件
  if (prev === '-i') return DEFAULT_OUTPUT_FILENAME;

  const clean = stripSurroundingQuotes(last);
  if (!clean || clean.startsWith('-')) return DEFAULT_OUTPUT_FILENAME;

  const fileName = getFileName(clean);
  if (!/\.[a-zA-Z0-9]+$/.test(fileName)) return DEFAULT_OUTPUT_FILENAME;
  if (isInputPlaceholder(last)) return DEFAULT_OUTPUT_FILENAME;

  return fileName;
}

function getInputFlagIndexes(tokens: string[]): number[] {
  return tokens.reduce<number[]>((indexes, token, index) => {
    if (token === '-i') indexes.push(index);
    return indexes;
  }, []);
}

function createInputPlaceholder(
  currentValue: string | undefined,
  index: number,
): string {
  const currentFileName = getFileName(
    stripSurroundingQuotes(currentValue ?? ''),
  );
  const extensionMatch = currentFileName.match(/(\.[a-zA-Z0-9]+)$/);
  const baseName = index === 0 ? 'input' : `input${index + 1}`;

  return `${baseName}${extensionMatch?.[1] ?? ''}`;
}

export function updateInputArgument(
  command: string,
  inputIndex: number,
  nextFilePath?: string,
): string {
  if (inputIndex < 0) return command.trim();

  const tokens = tokenizePreservingQuotes(command);
  const inputFlagIndexes = getInputFlagIndexes(tokens);
  const targetIndex = inputFlagIndexes[inputIndex];

  if (targetIndex === undefined) {
    if (!nextFilePath || inputIndex !== 0 || inputFlagIndexes.length > 0) {
      return tokens.join(' ').trim();
    }

    tokens.unshift('-i', quotePath(nextFilePath));
    return tokens.join(' ').trim();
  }

  if (nextFilePath) {
    if (tokens[targetIndex + 1] !== undefined) {
      tokens[targetIndex + 1] = quotePath(nextFilePath);
    } else {
      tokens.splice(targetIndex + 1, 0, quotePath(nextFilePath));
    }

    return tokens.join(' ').trim();
  }

  tokens[targetIndex + 1] = createInputPlaceholder(
    tokens[targetIndex + 1],
    inputIndex,
  );

  return tokens.join(' ').trim();
}

export function buildOutputPreview(
  outputFolder: string,
  outputFileName: string,
): string {
  return outputFolder
    ? buildOutputPath(outputFolder, sanitizeOutputFileName(outputFileName))
    : sanitizeOutputFileName(outputFileName);
}

export function updateOutputFileName(
  command: string,
  outputFileName: string,
  outputFolder?: string,
): string {
  const tokens = tokenizePreservingQuotes(command);
  const nextOutput = quotePath(
    buildOutputPreview(outputFolder ?? '', outputFileName),
  );

  if (tokens.length === 0) {
    return nextOutput;
  }

  const lastIndex = tokens.length - 1;
  const lastToken = tokens[lastIndex];
  const previousToken = tokens[lastIndex - 1];
  const shouldAppend =
    lastToken.startsWith('-') || (previousToken?.startsWith('-') ?? false);

  if (shouldAppend) {
    tokens.push(nextOutput);
  } else {
    tokens[lastIndex] = nextOutput;
  }

  return tokens.join(' ').trim();
}

/**
 * 更新命令中的输入文件路径和输出文件夹路径。
 *
 * - 输入路径：替换第一个占位符 `-i input*`，无占位符则替换第一个 `-i`，
 *             完全没有 `-i` 则在命令开头插入。
 * - 输出路径：替换命令末尾的输出文件 token，或在末尾追加。
 *
 * @param command      原始 FFmpeg 命令
 * @param inputFile    输入文件路径（可选）
 * @param outputFolder 输出文件夹路径（可选）
 * @returns            更新后的命令字符串
 */
export function updateCommandPaths(
  command: string,
  inputFile?: string | string[],
  outputFolder?: string,
): string {
  const tokens = tokenizePreservingQuotes(command);

  // ── 替换输入路径 ──────────────────────────────────────
  if (inputFile) {
    const normalizedInputFiles = Array.isArray(inputFile)
      ? inputFile
      : [inputFile];

    normalizedInputFiles.forEach((filePath, index) => {
      if (!filePath) return;

      const updatedCommand = updateInputArgument(
        tokens.join(' '),
        index,
        filePath,
      );
      tokens.splice(
        0,
        tokens.length,
        ...tokenizePreservingQuotes(updatedCommand),
      );
    });
  }

  // ── 替换输出路径 ──────────────────────────────────────
  if (outputFolder) {
    // parseOutputFileName 直接在 tokens 上操作，避免 join→re-tokenize 往返
    const outputFileName = parseOutputFileName(tokens.join(' '));
    const quotedOutput = quotePath(
      buildOutputPath(outputFolder, outputFileName),
    );

    if (tokens.length === 0) {
      tokens.push(quotedOutput);
    } else {
      const lastIdx = tokens.length - 1;
      const last = tokens[lastIdx];
      const prevToken = tokens[lastIdx - 1];

      // 末尾是选项 flag 或选项值时追加；否则替换
      const shouldAppend =
        last.startsWith('-') || (prevToken?.startsWith('-') ?? false);

      if (shouldAppend) {
        tokens.push(quotedOutput);
      } else {
        tokens[lastIdx] = quotedOutput;
      }
    }
  }

  return tokens.join(' ').trim();
}

/**
 * 在光标位置插入拖放文件的路径。
 *
 * 注：`file.path` 是 Electron 对 File API 的扩展，仅在 Electron renderer 中可用。
 */
export function insertFilesIntoCommand(
  command: string,
  files: File[],
  position: number,
): string {
  const filePaths = files
    .map((file) => quotePath((file as File & { path: string }).path))
    .join(' ');

  return command.slice(0, position) + filePaths + command.slice(position);
}
