import { RotateCcw, Terminal as TerminalIcon } from 'lucide-react';
import { useId, type DragEvent } from 'react';
import { useLanguage } from '../LanguageContext';

export interface CommandSource {
  /** 模板名称 */
  label: string;
  /** 命令是否已被手动修改（与模板原始内容不一致） */
  isDirty: boolean;
}

export interface CommandBoxProps {
  command: string;
  onCommandChange: (v: string) => void;
  onDragOver: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  onClear: () => void;
  /** 点击后将命令重置为模板原始内容 */
  onReset?: () => void;
  id?: string;
  placeholder?: string;
  hasMultipleInputs: boolean;
  /** 命令来源信息（模板名 + 是否 dirty） */
  commandSource?: CommandSource | null;
  /** 是否已满足运行前置条件（用于快捷键提示样式） */
  isReadyToRun?: boolean;
}

export function CommandBox({
  command,
  onCommandChange,
  onDragOver,
  onDrop,
  onCopy,
  onClear,
  onReset,
  id,
  placeholder,
  hasMultipleInputs,
  commandSource,
  isReadyToRun = false,
}: CommandBoxProps) {
  const { t } = useLanguage();
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const helperTextId = `${textareaId}-helper`;
  const isMac = window.electron.platform === 'darwin';
  const shortcutLabel = isMac ? '⌘↵' : 'Ctrl+↵';
  const statusText = hasMultipleInputs
    ? t(
        'This command has multiple input files; only the first -i is auto-bound from the input selector.',
      )
    : t('Drag & drop files or type manually');

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 via-cyan-500 to-emerald-500 rounded-xl opacity-0 blur-sm pointer-events-none transition-opacity duration-500 group-hover:opacity-10 dark:group-hover:opacity-[0.08] motion-reduce:transition-none" />

      <div className="relative bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600 shadow-sm transition-[border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-primary-500 to-primary-600 rounded-md shadow-sm flex-shrink-0">
              <TerminalIcon size={13} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide flex-shrink-0">
              {t('FFmpeg Command')}
            </span>
            {/* 模板来源 badge */}
            {commandSource && (
              <span
                title={commandSource.isDirty ? commandSource.label : undefined}
                className={`
                  inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0
                  transition-colors duration-200
                  ${
                    commandSource.isDirty
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200/70 dark:border-amber-700/40'
                      : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200/70 dark:border-emerald-700/40'
                  }
                `}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    commandSource.isDirty ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                <span className="truncate max-w-[120px]">
                  {commandSource.isDirty
                    ? t('Modified (from template)')
                    : commandSource.label}
                </span>
              </span>
            )}
            {/* 重置按钮：只在 dirty 时出现 */}
            {commandSource?.isDirty && onReset && (
              <button
                type="button"
                onClick={onReset}
                title={t('Reset to template')}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full
                  text-amber-700 dark:text-amber-300
                  hover:bg-amber-100 dark:hover:bg-amber-900/40
                  border border-amber-200/70 dark:border-amber-700/40
                  transition-colors duration-200 flex-shrink-0"
              >
                <RotateCcw size={9} />
                {t('Reset to template')}
              </button>
            )}
            {hasMultipleInputs && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-700/40 flex-shrink-0">
                {t('Multiple inputs')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border ${
                isReadyToRun
                  ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border-primary-200/70 dark:border-primary-700/40'
                  : 'text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50'
              }`}
              title={t('Press shortcut to start')}
            >
              <span className="font-mono">{shortcutLabel}</span>
              <span>{t('to start')}</span>
            </span>
            <button
              type="button"
              onClick={onCopy}
              className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-200"
            >
              {t('Copy')}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
            >
              {t('Clear')}
            </button>
          </div>
        </div>

        {/* 命令文本域 */}
        <label htmlFor={textareaId} className="sr-only">
          {t('FFmpeg Command')}
        </label>
        <textarea
          id={textareaId}
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          onDragOver={onDragOver}
          onDrop={onDrop}
          aria-describedby={helperTextId}
          placeholder={
            placeholder ?? t('Enter FFmpeg command or drag & drop files here')
          }
          spellCheck={false}
          rows={8}
          className="w-full px-4 pt-3 pb-2 bg-transparent border-none resize-none font-mono text-sm text-slate-800 dark:text-slate-200 focus:ring-0 leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
        />

        {/* 底部：字符数 */}
        <div className="flex items-center px-4 pb-3 pt-1">
          <span
            id={helperTextId}
            className="text-[11px] text-slate-400 dark:text-slate-500 font-mono select-none"
          >
            {command.length > 0
              ? `${command.length} ${t('characters')}`
              : statusText}
          </span>
        </div>
      </div>
    </div>
  );
}

CommandBox.defaultProps = {
  id: undefined,
  placeholder: undefined,
  isReadyToRun: false,
};
