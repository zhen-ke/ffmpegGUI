/**
 * 命令管理 Hook
 * 管理 FFmpeg 命令的构建、更新和拖放处理
 */

import {
  DragEvent,
  useCallback,
  useReducer,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  insertFilesIntoCommand,
  updateCommandPaths,
} from '../utils/commandUtils';
import { useLatest } from './useLatest';

// ========== 类型 ==========

interface UseCommandManagerProps {
  inputFiles: string[];
  outputFolder: string;
}

export type ClipboardResult = 'success' | 'empty' | 'error';

// ========== Reducer ==========

interface CommandState {
  /** 当前命令文本 */
  command: string;
  /**
   * 最近一次“应用模板 / 路径替换”得到的基线命令。
   * command 与之不一致即视为手动修改（dirty）。
   * 为 null 表示无基线（未选模板），此时 dirty 恒为 false。
   */
  lastAppliedCommand: string | null;
}

type CommandAction =
  /** 手动编辑 / 拖放 / 函数式更新：仅更新 command，保留基线 */
  | { type: 'SET_COMMAND'; action: SetStateAction<string> }
  /** 清空命令与基线 */
  | { type: 'CLEAR' }
  /** 应用模板：command 与基线同时置为同值，保证干净 */
  | { type: 'APPLY_TEMPLATE'; appliedCommand: string }
  /**
   * 路径替换（输入 / 输出变化触发的自动副作用）：
   * 当前为干净态时基线同步推进（保持干净，避免 dirty 闪烁）；
   * 当前为脏态时仅更新 command（保留用户手动编辑的脏标记）。
   */
  | { type: 'UPDATE_PATHS'; appliedCommand: string };

function commandReducer(
  state: CommandState,
  action: CommandAction,
): CommandState {
  switch (action.type) {
    case 'SET_COMMAND': {
      const next =
        typeof action.action === 'function'
          ? (action.action as (prev: string) => string)(state.command)
          : action.action;
      return { ...state, command: next };
    }
    case 'CLEAR':
      return { command: '', lastAppliedCommand: null };
    case 'APPLY_TEMPLATE':
      return {
        command: action.appliedCommand,
        lastAppliedCommand: action.appliedCommand,
      };
    case 'UPDATE_PATHS': {
      const isClean =
        state.lastAppliedCommand !== null &&
        state.command.trim() === state.lastAppliedCommand.trim();
      return isClean
        ? {
            command: action.appliedCommand,
            lastAppliedCommand: action.appliedCommand,
          }
        : { ...state, command: action.appliedCommand };
    }
    default:
      return state;
  }
}

// ========== Hook ==========

export function useCommandManager({
  inputFiles,
  outputFolder,
}: UseCommandManagerProps) {
  // 用 reducer 原子持有 { command, lastAppliedCommand }：
  // applyTemplateCommand / 路径替换都通过 dispatch 单次更新，避免两次 setState
  // 分帧刷新造成 isCommandDirty 闪烁。
  const [state, dispatch] = useReducer(commandReducer, {
    command: '',
    lastAppliedCommand: null,
  });
  const { command, lastAppliedCommand } = state;

  // 通过 useLatest 统一管理"最新值"，不再在每个 setter 里手动同步 ref
  const commandRef = useLatest(command);
  const inputFilesRef = useLatest(inputFiles);
  const outputFolderRef = useLatest(outputFolder);

  /**
   * 手动编辑 / 函数式更新命令（与 useState 的 Dispatch 兼容，支持 prev => next）。
   * 仅更新 command，不动基线——手动编辑会被判为 dirty。
   */
  const setCommand = useCallback<Dispatch<SetStateAction<string>>>(
    (action) => dispatch({ type: 'SET_COMMAND', action }),
    [],
  );

  /**
   * 更新命令（手动编辑）
   */
  const updateCommand = useCallback((newCommand: string) => {
    dispatch({ type: 'SET_COMMAND', action: newCommand });
  }, []);

  /**
   * 基于输入/输出路径更新命令中的文件路径占位符。
   * 参数均可选，不传则使用当前最新值。
   */
  const updateCommandWithPaths = useCallback(
    (
      baseCommand?: string,
      overrideInputFile?: string | string[],
      overrideOutputFolder?: string,
    ) => {
      const updated = updateCommandPaths(
        baseCommand ?? commandRef.current,
        overrideInputFile ?? inputFilesRef.current,
        overrideOutputFolder ?? outputFolderRef.current,
      );
      dispatch({ type: 'UPDATE_PATHS', appliedCommand: updated });
    },
    // refs 引用稳定，无需列入 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * 应用模板命令：把模板命令经路径替换后，原子地同时写入 command 与基线，
   * 使该帧 isCommandDirty 立即为 false（干净），不会先脏后净地闪烁。
   */
  const applyTemplateCommand = useCallback(
    (tplCmd: string) => {
      const currentInputs = inputFilesRef.current;
      const output = outputFolderRef.current;
      const applied =
        currentInputs.length > 0 || output
          ? updateCommandPaths(tplCmd, currentInputs, output)
          : tplCmd;
      dispatch({ type: 'APPLY_TEMPLATE', appliedCommand: applied });
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
  const handleDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      // 阻止冒泡到窗口级拖放处理：命令框内拖放只做「光标处插入路径」，
      // 不做「分配输入 1 / 套模板」，避免同一拖放被两个入口重复处理、
      // 模板重写覆盖掉刚插入的路径。
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      // 在同步帧内读取，不在 setCommand 回调内访问 e.currentTarget
      const cursorPosition = e.currentTarget.selectionStart;

      setCommand((prev) => insertFilesIntoCommand(prev, files, cursorPosition));
    },
    [setCommand],
  );

  /**
   * 清空命令（同时清空基线，回到无模板状态）
   */
  const clearCommand = useCallback(() => {
    dispatch({ type: 'CLEAR' });
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
    lastAppliedCommand,
    updateCommand,
    updateCommandWithPaths,
    applyTemplateCommand,
    setCommand,
    handleDragOver,
    handleDrop,
    clearCommand,
    copyCommand,
  };
}
