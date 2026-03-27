/**
 * 文件选择器组件（重构版）
 */

import { FolderOpen, Upload, X } from 'lucide-react';

interface FileSelectorProps {
  id?: string;
  type: 'input' | 'output';
  value: string;
  onSelect: () => Promise<void>;
  onClear: () => void;
  label: string;
}

export function FileSelector({
  id,
  type,
  value,
  onSelect,
  onClear,
  label,
}: FileSelectorProps) {
  const isInput = type === 'input';
  let buttonStateClass =
    'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 focus-visible:ring-primary-500';
  if (value && isInput) {
    buttonStateClass =
      'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700/50 text-primary-800 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 focus-visible:ring-primary-500';
  } else if (value) {
    buttonStateClass =
      'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 focus-visible:ring-amber-500';
  }

  // 只显示文件名或文件夹末段
  const displayValue = value ? (value.split(/[/\\]/).pop() ?? value) : null;

  return (
    <div className="relative h-10">
      {/* 主按钮 */}
      <button
        type="button"
        id={id}
        onClick={onSelect}
        aria-label={label}
        className={`
          w-full h-full flex items-center gap-2.5 px-3 rounded-xl
          border-2 text-sm font-medium
          transition-[border-color,background-color,color,box-shadow] duration-200 outline-none
          focus-visible:ring-2 focus-visible:ring-offset-2
          ${buttonStateClass}
        `}
      >
        {/* 图标 */}
        {isInput ? (
          <Upload
            size={15}
            className={`flex-shrink-0 ${value ? 'text-primary-500 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`}
          />
        ) : (
          <FolderOpen
            size={15}
            className={`flex-shrink-0 ${value ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}
          />
        )}

        {/* 文字 — 右侧预留 20px 给清除按钮，始终不被遮挡 */}
        <span
          className="flex-1 min-w-0 truncate text-left pr-5"
          title={value || label}
        >
          {displayValue ?? label}
        </span>
      </button>

      {/* 清除按钮 — 仅填充态显示，absolute 不影响布局 */}
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={`Clear ${label}`}
          className={`
            absolute right-2 top-1/2 -translate-y-1/2
            w-5 h-5 flex items-center justify-center rounded-md
            transition-colors duration-150
            ${
              isInput
                ? 'text-primary-400 dark:text-primary-500 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40'
                : 'text-amber-400 dark:text-amber-500 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }
          `}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

export default FileSelector;
