/**
 * SetupPanel — 左栏配置区（模板 / 输入 / 输出 / 开始）
 *
 * 从 Home.tsx 提取（原 <aside> L866-1044），降低 Home 体积与重渲面。
 * 纯展示 + 事件转发，所有状态由 Home 持有并以 props 注入；包 memo 后，
 * 仅当其 props 真正变化（命令/输入/输出/运行态）才重渲，进度帧不再波及此处。
 */
import { Copy, Loader2, Lock, Play, Square } from 'lucide-react';
import { memo, type Ref } from 'react';
import Dropdown, { type DropdownOption } from './Dropdown';
import { FileSelector } from './FileSelector';
import { useLanguage } from '../LanguageContext';

export interface InputSlot {
  id: string;
  index: number;
  label: string;
  fieldLabel: string;
  selectedValue: string;
}

interface SetupPanelProps {
  isCompact: boolean;
  isMac: boolean;
  templateControlId: string;
  templateOptions: DropdownOption[];
  selectedTemplate: DropdownOption | null;
  onTemplateChange: (option: DropdownOption) => void;
  onEditTemplate: (template: { id: string }) => void;
  onDeleteTemplate: (templateId: string) => void;
  onClearTemplate: () => void;
  inputSlots: InputSlot[];
  onSelectInput: (index: number) => Promise<void>;
  onClearInput: (index: number) => void;
  onDropInput: (filePath: string, index: number) => void;
  outputControlId: string;
  outputFolder: string;
  onSelectOutputFolder: () => Promise<void>;
  onClearOutputFolder: () => void;
  onDropOutputFolder: (path: string) => void;
  outputFileName: string;
  onOutputFileNameChange: (value: string) => void;
  finalOutputPath: string;
  onCopyOutputPath: () => void;
  startButtonRef: Ref<HTMLButtonElement>;
  isRunning: boolean;
  isStopping: boolean;
  canStop: boolean;
  isReadyToRun: boolean;
  onStart: () => void;
  onStop: () => void;
  setupBlockerMessage: string | null;
}

function SetupPanel({
  isCompact,
  isMac,
  templateControlId,
  templateOptions,
  selectedTemplate,
  onTemplateChange,
  onEditTemplate,
  onDeleteTemplate,
  onClearTemplate,
  inputSlots,
  onSelectInput,
  onClearInput,
  onDropInput,
  outputControlId,
  outputFolder,
  onSelectOutputFolder,
  onClearOutputFolder,
  onDropOutputFolder,
  outputFileName,
  onOutputFileNameChange,
  finalOutputPath,
  onCopyOutputPath,
  startButtonRef,
  isRunning,
  isStopping,
  canStop,
  isReadyToRun,
  onStart,
  onStop,
  setupBlockerMessage,
}: SetupPanelProps) {
  const { t, language } = useLanguage();

  return (
    <aside
      className={`${
        isCompact
          ? 'w-full'
          : 'w-[300px] flex-shrink-0 overflow-y-auto border-r border-slate-200/60 dark:border-slate-700/60'
      } px-4 py-4 space-y-3 ${isMac ? 'bg-white/50 dark:bg-slate-900/40' : ''}`}
    >
      {/* ① 模板 */}
      <div className="min-w-0">
        <label
          htmlFor={templateControlId}
          className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5"
        >
          {t('Template')}
        </label>
        <Dropdown
          id={templateControlId}
          options={templateOptions}
          onChange={onTemplateChange}
          value={selectedTemplate}
          placeholder={t('Select a template')}
          onEdit={onEditTemplate}
          onDelete={onDeleteTemplate}
          onClear={onClearTemplate}
        />
      </div>

      {/* ② 输入文件（可多，纵向堆叠） */}
      {inputSlots.map((slot) => (
        <div key={slot.id} className="min-w-0">
          <label
            htmlFor={slot.id}
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5"
          >
            {slot.fieldLabel}
          </label>
          <FileSelector
            id={slot.id}
            type="input"
            value={slot.selectedValue}
            onSelect={() => onSelectInput(slot.index)}
            onClear={() => onClearInput(slot.index)}
            onDrop={(path) => onDropInput(path, slot.index)}
            label={slot.label}
          />
        </div>
      ))}

      {/* ③ 输出文件夹 */}
      <div className="min-w-0">
        <label
          htmlFor={outputControlId}
          className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5"
        >
          {t('Output Folder')}
        </label>
        <FileSelector
          id={outputControlId}
          type="output"
          value={outputFolder}
          onSelect={onSelectOutputFolder}
          onClear={onClearOutputFolder}
          onDrop={onDropOutputFolder}
          label={t('Select Output Folder')}
        />
      </div>

      {/* ④ 输出名 + 最终路径 */}
      <div className="min-w-0 space-y-3">
        <div>
          <label
            htmlFor={`${outputControlId}-name`}
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5"
          >
            {t('Output Name')}
          </label>
          <input
            id={`${outputControlId}-name`}
            type="text"
            value={outputFileName}
            onChange={(event) => onOutputFileNameChange(event.target.value)}
            spellCheck={false}
            className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t('Final Output Path')}
            </p>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              {language === 'zh' ? '只读预览' : 'Read-only'}
            </span>
          </div>
          <div className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Lock
                size={13}
                className="text-slate-400 dark:text-slate-500 flex-shrink-0"
              />
              <span
                className="truncate text-xs text-slate-700 dark:text-slate-200 font-mono"
                title={finalOutputPath}
              >
                {finalOutputPath}
              </span>
            </div>
            {finalOutputPath && (
              <button
                type="button"
                onClick={onCopyOutputPath}
                aria-label={t('Copy output path')}
                title={t('Copy output path')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors flex-shrink-0"
              >
                <Copy size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ⑤ 主操作按钮：Start / Stop（单一主 CTA） */}
      <div className="pt-1">
        {(() => {
          let tone =
            'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed';
          let icon = <Play size={14} className="fill-current" />;
          let label = t('Start');
          // 运行中显示 Stop；否则仅当真正可运行（命令 + 输入 + 输出齐全）时启用 Start
          let disabled = !isReadyToRun;
          if (isRunning) {
            tone =
              'bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98]';
            icon = isStopping ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Square size={14} className="fill-current" />
            );
            label = isStopping ? t('Stopping...') : t('Stop');
            disabled = !canStop;
          } else if (isReadyToRun) {
            tone =
              'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md shadow-primary-500/25 hover:shadow-lg hover:shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0';
          }
          // 禁用时给出明确原因：按钮 tooltip + 下方提示文案，避免「就绪」误导
          const blockerHint =
            !isRunning && setupBlockerMessage ? setupBlockerMessage : null;
          return (
            <div>
              <button
                ref={startButtonRef}
                type="button"
                onClick={isRunning ? onStop : onStart}
                disabled={disabled}
                aria-label={isRunning ? t('Stop') : t('Start')}
                title={blockerHint ?? undefined}
                className={`w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-[transform,box-shadow,background-color,color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${tone}`}
              >
                {icon}
                <span>{label}</span>
              </button>
              {blockerHint && (
                <p
                  role="status"
                  className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 leading-snug"
                >
                  {blockerHint}
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </aside>
  );
}

export default memo(SetupPanel);
