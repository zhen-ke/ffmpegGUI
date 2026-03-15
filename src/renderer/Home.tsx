/**
 * Home - FFmpeg GUI 主界面组件（重构版）
 * 使用模块化的 hooks 和组件构建
 * 新增：A+B 方案 —— 可拖拽分割线 + 运行时自动折叠控制区
 */

import { ChevronDown, ChevronUp, Loader2, PlusCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dropdown, { type DropdownOption } from './components/Dropdown';
import FFmpegDownloader from './components/FFmpegDownloader';
import { TemplateDialog } from './components/TemplateDialog';
import Terminal from './components/Terminal/Terminal';
import { commandTemplates } from './constants/commandTemplates';
import { useLanguage } from './LanguageContext';

// 导入自定义 hooks
import { useCommandManager } from './hooks/useCommandManager';
import { useElectronIPC } from './hooks/useElectronIPC';
import { useFFmpegState } from './hooks/useFFmpegState';
import { useFileSelection } from './hooks/useFileSelection';
import { useLogs } from './hooks/useLogs';
import { useTemplateManager } from './hooks/useTemplateManager';

// 导入 UI 组件
import { CommandInput } from './components/CommandInput';
import { ControlButtons } from './components/ControlButtons';
import { FileSelector } from './components/FileSelector';
import { LogDisplay } from './components/LogDisplay';
import { ProgressBar } from './components/ProgressBar';
import { countInputArguments, updateCommandPaths } from './utils/commandUtils';

// ========== 常量 ==========

const COLLAPSED_HEIGHT = 52;          // 折叠态 header 条高度 (px)
const DEFAULT_SPLIT_HEIGHT = 340;     // 默认控制区高度 (px)
const MIN_CONTROL_HEIGHT = COLLAPSED_HEIGHT;
const MAX_CONTROL_RATIO = 0.72;       // 控制区最多占容器的 72%
const MIN_LOG_HEIGHT = 120;           // 日志区最小高度 (px)
const LS_KEY = 'ffmpeg-split-height'; // localStorage key

// ========== DragHandle 组件 ==========

interface DragHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
}

