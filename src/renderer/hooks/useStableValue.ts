/**
 * useStableValue — 值稳定性 hook
 *
 * 当传入的 `value` 在结构上与上一次相等时，返回上一次的引用，
 * 从而让下游 `useMemo` / `React.memo` 的引用相等性判断生效。
 *
 * 典型场景：从 `command`（高频变化）派生出的解析结果数组——
 * 即便 `command` 每个按键都变，解析结果可能不变，但纯函数每次都返回新数组，
 * 导致下游 memo 失效、整棵子树重渲。本 hook 用 JSON 序列化做值比较，
 * 把"值相等"转成"引用相等"。
 *
 * 仅适用于可安全 JSON.stringify 的值（字符串/数字数组、纯对象等），
 * 不适合含函数、循环引用或超大对象。inputArguments 这类小数组是理想场景。
 */
import { useRef } from 'react';

export function useStableValue<T>(value: T): T {
  const ref = useRef<T>(value);
  const prevKey = useRef<string | null>(null);

  let key: string;
  try {
    key = JSON.stringify(value);
  } catch {
    // 不可序列化的值直接透传，不做稳定性优化
    return value;
  }

  if (key !== prevKey.current) {
    ref.current = value;
    prevKey.current = key;
  }

  return ref.current;
}
