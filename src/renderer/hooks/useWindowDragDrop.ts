import { useCallback, useRef, useState, type DragEvent } from 'react';

/**
 * useWindowDragDrop handles global window drag and drop events.
 */
export function useWindowDragDrop(options: {
  onFileDrop: (filePath: string, index: number) => void;
  /** 拖入文件时按扩展名匹配模板（若未匹配则返回 false） */
  onMatchTemplate?: (filePath: string) => boolean;
}): {
  isWindowDragActive: boolean;
  dragHandlers: {
    onDragEnter: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDropCapture: (e: DragEvent) => void;
  };
} {
  const { onFileDrop, onMatchTemplate } = options;
  const [isWindowDragActive, setIsWindowDragActive] = useState(false);
  const dragCounter = useRef(0);

  const handleWindowDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsWindowDragActive(true);
    }
  }, []);

  const handleWindowDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsWindowDragActive(false);
    }
  }, []);

  const handleWindowDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * 捕获阶段的 drop 清理：命令框等深层组件在 drop 时调用
   * stopPropagation 后，冒泡阶段的 handleWindowDrop 不再执行，
   * isWindowDragActive 会残留为 true（drop 后浏览器不再触发 dragleave）。
   * 捕获阶段先于目标阶段执行、不受 stopPropagation 影响，在这里
   * 复位拖放状态；真正的文件处理仍在冒泡阶段的 handleWindowDrop 中，
   * 命令框内 drop 不会走到文件处理。
   */
  const handleWindowDropCapture = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsWindowDragActive(false);
    dragCounter.current = 0;
  }, []);

  const handleWindowDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsWindowDragActive(false);
      dragCounter.current = 0;

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        const file = files[0] as File & { path: string };
        if (file.path) {
          // 优先尝试按扩展名匹配模板；未匹配则回退为普通输入文件
          const matched = onMatchTemplate?.(file.path) ?? false;
          if (!matched) onFileDrop(file.path, 0);
        }
      }
    },
    [onFileDrop, onMatchTemplate],
  );

  return {
    isWindowDragActive,
    dragHandlers: {
      onDragEnter: handleWindowDragEnter,
      onDragLeave: handleWindowDragLeave,
      onDragOver: handleWindowDragOver,
      onDrop: handleWindowDrop,
      onDropCapture: handleWindowDropCapture,
    },
  };
}
