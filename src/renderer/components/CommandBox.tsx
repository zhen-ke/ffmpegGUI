import { Loader2, Play, Terminal as TerminalIcon } from 'lucide-react';
import { useId, type DragEvent } from 'react';
import { useLanguage } from '../LanguageContext';

export interface CommandBoxProps {
  command: string;
  onCommandChange: (v: string) => void;
  onDragOver: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  onClear: () => void;
  onStart: () => void;
  canStart: boolean;
  isRunning: boolean;
  isStopping: boolean;
  id?: string;
  placeholder?: string;
  hasMultipleInputs: boolean;
}

export function CommandBox({
  command,
  onCommandChange,
  onDragOver,
  onDrop,
  onCopy,
  onClear,
  onStart,
  canStart,
  isRunning,
  isStopping,
  id,
  placeholder,
  hasMultipleInputs,
}: CommandBoxProps) {
  const { t } = useLanguage();
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const helperTextId = `${textareaId}-helper`;
  const statusText = hasMultipleInputs
    ? t(
        'This command has multiple input files; only the first -i is auto-bound from the input selector.',
      )
    : t('Drag & drop files or type manually');

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 via-cyan-500 to-emerald-500 rounded-xl opacity-0 blur-sm pointer-events-none transition-opacity duration-500 group-hover:opacity-10 dark:group-hover:opacity-[0.08] motion-reduce:transition-none" />

      <div className="relative bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600 shadow-sm transition-[border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-primary-500 to-primary-600 rounded-md shadow-sm flex-shrink-0">
              <TerminalIcon size={13} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
              {t('FFmpeg Command')}
            </span>
            {hasMultipleInputs && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-700/40 flex-shrink-0">
                {t('Multiple inputs')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
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
          rows={3}
          className="w-full px-4 pt-3 pb-2 bg-transparent border-none resize-none font-mono text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:ring-inset leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
        />

        {/* 底部：字符数 + 内嵌运行按钮 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <span
            id={helperTextId}
            className="text-[11px] text-slate-400 dark:text-slate-500 font-mono select-none"
          >
            {command.length > 0
              ? `${command.length} ${t('characters')}`
              : statusText}
          </span>

          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            aria-disabled={!canStart}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
              transition-[transform,box-shadow,background-color,color] duration-200 focus:outline-none
              focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
              dark:focus-visible:ring-offset-slate-800
              ${
                canStart
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md shadow-primary-500/25 hover:shadow-lg hover:shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {isRunning || isStopping ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} className={canStart ? 'fill-current' : ''} />
            )}
            <span>{t('Start')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}


