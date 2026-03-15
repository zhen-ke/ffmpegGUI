/**
 * Home - FFmpeg GUI 主界面（新布局版）
 *
 * 布局结构：
 * ┌─────────────────────────────────────────────┐
 * │  导航条：Logo · 模式切换 · 语言              │  固定，极简
 * ├─────────────────────────────────────────────┤
 * │  模板(5) · 输入文件(4) · 输出目录(3)         │  主操作行
 * │  ┌─────────────────────────────────────────┐│
 * │  │ $ ffmpeg ...命令框...        [▶ 运行]   ││  命令框 + 运行按钮合为一体
 * │  └─────────────────────────────────────────┘│
 * ╠═════════════════════════════════════════════╣  可拖拽分割线
 * │  [● 47.4% ████░░]  控制台输出  [■ 停止]     │  进度 + 停止合入日志 header
 * │  ...日志内容...                              │
 * └─────────────────────────────────────────────┘
 *
 */

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  PlusCircle,
  Square,
  Terminal as TerminalIcon,
  Zap,
} from 'lucide-react';
import type { DragEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dropdown, { type DropdownOption } from './components/Dropdown';
import FFmpegDownloader from './components/FFmpegDownloader';
import { TemplateDialog } from './components/TemplateDialog';
import Terminal from './components/Terminal/Terminal';
import { commandTemplates } from './constants/commandTemplates';
import { useLanguage } from './LanguageContext';

import { useCommandManager } from './hooks/useCommandManager';
import { useElectronIPC } from './hooks/useElectronIPC';
import { useFFmpegState } from './hooks/useFFmpegState';
import { useFileSelection } from './hooks/useFileSelection';
import { useLogs } from './hooks/useLogs';
import { useTemplateManager } from './hooks/useTemplateManager';

import { FileSelector } from './components/FileSelector';
import { countInputArguments, updateCommandPaths } from './utils/commandUtils';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const MIN_CONTROL_HEIGHT = 48;
const DEFAULT_SPLIT_HEIGHT = 300;
const MAX_CONTROL_RATIO = 0.75;
const MIN_LOG_HEIGHT = 140;
const LS_KEY = 'ffmpeg-split-height-v2';

// ─────────────────────────────────────────────
// DragHandle
// ─────────────────────────────────────────────

function DragHandle({
  onMouseDown,
  isDragging,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      title="拖拽调整面板高度"
      className={`
        flex-shrink-0 relative flex items-center justify-center
        h-3 cursor-row-resize select-none z-30 group
        transition-colors duration-150
        ${isDragging
          ? 'bg-primary-100/80 dark:bg-primary-900/40'
          : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}
      `}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-200 dark:bg-slate-700" />
      <div
        className={`
          relative z-10 flex items-center gap-0.5 px-2.5 py-0.5 rounded-full border
          transition-all duration-150 shadow-sm
          ${isDragging
            ? 'bg-primary-50 dark:bg-primary-900/60 border-primary-300 dark:border-primary-700 scale-110'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 group-hover:border-primary-300 dark:group-hover:border-primary-600 group-hover:scale-105'}
        `}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-4 h-0.5 rounded-full transition-colors duration-150 ${
              isDragging
                ? 'bg-primary-400 dark:bg-primary-500'
                : 'bg-slate-300 dark:bg-slate-500 group-hover:bg-primary-400 dark:group-hover:bg-primary-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CommandBox：命令框 + 内嵌运行按钮
// ─────────────────────────────────────────────

interface CommandBoxProps {
  command: string;
  onCommandChange: (v: string) => void;
  onDragOver: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  onClear: () => void;
  onStart: () => void;
  isRunning: boolean;
  isStopping: boolean;
  placeholder?: string;
  hasMultipleInputs: boolean;
}

function CommandBox({
  command,
  onCommandChange,
  onDragOver,
  onDrop,
  onCopy,
  onClear,
  onStart,
  isRunning,
  isStopping,
  placeholder,
  hasMultipleInputs,
}: CommandBoxProps) {
  const { t } = useLanguage();
  const canStart = command.trim().length > 0 && !isRunning && !isStopping;

  return (
    <div className="relative group">
      {/* 外发光 hover 效果 */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 via-purple-500 to-pink-500 rounded-xl opacity-0 group-hover:opacity-10 dark:group-hover:opacity-[0.08] transition duration-500 blur-sm pointer-events-none" />

      <div className="relative bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-100 dark:border-slate-700 group-hover:border-slate-200 dark:group-hover:border-slate-600 shadow-sm transition-all duration-300">

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
              className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
            >
              {t('Copy')}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-1 text-[11px] font-medium rounded-md text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all"
            >
              {t('Clear')}
            </button>
          </div>
        </div>

        {/* 命令文本域 */}
        <textarea
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          onDragOver={onDragOver}
          onDrop={onDrop}
          placeholder={placeholder ?? t('Enter FFmpeg command or drag & drop files here')}
          spellCheck={false}
          rows={3}
          className="w-full px-4 pt-3 pb-2 bg-transparent border-none resize-none font-mono text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:ring-inset leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
        />

        {/* 底部：字符数 + 内嵌运行按钮 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono select-none">
            {command.length > 0 ? `${command.length} chars` : ''}
          </span>

          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
              transition-all duration-200 focus:outline-none
              focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
              dark:focus-visible:ring-offset-slate-800
              ${canStart
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md shadow-primary-500/25 hover:shadow-lg hover:shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {isRunning || isStopping
              ? <Loader2 size={14} className="animate-spin" />
              : <Play size={14} className={canStart ? 'fill-current' : ''} />
            }
            <span>{t('Start')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LogHeader：日志区专属 header（含进度条 + 停止）
// ─────────────────────────────────────────────

interface LogHeaderProps {
  isRunning: boolean;
  isStopping: boolean;
  progress: number;
  onStop: () => void;
  onClear: () => void;
  onCopy: () => void;
  isAutoScrollEnabled: boolean;
}

function LogHeader({
  isRunning,
  isStopping,
  progress,
  onStop,
  onClear,
  onCopy,
  isAutoScrollEnabled,
}: LogHeaderProps) {
  const { t } = useLanguage();
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const hasProgress = clampedProgress > 0;

  return (
    <div className="flex-shrink-0 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      {/* 主 header 行 */}
      <div className="flex items-center justify-between px-4 py-2.5">
        {/* 左：Mac 圆点 + 标题 + 运行状态徽章 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-green-400/80" />
          </div>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-1">
            {t('Console Output')}
          </span>

          {/* 运行中：百分比徽章 */}
          {isRunning && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full border border-primary-200/60 dark:border-primary-700/40">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
              {hasProgress ? `${clampedProgress.toFixed(1)}%` : t('Running...')}
            </span>
          )}

          {/* 滚动暂停提示 */}
          {!isRunning && !isAutoScrollEnabled && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-700/40">
              {t('Paused')}
            </span>
          )}
        </div>

        {/* 右：工具按钮 + 停止 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCopy}
            title={t('Copy raw text')}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClear}
            title={t('Clear console')}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />

          {/* 停止按钮 —— 位于日志区，折叠控制区后仍可操作 */}
          <button
            type="button"
            onClick={onStop}
            disabled={!isRunning || isStopping}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all duration-200 border
              ${!isRunning || isStopping
                ? 'bg-slate-50 dark:bg-slate-700/30 text-slate-300 dark:text-slate-600 border-slate-200/50 dark:border-slate-700/30 cursor-not-allowed'
                : 'bg-white dark:bg-slate-700 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 hover:shadow-sm'
              }
            `}
          >
            {isStopping
              ? <Loader2 size={12} className="animate-spin" />
              : <Square size={12} fill={isRunning && !isStopping ? 'currentColor' : 'none'} />
            }
            <span>{isStopping ? t('Stopping...') : t('Stop')}</span>
          </button>
        </div>
      </div>

      {/* 进度条 —— 从 header 底部滑出，高度极小不抢日志空间 */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isRunning ? 'max-h-8 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-2.5">
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-primary-500 via-primary-400 to-cyan-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] ${
                hasProgress ? '' : 'animate-pulse'
              }`}
              style={{ width: hasProgress ? `${clampedProgress}%` : '30%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
  const [showTerminal, setShowTerminal] = useState(false);

  // ── 分割面板状态 ──

  const [splitHeight, setSplitHeight] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const userSplitHeightRef = useRef<number | null>(splitHeight);

  // ── Hooks ──

  const {
    logs, logsRef, addLog, clearLogs, copyLogs,
    handleLogsScroll, isAutoScrollEnabled,
  } = useLogs();

  const handleOperationalError = useCallback(
    (message: string) => addLog('error', t(message)),
    [addLog, t],
  );

  const {
    inputFile, outputFolder,
    handleSelectInputFile, handleSelectOutputFolder,
    clearInputFile, clearOutputFolder,
  } = useFileSelection({ onError: handleOperationalError });

  const {
    command, updateCommand, updateCommandWithPaths,
    handleDragOver, handleDrop, clearCommand, copyCommand,
  } = useCommandManager({ inputFile, outputFolder });

  const {
    selectedTemplateId, customTemplates, isTemplateDialogOpen, editingTemplate,
    transformTemplate, handleTemplateSelect, handleSaveTemplate, handleDeleteTemplate,
    handleEditTemplate, openNewTemplateDialog, closeTemplateDialog,
  } = useTemplateManager({ onError: handleOperationalError });

  const templateOptions = useMemo(
    () => [...customTemplates.map(transformTemplate), ...commandTemplates.map(transformTemplate)],
    [customTemplates, transformTemplate],
  );

  const selectedTemplate = useMemo(
    () => templateOptions.find((tpl) => tpl.id === selectedTemplateId) ?? null,
    [templateOptions, selectedTemplateId],
  );

  const { isRunning, isStopping, progress, handleStart, handleStop } =
    useFFmpegState({ onLog: addLog });

  // ── Refs for stale-closure safety ──

  const inputFileRef = useRef(inputFile);
  const outputFolderRef = useRef(outputFolder);
  const commandRef = useRef(command);
  const selectedTemplateIdRef = useRef<string | null>(selectedTemplateId);
  inputFileRef.current = inputFile;
  outputFolderRef.current = outputFolder;
  commandRef.current = command;
  selectedTemplateIdRef.current = selectedTemplateId;

  // ── 运行时自动折叠（方案 B）──

  const prevIsRunningRef = useRef(false);
  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = isRunning;
    if (!wasRunning && isRunning) {
      if (splitHeight !== null) userSplitHeightRef.current = splitHeight;
      setIsCollapsed(true);
    } else if (wasRunning && !isRunning) {
      setIsCollapsed(false);
    }
  }, [isRunning, splitHeight]);

  // ── 拖拽分割线（方案 A）──

  const handleDragHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isCollapsed) return;
      const container = containerRef.current;
      if (!container) return;
      const controlEl = container.querySelector<HTMLElement>('[data-panel="control"]');
      const currentHeight = controlEl?.getBoundingClientRect().height ?? DEFAULT_SPLIT_HEIGHT;
      dragStartYRef.current = e.clientY;
      dragStartHeightRef.current = currentHeight;
      setIsDragging(true);
    },
    [isCollapsed],
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const containerHeight = container.getBoundingClientRect().height;
      const maxH = Math.floor(containerHeight * MAX_CONTROL_RATIO);
      const delta = e.clientY - dragStartYRef.current;
      const newH = Math.min(maxH, Math.max(MIN_CONTROL_HEIGHT, dragStartHeightRef.current + delta));
      if (containerHeight - newH - 12 < MIN_LOG_HEIGHT) return;
      setSplitHeight(newH);
      userSplitHeightRef.current = newH;
    };
    const onUp = () => {
      setIsDragging(false);
      if (userSplitHeightRef.current !== null) {
        try { localStorage.setItem(LS_KEY, String(userSplitHeightRef.current)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // ── 文件变化 → 更新命令路径 ──

  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) { isInitialRender.current = false; return; }
    if (inputFile || outputFolder) updateCommandWithPaths();
  }, [inputFile, outputFolder, updateCommandWithPaths]);

  // ── 模板变化 → 更新命令 ──

  const selectedTemplateCommand = selectedTemplate?.command;
  const applyTemplateCommand = useCallback(
    (tplCmd: string) => {
      const f = inputFileRef.current;
      const o = outputFolderRef.current;
      if (f || o) updateCommandWithPaths(tplCmd, f, o);
      else updateCommand(tplCmd);
    },
    [updateCommand, updateCommandWithPaths],
  );
  useEffect(() => {
    if (!selectedTemplateId || !selectedTemplateCommand) return;
    applyTemplateCommand(selectedTemplateCommand);
  }, [applyTemplateCommand, selectedTemplateCommand, selectedTemplateId]);

  const handleTemplateSelectWithConfirm = useCallback(
    (template: DropdownOption) => {
      if (template.id === selectedTemplateIdRef.current) return;
      const f = inputFileRef.current;
      const o = outputFolderRef.current;
      const nextCmd = (f || o) ? updateCommandPaths(template.command, f, o) : template.command;
      const current = commandRef.current.trim();
      if (current && current !== nextCmd.trim()) {
        if (!window.confirm(t('Selecting a template will replace the current command. Continue?'))) return;
      }
      handleTemplateSelect(template);
    },
    [handleTemplateSelect, t],
  );

  // ── 操作处理 ──

  const onStart = useCallback(() => {
    const cmd = command.trim();
    if (!cmd) return;
    clearLogs();
    handleStart(cmd);
  }, [clearLogs, handleStart, command]);

  const handleCopyCommand = useCallback(async () => {
    const r = await copyCommand();
    if (r === 'success') addLog('success', t('Command copied to clipboard.'));
    else if (r === 'empty') addLog('info', t('Nothing to copy.'));
    else addLog('error', t('Failed to copy command.'));
  }, [addLog, copyCommand, t]);

  const handleCopyLogs = useCallback(async () => {
    const r = await copyLogs();
    if (r === 'success') addLog('success', t('Log copied to clipboard.'));
    else if (r === 'empty') addLog('info', t('Nothing to copy.'));
    else addLog('error', t('Failed to copy logs.'));
  }, [addLog, copyLogs, t]);

  const handleDeleteTemplateWithConfirm = useCallback(
    (templateId: string) => {
      if (!window.confirm(t('Delete this custom template?'))) return;
      handleDeleteTemplate(templateId);
    },
    [handleDeleteTemplate, t],
  );

  const hasMultipleInputs = useMemo(
    () => countInputArguments(command) > 1,
    [command],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  }, [language, setLanguage]);

  const handleOpenTerminal = useCallback(() => {
    setShowTerminal((prev) => !prev);
  }, []);

  // ── 控制区高度计算 ──

  const controlPanelStyle = useMemo<React.CSSProperties>(() => {
    if (showTerminal) return {};
    if (isCollapsed) return { height: MIN_CONTROL_HEIGHT, minHeight: MIN_CONTROL_HEIGHT, maxHeight: MIN_CONTROL_HEIGHT };
    if (splitHeight !== null) return { height: splitHeight, minHeight: MIN_CONTROL_HEIGHT, flexShrink: 0 };
    return { flexShrink: 0 };
  }, [isCollapsed, splitHeight, showTerminal]);

  // ── 加载态 ──

  if (ffmpegExists === null) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 dark:border-primary-900/50 rounded-full" />
            <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-primary-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!ffmpegExists) return <FFmpegDownloader />;

  // ─────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-hidden transition-colors duration-300"
    >

      {/* ══════════════════════════════════════
          导航条：Logo · 模式切换 · 右侧工具
          独立一行，视觉层级最高
      ══════════════════════════════════════ */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 pb-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm z-20">

        {/* 左：Logo + 标题 */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-md shadow-primary-500/20 flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {t('FFmpeg Tool')}
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
              {t('Video & Audio Processing')}
            </p>
          </div>
        </div>

        {/* 中：模式切换 Tab */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl border border-slate-200/60 dark:border-slate-600/50">
          <button
            type="button"
            onClick={() => showTerminal && handleOpenTerminal()}
            disabled={!showTerminal}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              !showTerminal
                ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm ring-1 ring-primary-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            FFmpeg
          </button>
          <button
            type="button"
            onClick={() => !showTerminal && handleOpenTerminal()}
            disabled={showTerminal}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              showTerminal
                ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm ring-1 ring-primary-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {t('Terminal')}
          </button>
        </div>

        {/* 右：语言 · Add Template · 折叠按钮 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-600/50 transition-all"
          >
            {language === 'en' ? '中文' : 'EN'}
          </button>

          {!showTerminal && (
            <>
              <button
                type="button"
                onClick={openNewTemplateDialog}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg border border-primary-200/60 dark:border-primary-700/30 transition-all hover:shadow-sm"
              >
                <PlusCircle size={14} />
                {t('Add Template')}
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsed((v) => !v)}
                title={isCollapsed ? '展开控制面板' : '折叠控制面板'}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all"
              >
                {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════════
          控制区：模板 · 文件选择 · 命令框
      ══════════════════════════════════════ */}
      <div
        data-panel="control"
        style={controlPanelStyle}
        className={`
          bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
          border-b border-slate-200/60 dark:border-slate-700/60
          z-10 transition-[height] duration-300 ease-in-out
          ${showTerminal ? 'flex-1 flex flex-col min-h-0' : 'flex flex-col overflow-hidden'}
        `}
      >
        {showTerminal ? (
          <div className="flex-1 min-h-0 p-4">
            <Terminal />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full px-6 py-4 space-y-4">

              {/* 主操作行：模板 5 · 输入 4 · 输出 3（权重递减） */}
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    Template
                  </label>
                  <Dropdown
                    options={templateOptions}
                    onChange={handleTemplateSelectWithConfirm}
                    value={selectedTemplate}
                    placeholder={t('Select a template')}
                    onEdit={handleEditTemplate}
                    onDelete={handleDeleteTemplateWithConfirm}
                  />
                </div>

                <div className="col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    {t('Input File')}
                  </label>
                  <FileSelector
                    type="input"
                    value={inputFile}
                    onSelect={handleSelectInputFile}
                    onClear={clearInputFile}
                    label={t('Select Input File')}
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    {t('Output Folder')}
                  </label>
                  <FileSelector
                    type="output"
                    value={outputFolder}
                    onSelect={handleSelectOutputFolder}
                    onClear={clearOutputFolder}
                    label={t('Select Output Folder')}
                  />
                </div>
              </div>

              {/* 命令框（内嵌运行按钮） */}
              <CommandBox
                command={command}
                onCommandChange={updateCommand}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onCopy={handleCopyCommand}
                onClear={clearCommand}
                onStart={onStart}
                isRunning={isRunning}
                isStopping={isStopping}
                placeholder={t('Enter FFmpeg command or drag & drop files here')}
                hasMultipleInputs={hasMultipleInputs}
              />

            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          拖拽分割线（非 Terminal、非折叠时）
      ══════════════════════════════════════ */}
      {!showTerminal && !isCollapsed && (
        <DragHandle
          onMouseDown={handleDragHandleMouseDown}
          isDragging={isDragging}
        />
      )}

      {/* Template Dialog */}
      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={closeTemplateDialog}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
      />

      {/* ══════════════════════════════════════
          日志区：LogHeader（进度 + 停止）+ 内容
          flex-1 占满所有剩余空间
      ══════════════════════════════════════ */}
      {!showTerminal && (
        <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-800/50 dark:to-slate-900/50 transition-colors duration-300">

          <LogHeader
            isRunning={isRunning}
            isStopping={isStopping}
            progress={progress}
            onStop={handleStop}
            onClear={clearLogs}
            onCopy={handleCopyLogs}
            isAutoScrollEnabled={isAutoScrollEnabled}
          />

          {/* 日志滚动内容 */}
          <div className="flex-1 relative bg-white dark:bg-slate-900 shadow-inner">
            <div
              ref={logsRef}
              role="log"
              aria-live="polite"
              aria-label="FFmpeg log output"
              onScroll={handleLogsScroll}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent font-mono text-sm"
            >
              {logs.length > 0 ? (
                <div className="p-4">
                  {logs.map((logHtml, index) => (
                    <div key={index} dangerouslySetInnerHTML={{ __html: logHtml }} />
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center pointer-events-none select-none">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center shadow-inner">
                      <TerminalIcon size={36} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                      <Play size={10} className="text-white ml-0.5" />
                    </div>
                  </div>
                  <p className="text-slate-400 dark:text-slate-500 font-medium">
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
      )}

      {/* 拖拽时防止文本选中的全局遮罩 */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-row-resize select-none" />
      )}
    </div>
  );
}

export default Home;
