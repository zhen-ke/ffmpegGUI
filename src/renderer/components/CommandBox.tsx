/* eslint-disable react/require-default-props -- defaultProps 已弃用（React 19 移除），改用默认参数；此规则与此方向冲突 */
import {
  FileVideo,
  Film,
  LayoutGrid,
  Music,
  RotateCcw,
  Scissors,
  Shrink,
  Sparkles,
  Terminal as TerminalIcon,
  UploadCloud,
  Volume2,
} from 'lucide-react';
import { memo, useState, useId, type DragEvent } from 'react';
import { useLanguage } from '../LanguageContext';

export interface CommandSource {
  /** 模板名称 */
  label: string;
  /** 命令是否已被手动修改（与模板原始内容不一致） */
  isDirty: boolean;
}

export interface QuickPreset {
  id: string;
  iconName:
    | 'h264'
    | 'audio'
    | 'gif'
    | 'trim'
    | 'shrink'
    | 'volume'
    | 'webm'
    | 'thumbnail';
  titleEn: string;
  titleZh: string;
  command: string;
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'h264',
    iconName: 'h264',
    titleEn: 'Convert to H.264 MP4',
    titleZh: '转换视频 (H.264)',
    command:
      '-i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
  },
  {
    id: 'audio',
    iconName: 'audio',
    titleEn: 'Extract MP3 Audio',
    titleZh: '提取 MP3 音频',
    command: '-i input.mp4 -vn -c:a libmp3lame -b:a 192k output.mp3',
  },
  {
    id: 'shrink',
    iconName: 'shrink',
    titleEn: 'Compress Video',
    titleZh: '压缩视频体积',
    command:
      '-i input.mp4 -vf "scale=iw*0.5:ih*0.5" -c:v libx264 -crf 28 -preset slower -c:a aac -b:a 96k output_compressed.mp4',
  },
  {
    id: 'gif',
    iconName: 'gif',
    titleEn: 'Convert to Animated GIF',
    titleZh: '转换为 GIF 动图',
    command:
      '-i input.mp4 -vf "fps=10,scale=320:-2:flags=lanczos" -c:v gif output.gif',
  },
  {
    id: 'trim',
    iconName: 'trim',
    titleEn: 'Fast Trim (Lossless Copy)',
    titleZh: '无损快速剪切',
    command: '-ss 00:00:10 -i input.mp4 -t 00:00:30 -c copy output_trimmed.mp4',
  },
  {
    id: 'volume',
    iconName: 'volume',
    titleEn: 'Normalize Loudness',
    titleZh: '响度标准化',
    command:
      '-i input.mp4 -filter:a loudnorm=I=-23:LRA=7:TP=-2 -c:v copy output_normalized.mp4',
  },
  {
    id: 'webm',
    iconName: 'webm',
    titleEn: 'Convert to WebM',
    titleZh: '转换为 WebM',
    command:
      '-i input.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k -c:a libopus output.webm',
  },
  {
    id: 'thumbnail',
    iconName: 'thumbnail',
    titleEn: 'Make Thumbnail',
    titleZh: '生成视频缩略图',
    command: '-i input.mp4 -ss 00:00:05 -vframes 1 thumbnail.jpg',
  },
];

export interface CommandBoxProps {
  command: string;
  onCommandChange: (v: string) => void;
  onDragOver: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  onClear: () => void;
  /** 点击后将命令重置为模板原始内容 */
  onReset?: () => void;
  onSelectPreset?: (command: string, label: string) => void;
  /** 点击「浏览全部模板」打开模板下拉 */
  onBrowseTemplates?: () => void;
  id?: string;
  placeholder?: string;
  hasMultipleInputs: boolean;
  /** 命令来源信息（模板名 + 是否 dirty） */
  commandSource: CommandSource | null;
  /** 是否已满足运行前置条件（用于快捷键提示样式） */
  isReadyToRun?: boolean;
}

