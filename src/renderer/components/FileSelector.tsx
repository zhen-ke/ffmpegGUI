/**
 * 文件选择器组件
 * 可复用的文件/文件夹选择按钮
 */

import { FolderOpen, Upload, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface FileSelectorProps {
  type: 'input' | 'output';
  value: string;
  onSelect: () => Promise<void>;
  onClear: () => void;
  label: string;
}

export function FileSelector({
  type,
  value,
  onSelect,
  onClear,
  label,
}: FileSelectorProps) {
  const { t } = useLanguage();

  const colorScheme =
    type === 'input'
      ? {
          filled:
            'bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 border-primary-200 dark:border-primary-700/50 text-primary-800 dark:text-primary-300',
          empty:
            'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 text-slate-600 dark:text-slate-300',
          hover: 'hover:bg-primary-100/50 dark:hover:bg-primary-900/30',
          icon: 'text-primary-500 dark:text-primary-400',
        }
      : {
          filled:
            'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20 border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-300',
          empty:
            'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/30 dark:hover:bg-amber-900/20 text-slate-600 dark:text-slate-300',
          hover: 'hover:bg-amber-100/50 dark:hover:bg-amber-900/30',
          icon: 'text-amber-500 dark:text-amber-400',
        };

  const icon =
    type === 'input' ? (
      <Upload className={`w-5 h-5 ${colorScheme.icon}`} />
    ) : (
      <FolderOpen className={`w-5 h-5 ${colorScheme.icon}`} />
    );

  const displayValue = value ? value.split(/[/\\]/).pop() : label;

  return (
    <div className="relative group h-full">
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        className={`w-full h-full flex items-center justify-between px-4 py-1.5 text-sm border-2 rounded-xl transition-all duration-200 ${
          value ? colorScheme.filled : colorScheme.empty
        } ${!value && 'group-hover:shadow-md'}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`p-1.5 rounded-lg ${value ? 'bg-white/50 dark:bg-slate-900/30' : 'bg-slate-50 dark:bg-slate-700/50'}`}
          >
            {icon}
          </div>
          <span className="truncate font-medium" title={value || label}>
            {displayValue}
          </span>
        </div>
        {!value && (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Browse
          </span>
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label}`}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 ${colorScheme.hover} rounded-lg cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-md`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
