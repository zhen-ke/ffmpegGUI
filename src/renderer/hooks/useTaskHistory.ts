/**
 * useTaskHistory — 最近任务历史 Hook
 *
 * 记录每次运行结束（成功/失败）的任务：命令、输出、错误摘要、时间。
 * 持久化到 localStorage（最多 MAX_HISTORY 条，新的在前），供批量/反复
 * 转码场景一键复用命令或打开输出，避免记录随完成卡片关闭而消失。
 * 用户主动停止（cancelled）的任务不记录，避免噪音。
 */
import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface TaskHistoryEntry {
  id: string;
  /** 任务结束时间戳（ms） */
  timestamp: number;
  status: 'done' | 'error';
  /** 实际执行的命令（trim 后） */
  command: string;
  /** 成功时的输出文件路径；失败为空串 */
  outputFile: string;
  /** 失败时的诊断摘要 */
  errorMessage?: string;
}

const LS_TASK_HISTORY_KEY = 'ffmpeg-task-history-v1';
const MAX_HISTORY = 10;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useTaskHistory() {
  const [entries, setEntries] = useLocalStorage<TaskHistoryEntry[]>(
    LS_TASK_HISTORY_KEY,
    [],
    {
      serialize: JSON.stringify,
      // 旧数据/损坏数据兜底为空数组
      deserialize: (raw) => {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      },
    },
  );

  /** 新增一条历史（新纪录在前，截断到 MAX_HISTORY） */
  const addEntry = useCallback(
    (entry: Omit<TaskHistoryEntry, 'id' | 'timestamp'>) => {
      const record: TaskHistoryEntry = {
        id: makeId(),
        timestamp: Date.now(),
        ...entry,
      };
      setEntries((prev) => [record, ...prev].slice(0, MAX_HISTORY));
    },
    [setEntries],
  );

  const clearHistory = useCallback(() => setEntries([]), [setEntries]);

  return { entries, addEntry, clearHistory };
}
