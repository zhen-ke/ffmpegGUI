/**
 * 命令管理 Hook
 * 管理 FFmpeg 命令的构建、更新和拖放处理
 */

import { DragEvent, useCallback, useRef, useState } from 'react';
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
  const commandRef = useRef(command);
  const inputFileRef = useRef(inputFile);
  const outputFolderRef = useRef(outputFolder);
  commandRef.current = command;
  inputFileRef.current = inputFile;
  outputFolderRef.current = outputFolder;

  /**
   * 更新命令（手动编辑）
   */
  const updateCommand = useCallback((newCommand: string) => {
    commandRef.current = newCommand;
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
      const cmdToUpdate = baseCommand ?? commandRef.current;
      const finalInputFile = overrideInputFile ?? inputFileRef.current;
      const finalOutputFolder = overrideOutputFolder ?? outputFolderRef.current;

      const updatedCommand = updateCommandPaths(
        cmdToUpdate,
        finalInputFile,
        finalOutputFolder,
      );

      commandRef.current = updatedCommand;
      setCommand(updatedCommand);
    },
    [],
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
  const handleDrop = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const textarea = e.currentTarget;
    const cursorPosition = textarea.selectionStart;

    setCommand((prevCommand) => {
      const newCommand = insertFilesIntoCommand(
        prevCommand,
        files,
        cursorPosition,
      );
      commandRef.current = newCommand;
      return newCommand;
    });
  }, []);

  /**
   * 清空命令
   */
  const clearCommand = useCallback(() => {
    commandRef.current = '';
    setCommand('');
  }, []);

  /**
   * 复制命令
   */
  const copyCommand = useCallback(() => {
    if (commandRef.current) {
      navigator.clipboard.writeText(commandRef.current);
    }
  }, []);

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
