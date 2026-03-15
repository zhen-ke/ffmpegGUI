/**
 * 日志显示组件
 * 终端样式的日志输出窗口
 */

import { Ban, Copy, Terminal, Pause, Play } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../LanguageContext';

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
      className="p-2 hover:bg-slate-300/50 dark:hover:bg-slate-600/50 rounded-lg text-slate-600 dark:text-slate-400 transition-all hover:scale-105"
      title={title}
    >
      {icon}
    </button>
  );
}

// ========== 主组件 ==========

interface LogDisplayProps {
  logs: string[];
  logsRef: React.RefObject<HTMLDivElement>;
  onClear: () => void;
  onCopy: () => void;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  isAutoScrollEnabled?: boolean;
}

export function LogDisplay({
  logs,
  logsRef,
  onClear,
  onCopy,
  onScroll,
  isAutoScrollEnabled = true,
}: LogDisplayProps) {
  const { t } = useLanguage();

  return (
    <div className="flex-1 relative flex flex-col max-w-7xl mx-auto w-full">
      {/* 终端 Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t('Console Output')}
          </span>
          {!isAutoScrollEnabled && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
              <Pause size={10} />
              {t('Paused')}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <ToolButton
            onClick={onCopy}
            title={t('Copy raw text')}
            icon={<Copy size={16} />}
          />
          <ToolButton
            onClick={onClear}
            title={t('Clear console')}
            icon={<Ban size={16} />}
          />
        </div>
      </div>

      {/* 终端内容 (滚动区域) */}
      <div className="flex-1 relative bg-white dark:bg-slate-900 shadow-inner">
        <div
          ref={logsRef}
          role="log"
          aria-live="polite"
          aria-label="FFmpeg log output"
          onScroll={onScroll}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent font-mono text-sm"
        >
          {logs.length > 0 ? (
            <div className="p-4">
              {logs.map((logHtml, index) => (
                <div
                  key={index}
                  dangerouslySetInnerHTML={{ __html: logHtml }}
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center pointer-events-none select-none">
              <div className="relative mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center shadow-inner">
                  <Terminal
                    size={48}
                    className="text-slate-400 dark:text-slate-500"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                  <Play size={12} className="text-white ml-0.5" />
                </div>
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-medium text-lg">
                {t('Ready to process...')}
              </p>
              <p className="text-slate-300 dark:text-slate-600 text-sm mt-1">
                Select a template or enter a command to begin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
