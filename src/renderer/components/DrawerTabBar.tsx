import { Loader2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

export type DrawerSize = 'sm' | 'md' | 'lg';
export type WorkspacePane = 'activity' | 'terminal';

export interface DrawerTabBarProps {
  activePane: WorkspacePane;
  onActivePaneChange: (pane: WorkspacePane) => void;
  isRunning: boolean;
  isStopping: boolean;
  canStop: boolean;
  progress: number;
  onStop: () => void;
  onClearLogs: () => void;
  onCopyLogs: () => void;
  drawerSize: DrawerSize;
  onDrawerSizeChange: (s: DrawerSize) => void;
  isAutoScrollEnabled?: boolean;
}

const DRAWER_SIZE_LABELS: Record<DrawerSize, string> = {
  sm: '−',
  md: '▣',
  lg: '□',
};

export function DrawerTabBar({
  activePane,
  onActivePaneChange,
  isRunning,
  isStopping,
  canStop,
  progress,
  onStop,
  onClearLogs,
  onCopyLogs,
  drawerSize,
  onDrawerSizeChange,
  isAutoScrollEnabled = true,
}: DrawerTabBarProps) {
  const { t } = useLanguage();
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const hasProgress = clampedProgress > 0;
  const autoScrollEnabled = isAutoScrollEnabled;
  const isActivityPane = activePane === 'activity';
  const drawerTitles: Record<DrawerSize, string> = {
    sm: t('Collapse'),
    md: t('Default'),
    lg: t('Expand'),
  };
  const paneTitles: Record<WorkspacePane, string> = {
    activity: t('Activity'),
    terminal: t('Shell'),
  };

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 h-11 bg-white dark:bg-slate-800 border-t border-slate-200/80 dark:border-slate-700/80 shadow-[0_-1px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_-1px_8px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          {t('Workspace')}
        </span>
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700/50 rounded-md p-0.5">
          {(['activity', 'terminal'] as WorkspacePane[]).map((pane) => (
            <button
              key={pane}
              type="button"
              onClick={() => onActivePaneChange(pane)}
              aria-label={paneTitles[pane]}
              aria-pressed={activePane === pane}
              className={`
                px-2.5 h-7 flex items-center justify-center rounded-md text-[11px] font-semibold
                transition-[background-color,color,box-shadow] duration-150
                ${
                  activePane === pane
                    ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }
              `}
            >
              {paneTitles[pane]}
            </button>
          ))}
        </div>
      </div>

      {/* 运行中：进度条 + 百分比 */}
      {isRunning && (
        <div className="flex items-center gap-2 flex-1 min-w-0 mx-2">
          <div className="flex-1 min-w-0 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-primary-500 via-primary-400 to-cyan-500 ${
                hasProgress ? '' : 'animate-pulse'
              }`}
              style={{ width: hasProgress ? `${clampedProgress}%` : '25%' }}
            />
          </div>
          <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 tabular-nums flex-shrink-0 min-w-[36px] text-right">
            {hasProgress ? `${clampedProgress.toFixed(1)}%` : t('Running...')}
          </span>
        </div>
      )}

      {/* 滚动暂停提示（非运行时） */}
      {!isRunning && !autoScrollEnabled && (
        <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-700/40 flex-shrink-0">
          {t('Paused')}
        </span>
      )}

      {/* 右侧：工具按钮组 */}
      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
        {isActivityPane && (
          <>
            <button
              type="button"
              onClick={onCopyLogs}
              aria-label={t('Copy raw text')}
              title={t('Copy raw text')}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-md transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={onClearLogs}
              aria-label={t('Clear console')}
              title={t('Clear console')}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-md transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </button>

            <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-600 mx-0.5" />
          </>
        )}

        {/* 停止按钮 */}
        <button
          type="button"
          onClick={onStop}
          disabled={!canStop}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold
            transition-all duration-200 border
            ${
              !canStop
                ? 'bg-slate-50 dark:bg-slate-700/30 text-slate-300 dark:text-slate-600 border-slate-200/50 dark:border-slate-700/30 cursor-not-allowed'
                : 'bg-white dark:bg-slate-700 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 hover:shadow-sm active:scale-95'
            }
          `}
        >
          {isStopping ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <svg
              className="w-2.5 h-2.5"
              viewBox="0 0 10 10"
              fill="currentColor"
            >
              <rect x="1" y="1" width="8" height="8" rx="1" />
            </svg>
          )}
          <span>{isStopping ? t('Stopping...') : t('Stop')}</span>
        </button>

        <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-600 mx-0.5" />

        {/* 抽屉尺寸切换 */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700/50 rounded-md p-0.5">
          {(['sm', 'md', 'lg'] as DrawerSize[]).map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => onDrawerSizeChange(sz)}
              title={drawerTitles[sz]}
              aria-label={drawerTitles[sz]}
              className={`
                w-6 h-6 flex items-center justify-center rounded text-[11px] font-mono
                transition-all duration-150
                ${
                  drawerSize === sz
                    ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }
              `}
            >
              {DRAWER_SIZE_LABELS[sz]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


