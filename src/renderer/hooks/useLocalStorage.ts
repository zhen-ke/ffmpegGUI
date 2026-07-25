import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  readLocalStorage,
  writeLocalStorage,
} from '../utils/localStorageUtils';

export interface UseLocalStorageOptions<T> {
  /** 序列化（默认 JSON.stringify） */
  serialize?: (value: T) => string;
  /** 反序列化（默认 JSON.parse） */
  deserialize?: (raw: string) => T;
}

/**
 * localStorage 驱动的 useState：读写自带 try/catch，写入自动持久化。
 *
 * 取代散落各处的「useState 初始化时 try/catch 读 + useEffect/回调里 try/catch 写」样板。
 * setStored 支持直接值或函数式更新（与 useState 一致），并在更新后自动写盘。
 *
 * @param key          存储键
 * @param initialValue 读取失败/缺失时的初始值
 * @param options      可选的序列化/反序列化函数（建议传模块级稳定函数）
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options;

  // 初次挂载时读取一次；deserialize 仅在此处使用，函数式更新中读取 serialize
  const [value, setValue] = useState<T>(() =>
    readLocalStorage<T>(key, initialValue, deserialize),
  );

  const setStored = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      setValue((prev) => {
        const next =
          typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
        writeLocalStorage(key, next, serialize);
        return next;
      });
    },
    [key, serialize],
  );

  return [value, setStored];
}
