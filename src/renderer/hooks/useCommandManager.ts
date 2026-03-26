/**
 * 命令管理 Hook
 * 管理 FFmpeg 命令的构建、更新和拖放处理
 */

import { DragEvent, useCallback, useState } from 'react';
import {
  insertFilesIntoCommand,
  updateCommandPaths,
} from '../utils/commandUtils';
import { useLatest } from './useLatest';

// ========== 类型 ==========

interface UseCommandManagerProps {
  inputFile: string;
  outputFolder: string;
}

export type ClipboardResult = 'success' | 'empty' | 'error';

// ========== Hook ==========

export function useCommandManager({
  inputFile,
  outputFolder,
}: UseCommandManagerProps) {
  const [command, setCommand] = useState('');

  // 通过 useLatest 统一管理"最新值"，不再在每个 setter 里手动同步 ref
  const commandRef     = useLatest(command);
  const inputFileRef   = useLatest(inputFile);
  const outputFolderRef = useLatest(outputFolder);

  /**
   * 更新命令（手动编辑）
   */
  const updateCommand = useCallback((newCommand: string) => {
    setCommand(newCommand);
  }, []);

  /**
   * 基于输入/输出路径更新命令中的文件路径占位符。
   * 参数均可选，不传则使用当前最新值。
   */
  const updateCommandWithPaths = useCallback(
    (
      baseCommand?: string,
      overrideInputFile?: string,
      overrideOutputFolder?: string,
    ) => {
      const updated = updateCommandPaths(
        baseCommand       ?? commandRef.current,
        overrideInputFile ?? inputFileRef.current,
        overrideOutputFolder ?? outputFolderRef.current,
      );
      setCommand(updated);
    },
    // refs 引用稳定，无需列入 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * 处理拖拽悬停：阻止默认行为以允许放置。
   * 不调用 stopPropagation，保留父组件响应拖拽事件的能力。
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  /**
   * 处理文件放置：将文件路径插入光标位置。
   * cursorPosition 在事件处理器同步帧内读取，避免异步 setState 回调中
   * currentTarget 已被 React 清空的问题。
   */
  const handleDrop = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files);
    // 在同步帧内读取，不在 setCommand 回调内访问 e.currentTarget
    const cursorPosition = e.currentTarget.selectionStart;

    setCommand((prev) => insertFilesIntoCommand(prev, files, cursorPosition));
  }, []);

  /**
   * 清空命令
   */
  const clearCommand = useCallback(() => {
    setCommand('');
  }, []);

  /**
   * 复制命令到剪贴板。
   * trim 后判空，复制同样使用 trim 后的内容，保持一致。
   */
  const copyCommand = useCallback(async (): Promise<ClipboardResult> => {
    const trimmed = commandRef.current.trim();
    if (!trimmed) return 'empty';

    try {
      await navigator.clipboard.writeText(trimmed);
      return 'success';
    } catch (error) {
      console.error('Failed to copy command:', error);
      return 'error';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
