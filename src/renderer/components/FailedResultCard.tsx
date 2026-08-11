/* eslint-disable react/require-default-props -- 可选 props 用 undefined 判空，无需 defaultProps（React 19 移除） */
/**
 * FailedResultCard — 任务失败结果卡片
 */

import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface FailedResultCardProps {
  onViewLogs: () => void;
  onTryAgain: () => void;
  canRetry: boolean;
  onDismiss?: () => void;
  /** 最近一次失败的诊断摘要（主进程聚合的 stderr 原因行），可选 */
  errorMessage?: string;
}

export function FailedResultCard({
  onViewLogs,
  onTryAgain,
  canRetry,
  onDismiss,
  errorMessage,
}: FailedResultCardProps) {
  const { t } = useLanguage();

  return (
    <div className="relative animate-slide-up rounded-2xl border border-red-200 dark:border-red-800/60 bg-red-50/80 dark:bg-red-900/20 px-4 py-4 shadow-sm">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('Dismiss')}
          title={t('Dismiss')}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-red-700/70 dark:text-red-300/70 hover:text-red-900 dark:hover:text-red-100 hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors duration-150"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between pr-6">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-red-700 dark:text-red-300">
            {t('Task Failed')}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-red-900 dark:text-red-100">
            {t('Task failed. Check the activity log for details.')}
          </h2>
          {errorMessage && (
            <p
              className="mt-2 text-xs font-mono text-red-800/90 dark:text-red-200/90 line-clamp-2 break-all leading-relaxed"
              title={errorMessage}
            >
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onViewLogs}
            className="px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-sm font-medium text-red-800 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors duration-200"
          >
            {t('View Logs')}
          </button>
          <button
            type="button"
            onClick={onTryAgain}
            disabled={!canRetry}
            className="px-3 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {t('Try Again')}
          </button>
        </div>
      </div>
    </div>
  );
}
