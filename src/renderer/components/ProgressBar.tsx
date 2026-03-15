/**
 * 进度条组件
 * 显示 FFmpeg 处理进度
 */

import { useLanguage } from '../LanguageContext';
import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  isVisible: boolean;
}

export function ProgressBar({ progress, isVisible }: ProgressBarProps) {
  const { t } = useLanguage();
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const hasProgress = clampedProgress > 0;

  return (
    <div
      className={`flex-shrink-0 transition-all duration-300 ease-in-out border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2 pointer-events-none absolute w-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
          <div className="flex items-center gap-2.5">
            <Loader2 size={14} className="text-primary-500 animate-spin" />
            <span>
              {hasProgress ? t('Processing...') : t('Waiting for progress...')}
            </span>
          </div>
          <span className="text-primary-600 dark:text-primary-400 font-semibold">
            {hasProgress ? `${clampedProgress.toFixed(1)}%` : '--'}
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full bg-gradient-to-r from-primary-500 via-primary-400 to-cyan-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)] dark:shadow-[0_0_10px_rgba(59,130,246,0.3)] ${
              hasProgress ? '' : 'animate-pulse'
            }`}
            style={{ width: hasProgress ? `${clampedProgress}%` : '35%' }}
          />
        </div>
      </div>
    </div>
  );
}
