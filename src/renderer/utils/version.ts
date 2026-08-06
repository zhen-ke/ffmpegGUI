/**
 * 版本号解析与比较（仅数字主版本，忽略 `-full_build`、`(OSXExperts)` 等后缀）。
 */

/**
 * 从任意字符串中提取数字版本号，如 `7.1.1 (OSXExperts)` → `[7, 1, 1]`。
 * 无法解析（如 `latest`）或输入为空返回 null。
 */
export function parseVersion(
  value: string | null | undefined,
): number[] | null {
  if (!value) return null;
  const match = value.match(/\d+(?:\.\d+)*/);
  if (!match) return null;
  return match[0].split('.').map(Number);
}

/**
 * 是否存在可用更新（latestVersion 是否比 currentVersion 新）。
 *
 * 任一侧版本号无法解析时保守返回 true：无法确认「已是最新」，
 * 交由用户在确认弹窗中决定是否更新。
 */
export function hasUpdate(
  latestVersion: string | null | undefined,
  currentVersion: string | null | undefined,
): boolean {
  const latest = parseVersion(latestVersion);
  const current = parseVersion(currentVersion);
  if (!latest || !current) return true;

  const length = Math.max(latest.length, current.length);
  for (let i = 0; i < length; i += 1) {
    const a = latest[i] ?? 0;
    const b = current[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false; // 完全相同
}
