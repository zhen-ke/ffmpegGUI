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
            'bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-200 text-blue-800',
          empty:
            'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-gray-600',
          hover: 'hover:bg-blue-100/50',
          icon: 'text-blue-500',
        }
      : {
          filled:
            'bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-200 text-amber-800',
          empty:
            'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/30 text-gray-600',
          hover: 'hover:bg-amber-100/50',
          icon: 'text-amber-500',
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
            className={`p-1.5 rounded-lg ${value ? 'bg-white/50' : 'bg-gray-50'}`}
          >
            {icon}
          </div>
          <span className="truncate font-medium" title={value || label}>
            {displayValue}
          </span>
        </div>
        {!value && (
          <span className="text-xs text-gray-400 font-medium">Browse</span>
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
