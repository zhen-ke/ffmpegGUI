/**
 * 命令 Tokenizer（共享模块）
 * 在主进程和渲染进程之间共享的命令分词器
 *
 * 使用字符级解析，正确处理引号、转义字符等边界情况。
 * 纯函数，无 Node/Electron 依赖。
 */

/** tokenize 可选行为开关 */
export interface TokenizeOptions {
  /**
   * 是否在 token 中保留外层引号（默认 false，剥除引号）。
   *
   * - false：用于命令分析场景（提取输入/输出路径的纯值）。
   * - true：用于命令重建场景（需要保留用户原始引号格式做 round-trip）。
   *
   * 无论何种模式，字符级解析与 unmatchedQuote 语义完全一致，
   * 仅在末尾是否 `.map(stripSurroundingQuotes)` 上有差别。
   */
  preserveQuotes?: boolean;
}

/**
 * 去除字符串两端的匹配引号
 */
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

export { stripSurroundingQuotes };

/**
 * 将命令字符串拆分为 token 数组
 * 正确处理双引号、单引号和反斜杠转义
 *
 * 与简单正则不同，此函数能正确处理：
 * - 引号内的空格
 * - 反斜杠转义
 * - 嵌套引号
 *
 * @param input    命令字符串
 * @param options  preserveQuotes 为 true 时保留外层引号（用于命令重建）
 * @returns token 数组和引号是否匹配
 */
export function tokenize(
  input: string,
  options: TokenizeOptions = {},
): {
  tokens: string[];
  unmatchedQuote: boolean;
} {
  const { preserveQuotes = false } = options;
  const tokens: string[] = [];
  let current = '';
  // 与 current 并行的原始缓冲：保留界定引号与原始转义序列。
  // preserveQuotes 模式下推送此缓冲，确保命令重建 round-trip 时
  // 用户原始的引号/转义格式不丢失。
  let currentRaw = '';
  let inDoubleQuotes = false;
  let inSingleQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    // 反斜杠转义（单引号内不转义）
    if (char === '\\' && !inSingleQuotes) {
      const nextChar = input[i + 1];
      if (nextChar === undefined) {
        current += '\\';
        currentRaw += '\\';
        continue;
      }

      if (inDoubleQuotes) {
        if (nextChar === '"' || nextChar === '\\') {
          current += nextChar;
          // 保留原始转义序列（含反斜杠）
          currentRaw += char + nextChar;
          i += 1;
          continue;
        }
        current += '\\';
        currentRaw += '\\';
        continue;
      }

      if (/\s|["'\\]/.test(nextChar)) {
        current += nextChar;
        currentRaw += char + nextChar;
        i += 1;
        continue;
      }

      current += '\\';
      currentRaw += '\\';
      continue;
    }

    // 双引号
    if (char === '"' && !inSingleQuotes) {
      inDoubleQuotes = !inDoubleQuotes;
      // preserveQuotes 模式下保留界定引号到原始缓冲
      if (preserveQuotes) currentRaw += char;
      continue;
    }

    // 单引号
    if (char === "'" && !inDoubleQuotes) {
      inSingleQuotes = !inSingleQuotes;
      if (preserveQuotes) currentRaw += char;
      continue;
    }

    // 空格（非引号内）
    if (char === ' ' && !inDoubleQuotes && !inSingleQuotes) {
      if (current) {
        tokens.push(preserveQuotes ? currentRaw : current);
        current = '';
        currentRaw = '';
      }
      continue;
    }

    current += char;
    currentRaw += char;
  }

  if (current) {
    tokens.push(preserveQuotes ? currentRaw : current);
  }

  const unmatchedQuote = inDoubleQuotes || inSingleQuotes;

  const strippedTokens = tokens.filter((t) => t.length > 0);
  return {
    tokens: preserveQuotes
      ? strippedTokens
      : strippedTokens.map(stripSurroundingQuotes),
    unmatchedQuote,
  };
}
