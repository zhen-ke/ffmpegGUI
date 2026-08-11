/**
 * StalledBanner — 卡死检测非模态横幅
 *
 * 替代原「卡死确认框」：确认框把 Esc / 点遮罩映射到 onCancel（= 停止任务），
 * 用户想"关掉提示"会误终止转码。横幅无遮罩、无 Esc 映射，只提供两个显式
 * 操作按钮（继续等待 / 停止任务），不打断当前操作，也不会误触终止。
 * 展示实际已停滞时长，让用户判断是慢解码还是真卡死。
 */
import { AlertTriangle, Loader2, Square } from 'lucide-react';
import { memo } from 'react';
import { useLanguage } from '../LanguageContext';

interface StalledBannerProps {
  /** 已停滞时长（ms）；null 表示未触发，父级按此门控渲染 */
  stalledForMs: number;
  isStopping: boolean;
  canStop: boolean;
  onResume: () => void;
  onStop: () => void;
}

function formatStalled(ms: number, language: string): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return language === 'zh' ? `已停滞 ${seconds} 秒` : `Stalled for ${seconds}s`;
}

function StalledBannerImpl({
  stalledForMs,
  isStopping,
  canStop,
  onResume,
  onStop,
}: StalledBannerProps) {
  const { t, language } = useLanguage();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-amber-300/70 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-900/20 shadow-sm animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <AlertTriangle
          size={16}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t('ffmpegStalledTitle')}
            <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300 tabular-nums">
              {formatStalled(stalledForMs, language)}
            </span>
          </p>
          <p className="text-xs text-amber-700/90 dark:text-amber-300/80 leading-snug">
            {t('ffmpegStalledDescription')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onResume}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors duration-150"
        >
          {t('Continue Waiting')}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!canStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStopping ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Square size={11} className="fill-current" />
          )}
          {t('Stop task')}
        </button>
      </div>
    </div>
  );
}

export default memo(StalledBannerImpl);
