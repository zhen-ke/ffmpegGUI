import { useRef } from 'react';

/**
 * 始终持有最新值的 ref，在渲染阶段同步。
 * 用于在 useCallback / useEffect 内读取最新 prop/state，同时保持依赖数组稳定。
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
