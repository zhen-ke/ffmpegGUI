/**
 * 进度条组件
 * 显示 FFmpeg 处理进度
 */

import { useLanguage } from '../LanguageContext';

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
      className={`flex-shrink-0 transition-all duration-300 ease-in-out border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117] ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2 pointer-events-none absolute w-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>{hasProgress ? t('Processing...') : t('Waiting for progress...')}</span>
          </div>
          <span>{hasProgress ? `${clampedProgress.toFixed(1)}%` : '--'}</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-blue-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)] ${
              hasProgress ? '' : 'animate-pulse'
            }`}
            style={{ width: hasProgress ? `${clampedProgress}%` : '35%' }}
          />
        </div>
      </div>
    </div>
  );
}
