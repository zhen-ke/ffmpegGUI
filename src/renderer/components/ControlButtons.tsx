/**
 * 控制按钮组件
 * 提供 Start/Stop 控制按钮
 */

import { Play, Square, Loader2 } from 'lucide-react';

interface ControlButtonsProps {
  isRunning: boolean;
  isStopping?: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  startLabel?: string;
  stopLabel?: string;
  stoppingLabel?: string;
}

export function ControlButtons({
  isRunning,
  isStopping = false,
  canStart,
  onStart,
  onStop,
  startLabel = 'Start',
  stopLabel = 'Stop',
  stoppingLabel = 'Stopping...',
}: ControlButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <button
        type="button"
        onClick={onStart}
        disabled={isRunning || isStopping || !canStart}
        className={`min-w-[160px] px-8 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all duration-200 flex items-center justify-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
          isRunning || isStopping || !canStart
            ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white hover:shadow-xl hover:-translate-y-1 active:translate-y-0 dark:shadow-primary-500/20'
        }`}
      >
        {isRunning || isStopping || !canStart ? (
          <Play size={18} className="mr-2 opacity-50" fill="none" />
        ) : (
          <div className="relative mr-2">
            <Play size={18} className="fill-current" />
          </div>
        )}
        <span>{startLabel}</span>
      </button>

      <button
        type="button"
        onClick={onStop}
        disabled={!isRunning || isStopping}
        className={`min-w-[160px] px-8 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all duration-200 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
          !isRunning || isStopping
            ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
            : 'bg-white dark:bg-slate-700 border-2 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700/50 hover:shadow-xl hover:-translate-y-1 active:translate-y-0'
        }`}
      >
        {isStopping ? (
          <Loader2 size={18} className="mr-2 animate-spin" />
        ) : (
          <Square
            size={18}
            className="mr-2"
            fill={isRunning && !isStopping ? 'currentColor' : 'none'}
          />
        )}
        <span>{isStopping ? stoppingLabel : stopLabel}</span>
      </button>
    </div>
  );
}
