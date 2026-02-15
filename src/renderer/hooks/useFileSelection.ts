/**
 * 文件选择管理 Hook
 * 管理输入文件和输出文件夹的选择和联动
 */

import { useCallback, useState } from 'react';

interface DialogResult {
  canceled: boolean;
  filePaths: string[];
}

/**
 * 获取文件所在目录（跨平台兼容）
 * 纯函数，提取到模块顶层避免每次渲染重新创建
 */
function getFileDirectory(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\'),
  );
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
}

export function useFileSelection() {
  const [inputFile, setInputFile] = useState<string>('');
  const [outputFolder, setOutputFolder] = useState<string>('');

  const handleSelectInputFile = useCallback(async () => {
    try {
      const result: DialogResult = await window.electron.ipcRenderer.invoke(
        'select-input-file',
        inputFile,
      );

      if (result && !result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        setInputFile(filePath);

        // 智能联动：如果还没选输出目录，自动设置为输入文件所在目录
        setOutputFolder((prevOutputFolder) => {
          if (prevOutputFolder) {
            return prevOutputFolder;
          }
          return getFileDirectory(filePath);
        });
      }
    } catch (error) {
      console.error('Failed to select input file:', error);
    }
  }, [inputFile]);

  /**
   * 选择输出文件夹
   */
  const handleSelectOutputFolder = useCallback(async () => {
    try {
      const result: DialogResult = await window.electron.ipcRenderer.invoke(
        'select-output-folder',
        outputFolder,
      );

      if (result && !result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        setOutputFolder(folderPath);
      }
    } catch (error) {
      console.error('Failed to select output folder:', error);
    }
  }, [outputFolder]);

  /**
   * 清除输入文件
   */
  const clearInputFile = useCallback(() => {
    setInputFile('');
  }, []);

  /**
   * 清除输出文件夹
   */
  const clearOutputFolder = useCallback(() => {
    setOutputFolder('');
  }, []);

  return {
    inputFile,
    outputFolder,
    handleSelectInputFile,
    handleSelectOutputFolder,
    clearInputFile,
    clearOutputFolder,
  };
}
