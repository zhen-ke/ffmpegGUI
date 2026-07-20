import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const DEFAULT_DURATION_MS = 5000;

let nextToastId = 0;

export function useToast(defaultDurationMs = DEFAULT_DURATION_MS) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (type: ToastType, message: string, durationMs = defaultDurationMs) => {
      const id = `toast-${nextToastId + 1}`;
      nextToastId += 1;
      setToasts((current) => [...current, { id, type, message }]);

      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [defaultDurationMs, dismissToast],
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  return { toasts, pushToast, dismissToast };
}
