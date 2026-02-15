/**
 * 命令 Tokenizer（共享模块）
 * 在主进程和渲染进程之间共享的命令分词器
 *
 * 使用字符级解析，正确处理引号、转义字符等边界情况。
 * 纯函数，无 Node/Electron 依赖。
 */

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
 * @param input 命令字符串
 * @returns token 数组和引号是否匹配
 */
export function tokenize(input: string): {
  tokens: string[];
  unmatchedQuote: boolean;
} {
  const tokens: string[] = [];
  let current = '';
  let inDoubleQuotes = false;
  let inSingleQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    // 反斜杠转义（单引号内不转义）
    if (char === '\\' && !inSingleQuotes) {
      const nextChar = input[i + 1];
      if (nextChar === undefined) {
        current += '\\';
        continue;
      }

      if (inDoubleQuotes) {
        if (nextChar === '"' || nextChar === '\\') {
          current += nextChar;
          i += 1;
          continue;
        }
        current += '\\';
        continue;
      }

      if (/\s|["'\\]/.test(nextChar)) {
        current += nextChar;
        i += 1;
        continue;
      }

      current += '\\';
      continue;
    }

    // 双引号
    if (char === '"' && !inSingleQuotes) {
      inDoubleQuotes = !inDoubleQuotes;
      continue;
    }

    // 单引号
    if (char === "'" && !inDoubleQuotes) {
      inSingleQuotes = !inSingleQuotes;
      continue;
    }

    // 空格（非引号内）
    if (char === ' ' && !inDoubleQuotes && !inSingleQuotes) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  const unmatchedQuote = inDoubleQuotes || inSingleQuotes;

  return {
    tokens: tokens
      .filter((t) => t.length > 0)
      .map(stripSurroundingQuotes),
    unmatchedQuote,
  };
}
