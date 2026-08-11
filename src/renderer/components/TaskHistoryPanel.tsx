/**
 * TaskHistoryPanel — 最近任务历史面板
 *
 * 展示运行结束（成功/失败）的最近任务，持久化于 localStorage。
 * 为批量/反复转码场景提供两个高频操作：
 * - 加载命令：一键把历史命令填回命令框（调整参数重跑 / 复用上次配置）
 * - 打开文件夹：定位历史任务的输出文件
 * 无历史时不渲染，避免占位噪音。纯展示 + 事件转发，所有状态由 Home 持有。
 */
import {
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  History,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { memo, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import type { TaskHistoryEntry } from '../hooks/useTaskHistory';

interface TaskHistoryPanelProps {
  entries: TaskHistoryEntry[];
  onLoadCommand: (entry: TaskHistoryEntry) => void;
  onOpenFolder: (entry: TaskHistoryEntry) => void;
  onClear: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function TaskHistoryPanelImpl({
  entries,
  onLoadCommand,
  onOpenFolder,
  onClear,
}: TaskHistoryPanelProps) {
  const { t } = useLanguage();
  // 有历史时默认展开，用户可折叠
  const [isOpen, setIsOpen] = useState(true);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/40 shadow-sm overflow-hidden">
      {/* header：折叠按钮 + 计数 + 清空（独立按钮，避免嵌套 button） */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="flex items-center gap-2 min-w-0 flex-1 text-left hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-150"
        >
          <ChevronDown
            size={14}
            className={`flex-shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 motion-reduce:transition-none ${
              isOpen ? '' : '-rotate-90'
            }`}
          />
          <History size={14} className="flex-shrink-0 text-primary-500" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('Task History')}
          </h2>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            {entries.length}
          </span>
        </button>
        <button
          type="button"
          onClick={onClear}
          title={t('Clear history')}
          aria-label={t('Clear history')}
          className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 flex-shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* 列表 */}
      {isOpen && (
        <ul className="px-2 pb-2 space-y-0.5 max-h-72 overflow-y-auto">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150"
            >
              <span
                title={
                  entry.status === 'done'
                    ? t('Task succeeded')
                    : t('Task Failed')
                }
                className="flex-shrink-0"
              >
                {entry.status === 'done' ? (
                  <CheckCircle2 size={15} className="text-emerald-500" />
                ) : (
                  <XCircle size={15} className="text-red-500" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-mono text-slate-700 dark:text-slate-200"
                  title={entry.command}
                >
                  {entry.command}
                </p>
                <p
                  className="truncate text-[11px] text-slate-400 dark:text-slate-500"
                  title={entry.outputFile || entry.errorMessage}
                >
                  {formatTime(entry.timestamp)}
                  {entry.outputFile ? ` · ${entry.outputFile}` : ''}
                  {!entry.outputFile && entry.errorMessage
                    ? ` · ${entry.errorMessage.split('\n')[0]}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onLoadCommand(entry)}
                  title={t('Load command')}
                  aria-label={t('Load command')}
                  className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors duration-150"
                >
                  <RotateCcw size={12} />
                </button>
                {entry.outputFile && (
                  <button
                    type="button"
                    onClick={() => onOpenFolder(entry)}
                    title={t('Open Folder')}
                    aria-label={t('Open Folder')}
                    className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors duration-150"
                  >
                    <FolderOpen size={12} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default memo(TaskHistoryPanelImpl);
