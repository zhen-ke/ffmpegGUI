/**
 * RunningBar — 运行状态聚合条
 *
 * 转码时把「进度 + ETA + 停止」集中到主内容区顶部，
 * 避免视线在 Header（进度）/ SetupPanel（停止）/ Drawer（日志）三处跳转。
 * 仅运行时渲染（isRunning 门控），空闲时零开销。
 *
 * 进度订阅复用 FFmpegProgressBar 的高频隔离单元；停止按钮在此冗余
 * （SetupPanel / DrawerTabBar 仍保留，方便任意位置触达）。
 */
import { Loader2, Square } from 'lucide-react';
import { memo } from 'react';
import { useLanguage } from '../LanguageContext';
import FFmpegProgressBar from './FFmpegProgressBar';

interface RunningBarProps {
  isRunning: boolean;
  isStopping: boolean;
  canStop: boolean;
  onStop: () => void;
}

function RunningBarImpl({
  isRunning,
  isStopping,
  canStop,
  onStop,
}: RunningBarProps) {
  const { t, language } = useLanguage();
  if (!isRunning) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-primary-200/70 dark:border-primary-800/50 bg-primary-50/70 dark:bg-primary-900/15 shadow-sm animate-in fade-in duration-200"
    >
      <FFmpegProgressBar isRunning={isRunning} language={language} />
      <button
        type="button"
        onClick={onStop}
        disabled={!canStop}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      >
        {isStopping ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Square size={11} className="fill-current" />
        )}
        <span>{isStopping ? t('Stopping...') : t('Stop')}</span>
      </button>
    </div>
  );
}

export default memo(RunningBarImpl);
