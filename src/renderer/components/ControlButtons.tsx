/**
 * 控制按钮组件
 * 提供 Start/Stop 控制按钮
 */

import { Play, Square } from 'lucide-react';

interface ControlButtonsProps {
  isRunning: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  startLabel?: string;
  stopLabel?: string;
}

export function ControlButtons({
  isRunning,
  canStart,
  onStart,
  onStop,
  startLabel = 'Start',
  stopLabel = 'Stop',
}: ControlButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onStart}
        disabled={isRunning || !canStart}
        className={`min-w-[140px] px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md transition-all duration-200 flex items-center justify-center ${
          isRunning || !canStart
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
            : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
        }`}
      >
        <Play
          size={16}
          className="mr-2"
          fill={isRunning || !canStart ? 'none' : 'currentColor'}
        />
        {startLabel}
      </button>

      <button
        onClick={onStop}
        disabled={!isRunning}
        className={`min-w-[140px] px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md transition-all duration-200 flex items-center justify-center ${
          !isRunning
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
            : 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20'
        }`}
      >
        <Square
          size={16}
          className="mr-2"
          fill={isRunning ? 'currentColor' : 'none'}
        />
        {stopLabel}
      </button>
    </div>
  );
}
