/**
 * 日志显示组件
 * 终端样式的日志输出窗口
 */

import { Terminal } from 'lucide-react';
import React from 'react';

interface LogDisplayProps {
  logs: string;
  logsRef: React.RefObject<HTMLDivElement>;
  onClear: () => void;
  onCopy: () => void;
}

export function LogDisplay({
  logs,
  logsRef,
  onClear,
  onCopy,
}: LogDisplayProps) {
  return (
    <div className="flex-1 relative flex flex-col max-w-7xl mx-auto w-full">
      {/* 终端 Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-[#161b22] border-b border-gray-300 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="ml-3 text-xs font-mono text-gray-600 dark:text-gray-400">
            Console Output
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
            title="Copy raw text"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
            onClick={onClear}
            className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
            title="Clear console"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 终端内容 (滚动区域) */}
      <div className="flex-1 relative bg-white dark:bg-[#0d1117]">
        <div
          ref={logsRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
        >
          {logs ? (
            <div className="pb-10" dangerouslySetInnerHTML={{ __html: logs }} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20 pointer-events-none select-none">
              <Terminal
                size={64}
                className="text-gray-400 dark:text-gray-600 mb-4"
              />
              <p className="text-gray-500 dark:text-gray-500 font-mono text-sm">
                Ready to process...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
