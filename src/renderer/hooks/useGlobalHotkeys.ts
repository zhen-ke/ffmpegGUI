import { useEffect } from 'react';
import { useLatest } from './useLatest';

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
  const onStartRef = useLatest(onStart);
  const onCopyRef = useLatest(onCopyCommand);
  const onClearRef = useLatest(onClearLogs);

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
    // useLatest 返回稳定 ref，无需列入 deps（eslint 无法识别自定义 hook 返回稳定 ref）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
