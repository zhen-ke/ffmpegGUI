import { useCallback, useRef, useState, type DragEvent } from 'react';

/**
 * useWindowDragDrop handles global window drag and drop events.
 */
export function useWindowDragDrop(options: {
  onFileDrop: (filePath: string, index: number) => void;
}): {
  isWindowDragActive: boolean;
  dragHandlers: {
    onDragEnter: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
  };
} {
  const { onFileDrop } = options;
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
          onFileDrop(file.path, 0);
        }
      }
    },
    [onFileDrop],
  );

  return {
    isWindowDragActive,
    dragHandlers: {
      onDragEnter: handleWindowDragEnter,
      onDragLeave: handleWindowDragLeave,
      onDragOver: handleWindowDragOver,
      onDrop: handleWindowDrop,
    },
  };
}
