/**
 * 命令管理 Hook
 * 管理 FFmpeg 命令的构建、更新和拖放处理
 */

import { DragEvent, useCallback, useState } from 'react';
import {
  insertFilesIntoCommand,
  updateCommandPaths,
} from '../utils/commandUtils';

interface UseCommandManagerProps {
  inputFile: string;
  outputFolder: string;
}

export function useCommandManager({
  inputFile,
  outputFolder,
}: UseCommandManagerProps) {
  const [command, setCommand] = useState('');

  /**
   * 更新命令（手动编辑）
   */
  const updateCommand = useCallback((newCommand: string) => {
    setCommand(newCommand);
  }, []);

  /**
   * 基于输入输出文件更新命令路径
   */
  const updateCommandWithPaths = useCallback(
    (
      baseCommand?: string,
      overrideInputFile?: string,
      overrideOutputFolder?: string,
    ) => {
      const cmdToUpdate = baseCommand ?? command;
      const finalInputFile = overrideInputFile ?? inputFile;
      const finalOutputFolder = overrideOutputFolder ?? outputFolder;

      const updatedCommand = updateCommandPaths(
        cmdToUpdate,
        finalInputFile,
        finalOutputFolder,
      );
      setCommand(updatedCommand);
    },
    [command, inputFile, outputFolder],
  );

  /**
   * 处理拖放文件
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * 处理文件放置
   */
  const handleDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      const textarea = e.currentTarget;
      const cursorPosition = textarea.selectionStart;

      const newCommand = insertFilesIntoCommand(command, files, cursorPosition);
      setCommand(newCommand);
    },
    [command],
  );

  /**
   * 清空命令
   */
  const clearCommand = useCallback(() => {
    setCommand('');
  }, []);

  /**
   * 复制命令
   */
  const copyCommand = useCallback(() => {
    if (command) {
      navigator.clipboard.writeText(command);
    }
  }, [command]);

  return {
    command,
    updateCommand,
    updateCommandWithPaths,
    handleDragOver,
    handleDrop,
    clearCommand,
    copyCommand,
  };
}
