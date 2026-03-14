/**
 * 命令输入组件
 * 提供 FFmpeg 命令的编辑、拖放和工具栏功能
 */

import { Terminal, Copy, Trash2 } from 'lucide-react';
import { DragEvent } from 'react';
import { useLanguage } from '../LanguageContext';

interface CommandInputProps {
  command: string;
  onCommandChange: (command: string) => void;
  onDragOver: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  onClear: () => void;
  placeholder?: string;
}

export function CommandInput({
  command,
  onCommandChange,
  onDragOver,
  onDrop,
  onCopy,
  onClear,
  placeholder = 'Enter FFmpeg command or drag & drop files here',
}: CommandInputProps) {
  const { t } = useLanguage();

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-xl opacity-0 group-hover:opacity-15 transition duration-500 blur-sm" />
      <div className="relative bg-white rounded-xl border-2 border-gray-100 group-hover:border-gray-200 shadow-sm group-hover:shadow-md transition-all duration-300">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
              <Terminal size={16} className="text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-800">
                {t('FFmpeg Command')}
              </span>
              <p className="text-xs text-gray-400">
                Drag & drop files or type manually
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              aria-label={t('Copy')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-all"
            >
              <Copy size={14} />
              {t('Copy')}
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label={t('Clear')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-600 transition-all"
            >
              <Trash2 size={14} />
              {t('Clear')}
            </button>
          </div>
        </div>

        <textarea
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          onDragOver={onDragOver}
          onDrop={onDrop}
          placeholder={placeholder}
          className="w-full p-4 bg-transparent border-none resize-none font-mono text-sm text-gray-800 focus:ring-0 min-h-[6rem] leading-relaxed"
          rows={4}
          spellCheck="false"
        />

        {/* Command length indicator */}
        {command && (
          <div className="px-4 pb-3 flex justify-end">
            <span className="text-xs text-gray-400">
              {command.length} characters
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
