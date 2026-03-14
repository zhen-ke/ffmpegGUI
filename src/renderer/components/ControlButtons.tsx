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
        className={`min-w-[160px] px-8 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 flex items-center justify-center group ${
          isRunning || isStopping || !canStart
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:shadow-xl hover:-translate-y-1 active:translate-y-0'
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
        className={`min-w-[160px] px-8 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 flex items-center justify-center ${
          !isRunning || isStopping
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
            : 'bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:shadow-xl hover:-translate-y-1 active:translate-y-0'
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
