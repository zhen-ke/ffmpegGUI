/**
 * 文件选择管理 Hook
 * 管理输入文件和输出文件夹的选择和联动
 */

import { useCallback, useState } from 'react';
import { useLatest } from './useLatest';
import { ipcInvoke } from '../ipc/ipcTyped';

/**
 * 从文件路径中提取所在目录（兼容 `/` 和 `\` 分隔符）。
 *
 * 注：renderer 进程无法直接使用 Node.js path 模块，
 * 此处用字符串操作替代 path.dirname，逻辑与主进程保持一致。
 */
function getFileDirectory(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\'),
  );
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
}

// ========== 类型 ==========

interface UseFileSelectionProps {
  onError?: (message: string) => void;
}

// ========== Hook ==========

export function useFileSelection({ onError }: UseFileSelectionProps = {}) {
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState('');

  // useLatest 消除 handler 对 state 和 onError 的依赖，避免频繁重建引用
  const inputFilesRef = useLatest(inputFiles);
  const outputFolderRef = useLatest(outputFolder);
  const onErrorRef = useLatest(onError);

  /**
   * 打开文件选择对话框，选中后自动联动输出目录。
   * 若输出目录已设置则不覆盖。
   */
  const handleSelectInputFile = useCallback(async (index = 0) => {
    try {
      const result = await ipcInvoke(
        'select-input-file',
        inputFilesRef.current[index] ?? inputFilesRef.current[0] ?? '',
      );

      if (result.canceled || result.filePaths.length === 0) return '';

      const filePath = result.filePaths[0];
      setInputFiles((prev) => {
        const next = [...prev];
        next[index] = filePath;
        return next;
      });

      // 智能联动：输出目录为空时自动设为输入文件所在目录
      if (index === 0) {
        setOutputFolder((prev) => prev || getFileDirectory(filePath));
      }

      return filePath;
    } catch (error) {
      console.error('Failed to select input file:', error);
      onErrorRef.current?.('Failed to select input file. Please try again.');
      return '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 打开文件夹选择对话框。
   */
  const handleSelectOutputFolder = useCallback(async () => {
    try {
      const result = await ipcInvoke(
        'select-output-folder',
        outputFolderRef.current,
      );

      if (result.canceled || result.filePaths.length === 0) return;

      setOutputFolder(result.filePaths[0]);
    } catch (error) {
      console.error('Failed to select output folder:', error);
      onErrorRef.current?.('Failed to select output folder. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearInputFile = useCallback((index = 0) => {
    setInputFiles((prev) => {
      const next = [...prev];
      next[index] = '';

      while (next.length > 0 && !next[next.length - 1]) {
        next.pop();
      }

      return next;
    });
  }, []);
  const clearOutputFolder = useCallback(() => setOutputFolder(''), []);

  const handleInputFileDrop = useCallback(
    (filePath: string, index = 0) => {
      setInputFiles((prev) => {
        const next = [...prev];
        next[index] = filePath;
        return next;
      });

      if (index === 0) {
        setOutputFolder((prev) => prev || getFileDirectory(filePath));
      }
    },
    [],
  );

  const handleOutputFolderDrop = useCallback(
    (folderPath: string) => {
      setOutputFolder(folderPath);
    },
    [],
  );

  return {
    inputFile: inputFiles[0] ?? '',
    inputFiles,
    outputFolder,
    handleSelectInputFile,
    handleSelectOutputFolder,
    clearInputFile,
    clearOutputFolder,
    handleInputFileDrop,
    handleOutputFolderDrop,
  };
}

export default useFileSelection;
