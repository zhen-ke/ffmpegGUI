/**
 * FFmpeg 命令处理工具函数
 * 提供命令解析、路径更新等功能
 */

import { tokenize } from '../../shared/commandTokenizer';

// ========== 常量 ==========

const DEFAULT_OUTPUT_FILENAME = 'output.mp4';

// ========== 内部工具 ==========

/**
 * 将命令拆分为 token，**保留原始引号**。
 * 用于命令重建场景——需要维持用户输入的原始格式。
 *
 * 注：项目的 `tokenize()` 工具会剥除引号，不适用于此场景，
 * 因此保留独立实现。
 */
function tokenizeRaw(command: string): string[] {
  return command.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
}

/**
 * 将命令拆分为 token 并剥除引号。
 * 用于命令分析场景——只关心参数的纯值。
 */
function tokenizeStripped(command: string): string[] {
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
    getFileName(stripWrappingQuotes(token)),
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

// ========== 公共 API ==========

/**
 * 统计命令中 `-i` 输入参数的数量。
 */
export function countInputArguments(command: string): number {
  const tokens = tokenizeRaw(command);
  let count = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === '-i') {
      count++;
      i++; // 跳过 -i 的值
    }
  }
  return count;
}

/**
 * 从命令中解析输出文件名。
 * 无法识别时返回默认值 `'output.mp4'`。
 */
export function parseOutputFileName(command: string): string {
  const tokens = tokenizeRaw(command);
  if (tokens.length === 0) return DEFAULT_OUTPUT_FILENAME;

  const last = tokens.at(-1)!;
  const prev = tokens.at(-2);

  // 末尾是 `-i <path>` 说明尚未指定输出文件
  if (prev === '-i') return DEFAULT_OUTPUT_FILENAME;

  const clean = stripWrappingQuotes(last);
  if (!clean || clean.startsWith('-')) return DEFAULT_OUTPUT_FILENAME;

  const fileName = getFileName(clean);
  if (!/\.[a-zA-Z0-9]+$/.test(fileName)) return DEFAULT_OUTPUT_FILENAME;
  if (isInputPlaceholder(last)) return DEFAULT_OUTPUT_FILENAME;

  return fileName;
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
  inputFile?: string,
  outputFolder?: string,
): string {
  const tokens = tokenizeRaw(command);

  // ── 替换输入路径 ──────────────────────────────────────
  if (inputFile) {
    // 收集所有 -i 的位置
    const inputFlagIndexes = tokens.reduce<number[]>((acc, t, i) => {
      if (t === '-i') acc.push(i);
      return acc;
    }, []);

    if (inputFlagIndexes.length === 0) {
      // 没有 -i，在命令开头插入
      tokens.unshift(quotePath(inputFile), '-i');
      // unshift 两个元素后顺序是 ['-i', quotePath]，需要修正
      // 实际：unshift 是从左到右插入，先插 quotePath 再插 -i 结果是 ['-i', quotePath, ...]
      // 上面写法已正确：unshift(a, b) 结果是 [a, b, ...original]
    } else {
      // 优先替换占位符输入；否则替换第一个 -i 的值
      const placeholderIdx = inputFlagIndexes.find((idx) =>
        isInputPlaceholder(tokens[idx + 1] ?? ''),
      );
      const targetIdx = placeholderIdx ?? inputFlagIndexes[0];

      if (tokens[targetIdx + 1] !== undefined) {
        tokens[targetIdx + 1] = quotePath(inputFile);
      } else {
        tokens.splice(targetIdx + 1, 0, quotePath(inputFile));
      }
    }
  }

  // ── 替换输出路径 ──────────────────────────────────────
  if (outputFolder) {
    // parseOutputFileName 直接在 tokens 上操作，避免 join→re-tokenize 往返
    const outputFileName = parseOutputFileName(tokens.join(' '));
    const quotedOutput   = quotePath(buildOutputPath(outputFolder, outputFileName));

    if (tokens.length === 0) {
      tokens.push(quotedOutput);
    } else {
      const lastIdx   = tokens.length - 1;
      const last      = tokens[lastIdx];
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
