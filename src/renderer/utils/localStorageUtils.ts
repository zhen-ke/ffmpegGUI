/**
 * 本地存储读写工具。
 *
 * renderer 进程无法使用 Node 的 fs / try-catch 语义，所有 localStorage 读写
 * 都需包裹 try/catch（隐私模式 / 配额超限 / JSON 解析失败均可能抛错）。
 * 统一在此收敛，避免 5+ 处样板重复。
 */

/**
 * 读取 localStorage 并反序列化；失败或缺失时返回 fallback。
 */
export function readLocalStorage<T>(
  key: string,
  fallback: T,
  deserialize: (raw: string) => T = JSON.parse,
): T {
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? deserialize(stored) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 序列化并写入 localStorage；失败时静默忽略（隐私模式 / 配额超限）。
 */
export function writeLocalStorage<T>(
  key: string,
  value: T,
  serialize: (value: T) => string = JSON.stringify,
): void {
  try {
    localStorage.setItem(key, serialize(value));
  } catch {
    /* ignore */
  }
}