function CommandBoxImpl({
  command,
  onCommandChange,
  onDragOver,
  onDrop,
  onCopy,
  onClear,
  onReset,
  onSelectPreset,
  onBrowseTemplates,
  id,
  placeholder,
  hasMultipleInputs,
  commandSource,
  isReadyToRun = false,
}: CommandBoxProps) {
  const { t, language } = useLanguage();
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

  const [isDragTarget, setIsDragTarget] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragTarget(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragTarget(false);
  };

  const handleDropInternal = (e: DragEvent<HTMLTextAreaElement>) => {
    setIsDragTarget(false);
    onDrop(e);
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 via-cyan-500 to-emerald-500 rounded-xl opacity-0 blur-sm pointer-events-none transition-opacity duration-500 group-hover:opacity-10 dark:group-hover:opacity-[0.08] motion-reduce:transition-none" />

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className="relative bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600 shadow-sm transition-[border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 overflow-hidden"
      >
        {/* 拖放高亮蒙层 */}
        {isDragTarget && (
          <div className="absolute inset-0 z-20 bg-primary-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-2 border-dashed border-primary-500 rounded-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-2 shadow-inner">
              <UploadCloud size={24} className="animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-primary-900 dark:text-primary-200">
              {language === 'zh'
                ? '松开以将文件路径插入命令'
                : 'Drop file to insert its path into the command'}
            </p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
              {language === 'zh'
                ? '文件路径将插入到光标所在位置'
                : 'The file path will be inserted at the cursor position'}
            </p>
          </div>
        )}

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

        {/* 命令文本域区域 */}
        <div
          className={`relative flex flex-col justify-between ${
            command.trim().length === 0 ? '' : 'min-h-[160px]'
          }`}
        >
          <label htmlFor={textareaId} className="sr-only">
            {t('FFmpeg Command')}
          </label>
          <textarea
            id={textareaId}
            value={command}
            onChange={(e) => onCommandChange(e.target.value)}
            onDragOver={onDragOver}
            onDrop={handleDropInternal}
            aria-describedby={helperTextId}
            placeholder={
              placeholder ?? t('Enter FFmpeg command or drag & drop files here')
            }
            spellCheck={false}
            rows={command.length === 0 ? 3 : 7}
            className="w-full px-4 pt-3 pb-2 bg-transparent border-none resize-none font-mono text-sm text-slate-800 dark:text-slate-200 focus:ring-0 leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />

          {/* 当命令为空时展示常用快捷预设卡片 */}
          {command.trim().length === 0 && (
            <div className="px-4 pb-3 pt-1">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                <Sparkles size={12} className="text-amber-500" />
                <span>
                  {language === 'zh'
                    ? '快速预设 / 常用指令卡片:'
                    : 'Quick Presets:'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {QUICK_PRESETS.map((preset) => {
                  const title =
                    language === 'zh' ? preset.titleZh : preset.titleEn;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        if (onSelectPreset) {
                          onSelectPreset(preset.command, title);
                        } else {
                          onCommandChange(preset.command);
                        }
                      }}
                      className="group/preset flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 text-left transition-all duration-150"
                    >
                      <div className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0 group-hover/preset:scale-105 transition-transform">
                        {preset.iconName === 'h264' && <FileVideo size={13} />}
                        {preset.iconName === 'audio' && <Music size={13} />}
                        {preset.iconName === 'gif' && <Film size={13} />}
                        {preset.iconName === 'trim' && <Scissors size={13} />}
                        {preset.iconName === 'shrink' && <Shrink size={13} />}
                        {preset.iconName === 'volume' && <Volume2 size={13} />}
                        {preset.iconName === 'webm' && <Film size={13} />}
                        {preset.iconName === 'thumbnail' && (
                          <FileVideo size={13} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate group-hover/preset:text-primary-600 dark:group-hover/preset:text-primary-400">
                          {title}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {onBrowseTemplates && (
                  <button
                    type="button"
                    onClick={onBrowseTemplates}
                    className="flex items-center justify-center gap-2 p-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/15 transition-all duration-150"
                  >
                    <LayoutGrid size={13} className="flex-shrink-0" />
                    <span className="text-[11px] font-medium truncate">
                      {language === 'zh'
                        ? '浏览全部模板'
                        : 'Browse all templates'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部：字符数 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-slate-50 dark:border-slate-800">
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

export const CommandBox = memo(CommandBoxImpl);
