/**
 * 日志显示组件
 * 终端样式的日志输出窗口
 */

import { Ban, Copy, Terminal } from 'lucide-react';
import React from 'react';

// ========== 子组件 ==========

/**
 * 工具栏按钮组件
 */
interface ToolButtonProps {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
}

function ToolButton({ onClick, title, icon }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
      title={title}
    >
      {icon}
    </button>
  );
}

// ========== 主组件 ==========

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
          <span className="ml-3 text-xs font-mono text-gray-600 dark:text-gray-400">
            Console Output
          </span>
        </div>
        <div className="flex gap-2">
          <ToolButton
            onClick={onCopy}
            title="Copy raw text"
            icon={<Copy size={14} />}
          />
          <ToolButton
            onClick={onClear}
            title="Clear console"
            icon={<Ban size={14} />}
          />
        </div>
      </div>

      {/* 终端内容 (滚动区域) */}
      <div className="flex-1 relative bg-white dark:bg-[#0d1117]">
        <div
          ref={logsRef}
          role="log"
          aria-live="polite"
          aria-label="FFmpeg log output"
          className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
        >
          {logs ? (
            /**
             * 使用 dangerouslySetInnerHTML 渲染带颜色的日志
             * 安全说明：logUtils 已对日志消息做 HTML escape 处理，避免注入到 DOM
             */
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
