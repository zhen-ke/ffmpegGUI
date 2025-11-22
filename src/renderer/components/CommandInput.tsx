/**
 * 命令输入组件
 * 提供 FFmpeg 命令的编辑、拖放和工具栏功能
 */

import { Terminal } from 'lucide-react';
import { DragEvent } from 'react';

interface CommandInputProps {
  command: string;
  onCommandChange: (command: string) => void;
  onDragOver: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  onClear: () => void;
  onOpenTerminal: () => void;
  placeholder?: string;
}

export function CommandInput({
  command,
  onCommandChange,
  onDragOver,
  onDrop,
  onCopy,
  onClear,
  onOpenTerminal,
  placeholder = 'Enter FFmpeg command or drag & drop files here',
}: CommandInputProps) {
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-0 group-hover:opacity-20 transition duration-500 blur" />
      <div className="relative bg-white dark:bg-[#0d1117] rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 rounded-t-lg">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Terminal size={14} />
            <span className="font-mono">FFmpeg Command</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              className="text-xs px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              Copy
            </button>
            <button
              onClick={onClear}
              className="text-xs px-2 py-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onOpenTerminal}
              className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
            >
              Terminal
            </button>
          </div>
        </div>

        <textarea
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          onDragOver={onDragOver}
          onDrop={onDrop}
          placeholder={placeholder}
          className="w-full p-3 bg-transparent border-none resize-none font-mono text-sm text-gray-800 dark:text-gray-200 focus:ring-0 min-h-[5rem]"
          rows={3}
          spellCheck="false"
        />
      </div>
    </div>
  );
}
