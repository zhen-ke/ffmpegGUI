import { useEffect, useRef } from 'react';

interface GlobalHotkeysOptions {
  onStart: () => void;
  onCopyCommand: () => void;
  onClearLogs: () => void;
}

/**
 * 全局键盘快捷键 Hook
 *
 * 绑定：
 *   Cmd/Ctrl + Enter       → 启动 FFmpeg（即使焦点在 textarea 也生效）
 *   Cmd/Ctrl + Shift + C   → 复制命令
 *   Cmd/Ctrl + L           → 清空日志
 */
export function useGlobalHotkeys({
  onStart,
  onCopyCommand,
  onClearLogs,
}: GlobalHotkeysOptions) {
  const onStartRef = useRef(onStart);
  const onCopyRef = useRef(onCopyCommand);
  const onClearRef = useRef(onClearLogs);

  onStartRef.current = onStart;
  onCopyRef.current = onCopyCommand;
  onClearRef.current = onClearLogs;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd/Ctrl + Enter → 启动
      if (e.key === 'Enter') {
        e.preventDefault();
        onStartRef.current();
        return;
      }

      // Cmd/Ctrl + Shift + C → 复制命令
      if (e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        onCopyRef.current();
        return;
      }

      // Cmd/Ctrl + L → 清空日志
      if (!e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        onClearRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