function DragHandle({ onMouseDown, isDragging }: DragHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        flex-shrink-0 relative flex items-center justify-center
        h-3 cursor-row-resize select-none z-30
        group transition-colors duration-150
        ${isDragging
          ? 'bg-primary-100/80 dark:bg-primary-900/40'
          : 'hover:bg-slate-100/80 dark:hover:bg-slate-700/40'
        }
      `}
      title="拖拽调整面板高度"
    >
      {/* 分割线轨道 */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-200/80 dark:bg-slate-700/60" />
      {/* 拖拽把手 pill */}
      <div
        className={`
          relative z-10 flex items-center gap-0.5 px-2.5 py-0.5 rounded-full
          border transition-all duration-150 shadow-sm
          ${isDragging
            ? 'bg-primary-50 dark:bg-primary-900/60 border-primary-300 dark:border-primary-700 scale-110'
            : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-600/60 group-hover:border-primary-300 dark:group-hover:border-primary-700 group-hover:scale-105'
          }
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

// ========== 折叠态 Header 条 ==========

interface CollapsedHeaderProps {
  inputFile: string | null;
  outputFolder: string | null;
  isRunning: boolean;
  isStopping: boolean;
  onStop: () => void;
  onExpand: () => void;
  stopLabel: string;
  stoppingLabel: string;
}

function CollapsedHeader({
  inputFile,
  outputFolder,
  isRunning,
  isStopping,
  onStop,
  onExpand,
  stopLabel,
  stoppingLabel,
}: CollapsedHeaderProps) {
  // 文件名摘要
  const inputName = inputFile
    ? inputFile.split(/[\\/]/).pop() ?? inputFile
    : null;
  const outputName = outputFolder
    ? outputFolder.split(/[\\/]/).pop() ?? outputFolder
    : null;

  return (
    <div className="flex items-center justify-between px-6 h-full gap-4">
      {/* 左：Logo + 标题 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="p-1.5 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-md shadow-primary-500/25">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          FFmpeg Tool
        </span>
      </div>

      {/* 中：路径摘要 */}
      {(inputName || outputName) && (
        <div className="flex items-center gap-2 min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
          {inputName && (
            <span className="truncate max-w-[180px] bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded font-mono">
              {inputName}
            </span>
          )}
          {inputName && outputName && (
            <span className="flex-shrink-0 text-slate-300 dark:text-slate-600">→</span>
          )}
          {outputName && (
            <span className="truncate max-w-[180px] bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded font-mono">
              {outputName}/
            </span>
          )}
        </div>
      )}

      {/* 右：Stop 按钮 + 展开按钮 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onStop}
          disabled={!isRunning || isStopping}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            transition-all duration-200 border
            ${!isRunning || isStopping
              ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 border-transparent cursor-not-allowed'
              : 'bg-white dark:bg-slate-700 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700/50'
            }
          `}
        >
          {isStopping ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          )}
          {isStopping ? stoppingLabel : stopLabel}
        </button>

        <button
          type="button"
          onClick={onExpand}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          title="展开控制面板"
        >
          <ChevronDown size={14} />
          <span>展开</span>
        </button>
      </div>
    </div>
  );
}

// ========== 主组件 ==========

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
  const [showTerminal, setShowTerminal] = useState(false);

  // ========== 分割面板状态 ==========

  // 控制区高度（null = 自然高度）
  const [splitHeight, setSplitHeight] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  // 用户是否手动拖拽过（用于运行结束后恢复）
  const userSplitHeightRef = useRef<number | null>(splitHeight);

  // 折叠态：运行时自动折叠，或用户手动折叠
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // ========== 使用自定义 Hooks ==========

  const {
    logs,
    logsRef,
    addLog,
    clearLogs,
    copyLogs,
    handleLogsScroll,
    isAutoScrollEnabled,
  } = useLogs();

  const handleOperationalError = useCallback(
    (message: string) => {
      addLog('error', t(message));
    },
    [addLog, t],
  );

  const {
    inputFile,
    outputFolder,
    handleSelectInputFile,
    handleSelectOutputFolder,
    clearInputFile,
    clearOutputFolder,
  } = useFileSelection({ onError: handleOperationalError });

  const {
    command,
    updateCommand,
    updateCommandWithPaths,
    handleDragOver,
    handleDrop,
    clearCommand,
    copyCommand,
  } = useCommandManager({ inputFile, outputFolder });

  const {
    selectedTemplateId,
    customTemplates,
    isTemplateDialogOpen,
    editingTemplate,
    transformTemplate,
    handleTemplateSelect,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleEditTemplate,
    openNewTemplateDialog,
    closeTemplateDialog,
  } = useTemplateManager({ onError: handleOperationalError });

  const templateOptions = useMemo(
    () => [
      ...customTemplates.map(transformTemplate),
      ...commandTemplates.map(transformTemplate),
    ],
    [customTemplates, transformTemplate],
  );

  const selectedTemplate = useMemo(
    () =>
      templateOptions.find((template) => template.id === selectedTemplateId) ?? null,
    [templateOptions, selectedTemplateId],
  );

  const { isRunning, isStopping, progress, handleStart, handleStop } =
    useFFmpegState({ onLog: addLog });

  // ========== 运行时自动折叠（方案 B）==========

  const prevIsRunningRef = useRef(false);

  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = isRunning;

    if (!wasRunning && isRunning) {
      // 开始运行：记录当前高度，然后折叠
      if (splitHeight !== null) {
        userSplitHeightRef.current = splitHeight;
      }
      setIsCollapsed(true);
    } else if (wasRunning && !isRunning) {
      // 运行结束：自动展开
      setIsCollapsed(false);
    }
  }, [isRunning, splitHeight]);

  // ========== 拖拽分割线逻辑（方案 A）==========

  const handleDragHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isCollapsed) return; // 折叠时禁止拖拽

      const container = containerRef.current;
      if (!container) return;

      // 以控制区当前渲染高度为起点
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

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const containerHeight = container.getBoundingClientRect().height;
      const maxHeight = Math.floor(containerHeight * MAX_CONTROL_RATIO);
      const minHeight = MIN_CONTROL_HEIGHT;

      const delta = e.clientY - dragStartYRef.current;
      const newHeight = Math.min(
        maxHeight,
        Math.max(minHeight, dragStartHeightRef.current + delta),
      );

      // 保证日志区不低于最小高度
      const remaining = containerHeight - newHeight - 12; // 12 = drag handle
      if (remaining < MIN_LOG_HEIGHT) return;

      setSplitHeight(newHeight);
      userSplitHeightRef.current = newHeight;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // 持久化到 localStorage
      if (userSplitHeightRef.current !== null) {
        try {
          localStorage.setItem(LS_KEY, String(userSplitHeightRef.current));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // ========== 展开 / 折叠切换 ==========

  const handleExpand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  // ========== 其他事件处理 ==========

  const handleOpenTerminal = useCallback(() => {
    setShowTerminal((prev) => !prev);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  }, [language, setLanguage]);

  const inputFileRef = useRef(inputFile);
  const outputFolderRef = useRef(outputFolder);
  const commandRef = useRef(command);
  inputFileRef.current = inputFile;
  outputFolderRef.current = outputFolder;
  commandRef.current = command;

  const selectedTemplateIdRef = useRef<string | null>(selectedTemplateId);
  selectedTemplateIdRef.current = selectedTemplateId;

  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (inputFile || outputFolder) {
      updateCommandWithPaths();
    }
  }, [inputFile, outputFolder, updateCommandWithPaths]);

  const selectedTemplateCommand = selectedTemplate?.command;

  const applyTemplateCommand = useCallback(
    (templateCommand: string) => {
      const latestInputFile = inputFileRef.current;
      const latestOutputFolder = outputFolderRef.current;
      if (latestInputFile || latestOutputFolder) {
        updateCommandWithPaths(templateCommand, latestInputFile, latestOutputFolder);
      } else {
        updateCommand(templateCommand);
      }
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

      const latestInputFile = inputFileRef.current;
      const latestOutputFolder = outputFolderRef.current;
      const nextCommand =
        latestInputFile || latestOutputFolder
          ? updateCommandPaths(template.command, latestInputFile, latestOutputFolder)
          : template.command;

      const currentCommand = commandRef.current.trim();
      if (currentCommand && currentCommand !== nextCommand.trim()) {
        const shouldReplace = window.confirm(
          t('Selecting a template will replace the current command. Continue?'),
        );
        if (!shouldReplace) return;
      }

      handleTemplateSelect(template);
    },
    [handleTemplateSelect, t],
  );

  const onStart = useCallback(() => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;
    clearLogs();
    handleStart(trimmedCommand);
  }, [clearLogs, handleStart, command]);

  const handleCopyCommand = useCallback(async () => {
    const result = await copyCommand();
    if (result === 'success') { addLog('success', t('Command copied to clipboard.')); return; }
    if (result === 'empty') { addLog('info', t('Nothing to copy.')); return; }
    addLog('error', t('Failed to copy command.'));
  }, [addLog, copyCommand, t]);

  const handleCopyLogs = useCallback(async () => {
    const result = await copyLogs();
    if (result === 'success') { addLog('success', t('Log copied to clipboard.')); return; }
    if (result === 'empty') { addLog('info', t('Nothing to copy.')); return; }
    addLog('error', t('Failed to copy logs.'));
  }, [addLog, copyLogs, t]);

  const handleDeleteTemplateWithConfirm = useCallback(
    (templateId: string) => {
      const shouldDelete = window.confirm(t('Delete this custom template?'));
      if (!shouldDelete) return;
      handleDeleteTemplate(templateId);
    },
    [handleDeleteTemplate, t],
  );

  const hasMultipleInputs = useMemo(
    () => countInputArguments(command) > 1,
    [command],
  );

  // ========== 控制区高度计算 ==========

  // 折叠时固定为 COLLAPSED_HEIGHT；否则使用用户拖拽高度或自然高度
  const controlPanelStyle = useMemo<React.CSSProperties>(() => {
    if (showTerminal) {
      // Terminal 模式：控制区 flex-1，不参与分割逻辑
      return {};
    }
    if (isCollapsed) {
      return { height: COLLAPSED_HEIGHT, minHeight: COLLAPSED_HEIGHT, maxHeight: COLLAPSED_HEIGHT, overflow: 'hidden' };
    }
    if (splitHeight !== null) {
      return { height: splitHeight, minHeight: MIN_CONTROL_HEIGHT, flexShrink: 0 };
    }
    return { flexShrink: 0 };
  }, [isCollapsed, splitHeight, showTerminal]);

  // ========== 渲染 ==========

  if (ffmpegExists === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 dark:border-primary-900/50 rounded-full"></div>
            <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-primary-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!ffmpegExists) {
    return <FFmpegDownloader />;
  }

  return (
    <div
      ref={containerRef}
      className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-hidden transition-colors duration-300"
    >
      {/* ================= 控制区 ================= */}
      <div
        data-panel="control"
        style={controlPanelStyle}
        className={`
          bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
          border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm z-20
          transition-[height,opacity] duration-300 ease-in-out
          ${showTerminal ? 'flex-1 flex flex-col min-h-0' : 'flex flex-col'}
          ${isDragging ? '' : ''}
        `}
      >
        {/* 折叠态：仅显示 header 条 */}
        {isCollapsed && !showTerminal ? (
          <CollapsedHeader
            inputFile={inputFile}
            outputFolder={outputFolder}
            isRunning={isRunning}
            isStopping={isStopping}
            onStop={handleStop}
            onExpand={handleExpand}
            stopLabel={t('Stop')}
            stoppingLabel={t('Stopping...')}
          />
        ) : (
          /* 展开态：完整控制内容（带内部滚动） */
          <div
            className={`
              ${showTerminal ? 'flex-1 flex flex-col min-h-0' : 'flex-1 min-h-0 overflow-y-auto'}
            `}
          >
            <div
              className={`
                max-w-7xl mx-auto w-full px-6
                ${showTerminal ? 'pt-0 pb-4 flex-1 flex flex-col min-h-0' : 'py-0'}
                space-y-5
              `}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between animate-slide-up">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg shadow-primary-500/25">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {t('FFmpeg Tool')}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">
                      {t('Video & Audio Processing')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl border border-slate-200/60 dark:border-slate-600/50">
                      <button
                        type="button"
                        onClick={() => showTerminal && handleOpenTerminal()}
                        disabled={!showTerminal}
                        className={`flex items-center px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                          !showTerminal
                            ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm ring-1 ring-primary-500/20'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50'
                        }`}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        FFmpeg
                      </button>
                      <button
                        type="button"
                        onClick={() => !showTerminal && handleOpenTerminal()}
                        disabled={showTerminal}
                        className={`flex items-center px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                          showTerminal
                            ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm ring-1 ring-primary-500/20'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50'
                        }`}
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('Terminal')}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={toggleLanguage}
                      className="px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200/60 dark:border-slate-600/50 transition-all hover:shadow-sm"
                    >
                      {language === 'en' ? '中文' : 'EN'}
                    </button>
                  </div>
                </div>

                {/* 右侧：折叠按钮 + Add Template */}
                {!showTerminal && (
                  <div className="flex items-center gap-2">
                    {/* 手动折叠按钮 */}
                    <button
                      type="button"
                      onClick={handleCollapse}
                      className="flex items-center gap-1 px-2.5 py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-all"
                      title="折叠控制面板"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={openNewTemplateDialog}
                      className="flex items-center px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-xl transition-all duration-200 border border-primary-200/60 dark:border-primary-700/30 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <PlusCircle size={18} className="mr-2" />
                      {t('Add Template')}
                    </button>
                  </div>
                )}
              </div>

              {/* Dropdown & File Inputs Grid */}
              {!showTerminal && (
                <div
                  className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-slide-up"
                  style={{ animationDelay: '50ms' }}
                >
                  <div className="lg:col-span-4">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-0.5">
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
                  <div className="lg:col-span-4">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-0.5">
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
                  <div className="lg:col-span-4">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-0.5">
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
              )}

              {/* Terminal 模式 or FFmpeg 模式 */}
              {showTerminal ? (
                <div className="flex-1 min-h-0 mt-2">
                  <Terminal />
                </div>
              ) : (
                <>
                  <CommandInput
                    command={command}
                    onCommandChange={updateCommand}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onCopy={handleCopyCommand}
                    onClear={clearCommand}
                    placeholder={t('Enter FFmpeg command or drag & drop files here')}
                  />
                  {hasMultipleInputs && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                      {t('This command has multiple input files; only the first -i is auto-bound from the input selector.')}
                    </p>
                  )}
                  <ControlButtons
                    isRunning={isRunning}
                    isStopping={isStopping}
                    canStart={command.trim().length > 0}
                    onStart={onStart}
                    onStop={handleStop}
                    startLabel={t('Start')}
                    stopLabel={t('Stop')}
                    stoppingLabel={t('Stopping...')}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= 拖拽分割线（仅非 Terminal、非折叠模式） ================= */}
      {!showTerminal && !isCollapsed && (
        <DragHandle
          onMouseDown={handleDragHandleMouseDown}
          isDragging={isDragging}
        />
      )}

      {/* ================= Template Dialog ================= */}
      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={closeTemplateDialog}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
      />

      {/* ================= 下半部分：Logs & Progress ================= */}
      {!showTerminal && (
        <div className="flex-1 flex flex-col min-h-0 relative bg-gradient-to-b from-slate-100 to-slate-200/50 dark:from-slate-800 dark:to-slate-900/50 transition-colors duration-300">
          <ProgressBar progress={progress} isVisible={isRunning} />
          <LogDisplay
            logs={logs}
            logsRef={logsRef}
            onClear={clearLogs}
            onCopy={handleCopyLogs}
            onScroll={handleLogsScroll}
            isAutoScrollEnabled={isAutoScrollEnabled}
          />
        </div>
      )}

      {/* 拖拽时防止 iframe/文本选中的遮罩 */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-row-resize select-none" />
      )}
    </div>
  );
}

export default Home;
