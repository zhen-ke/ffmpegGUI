/**
 * 文件选择管理 Hook
 * 管理输入文件和输出文件夹的选择和联动
 */

import { useCallback, useState } from 'react';

interface DialogResult {
  canceled: boolean;
  filePaths: string[];
}

export function useFileSelection() {
  const [inputFile, setInputFile] = useState<string>('');
  const [outputFolder, setOutputFolder] = useState<string>('');

  /**
   * 选择输入文件
   * @param onPathsUpdate 路径更新后的回调
   */
  const handleSelectInputFile = useCallback(
    async (onPathsUpdate?: (input: string, output: string) => void) => {
      try {
        const result: DialogResult = await window.electron.ipcRenderer.invoke(
          'select-input-file',
          inputFile,
        );

        if (result && !result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          setInputFile(filePath);

          // 智能联动：如果还没选输出目录，自动设置为输入文件所在目录
          if (!outputFolder) {
            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
            setOutputFolder(fileDir);
            onPathsUpdate?.(filePath, fileDir);
          } else {
            onPathsUpdate?.(filePath, outputFolder);
          }
        }
      } catch (error) {
        console.error('Failed to select input file:', error);
      }
    },
    [inputFile, outputFolder],
  );

  /**
   * 选择输出文件夹
   * @param onPathsUpdate 路径更新后的回调
   */
  const handleSelectOutputFolder = useCallback(
    async (onPathsUpdate?: (input: string, output: string) => void) => {
      try {
        const result: DialogResult = await window.electron.ipcRenderer.invoke(
          'select-output-folder',
          outputFolder,
        );

        if (result && !result.canceled && result.filePaths.length > 0) {
          const folderPath = result.filePaths[0];
          setOutputFolder(folderPath);

          if (inputFile) {
            onPathsUpdate?.(inputFile, folderPath);
          }
        }
      } catch (error) {
        console.error('Failed to select output folder:', error);
      }
    },
    [inputFile, outputFolder],
  );

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
