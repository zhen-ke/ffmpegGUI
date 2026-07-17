/**
 * CompletedResultCard — 任务完成结果卡片
 *
 * 从 Home.tsx 提取，在 FFmpeg 执行成功后展示输出文件路径和操作按钮。
 */

import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface CompletedResultCardProps {
  lastCompletedOutputFile: string;
  completedOutputFolder: string;
  canStart: boolean;
  currentCommand: string;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onRunAgain: () => void;
  /** 关闭横幅（点击 ×） */
  onDismiss?: () => void;
}

export function CompletedResultCard({
  lastCompletedOutputFile,
  completedOutputFolder,
  canStart,
  currentCommand,
  onOpenFile,
  onOpenFolder,
  onRunAgain,
  onDismiss,
}: CompletedResultCardProps) {
  const { t } = useLanguage();

  return (
    <div className="relative animate-slide-up rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-900/20 px-4 py-4 shadow-sm">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('Dismiss')}
          title={t('Dismiss')}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-emerald-700/70 dark:text-emerald-300/70 hover:text-emerald-900 dark:hover:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors duration-150"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between pr-6">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            {t('Latest Result')}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {t('Task complete. Your output is ready.')}
          </h2>
          {lastCompletedOutputFile ? (
            <>
              <p className="mt-3 text-[11px] font-medium text-emerald-700/80 dark:text-emerald-300/80">
                {t('Completed Output')}
              </p>
              <p
                className="mt-1 truncate text-sm font-mono text-emerald-900 dark:text-emerald-100"
                title={lastCompletedOutputFile}
              >
                {lastCompletedOutputFile}
              </p>
              <p
                className="mt-1 truncate text-xs text-emerald-800/80 dark:text-emerald-200/80"
                title={completedOutputFolder}
              >
                {completedOutputFolder}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
              {t('Task complete. Your output is ready.')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {lastCompletedOutputFile && (
            <button
              type="button"
              onClick={onOpenFile}
              className="px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-sm font-medium text-emerald-800 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors duration-200"
            >
              {t('Open File')}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFolder}
            className="px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-sm font-medium text-emerald-800 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors duration-200"
          >
            {t('Open Folder')}
          </button>
          <button
            type="button"
            onClick={onRunAgain}
            disabled={!canStart || !currentCommand}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {t('Run Again')}
          </button>
        </div>
      </div>
    </div>
  );
}
