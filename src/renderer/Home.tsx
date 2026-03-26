/**
 * Home - FFmpeg GUI 主界面（抽屉式日志版）
 *
 * 布局结构：
 * ┌─────────────────────────────────────────────┐
 * │  导航条：Logo · 模式切换 · 语言              │  固定，极简
 * ├─────────────────────────────────────────────┤
 * │  flex-1 滚动区                               │
 * │    模板 · 输入 · 输出                         │
 * │    命令框 + 内嵌运行按钮                      │
 * ├─────────────────────────────────────────────┤
 * │  ┌──── 抽屉 Tab 栏（常驻）───────────────┐  │
 * │  │ ● Console  [进度条] [47%] [■ Stop]   │  │  ← 始终可见
 * │  │                   [紧凑][标准][展开]  │  │
 * │  └───────────────────────────────────────┘  │
 * │  抽屉内容区（高度由 DrawerSize 控制）         │
 * └─────────────────────────────────────────────┘
 *
 * 状态简化：
 *   drawerSize: 'sm' | 'md' | 'lg'
 *   运行时自动 → 'lg'，结束还原 → 'md'
 *   彻底移除 isCollapsed / splitHeight / isDragging
 */

import {
  Loader2,
  Play,
  PlusCircle,
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
// 类型 & 常量
// ─────────────────────────────────────────────

import { CommandBox } from './components/CommandBox';
import { DrawerSize, DrawerTabBar } from './components/DrawerTabBar';

const DRAWER_HEIGHT: Record<DrawerSize, number> = {
  sm: 48,   // 仅 tab 栏可见，日志收起
  md: 260,  // 默认高度，约 8 行日志
  lg: 420,  // 运行时展开，约 14 行日志
};

const LS_DRAWER_KEY = 'ffmpeg-drawer-size-v1';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
  const [showTerminal, setShowTerminal] = useState(false);

  // ── 抽屉状态（替代原 isCollapsed + splitHeight + isDragging）──

  const [drawerSize, setDrawerSize] = useState<DrawerSize>(() => {
    try {
      const saved = localStorage.getItem(LS_DRAWER_KEY);
      return (saved as DrawerSize) ?? 'md';
    } catch {
      return 'md';
    }
  });
  // 运行前记住用户上次的尺寸，结束后还原
  const userDrawerSizeRef = useRef<DrawerSize>(drawerSize);

  const handleDrawerSizeChange = useCallback((sz: DrawerSize) => {
    setDrawerSize(sz);
    userDrawerSizeRef.current = sz;
    try { localStorage.setItem(LS_DRAWER_KEY, sz); } catch { /* ignore */ }
  }, []);

  // ── Hooks ──

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
    (message: string) => addLog('error', t(message)),
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

  // ── 运行时自动切换抽屉尺寸 ──

  const prevIsRunningRef = useRef(false);
  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = isRunning;

    if (!wasRunning && isRunning) {
      // 开始运行：记录当前尺寸，切到展开
      userDrawerSizeRef.current = drawerSize;
      setDrawerSize('lg');
    } else if (wasRunning && !isRunning) {
      // 运行结束：还原用户上次的尺寸
      setDrawerSize(userDrawerSizeRef.current);
    }
  }, [isRunning, drawerSize]);

  // ── 文件变化 → 更新命令路径 ──

  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
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
      const nextCmd =
        f || o ? updateCommandPaths(template.command, f, o) : template.command;
      const current = commandRef.current.trim();
      if (current && current !== nextCmd.trim()) {
        if (
          !window.confirm(
            t('Selecting a template will replace the current command. Continue?'),
          )
        )
          return;
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
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-hidden transition-colors duration-300">

      {/* ══════════════════════════════════════
          导航条
      ══════════════════════════════════════ */}
      <header className="flex-shrink-0 grid grid-cols-3 items-center px-6 pb-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm z-20">
        {/* 左：Logo */}
        <div className="flex items-center gap-3 justify-start">
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
        <div className="flex items-center justify-center gap-1 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl border border-slate-200/60 dark:border-slate-600/50 justify-self-center">
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

        {/* 右：语言 · Add Template */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={toggleLanguage}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-600/50 transition-all"
          >
            {language === 'en' ? '中文' : 'EN'}
          </button>

          {!showTerminal && (
            <button
              type="button"
              onClick={openNewTemplateDialog}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg border border-primary-200/60 dark:border-primary-700/30 transition-all hover:shadow-sm"
            >
              <PlusCircle size={14} />
              {t('Add Template')}
            </button>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════════
          主内容区：Terminal 模式 OR FFmpeg 模式
      ══════════════════════════════════════ */}
      {showTerminal ? (
        /* Terminal 模式：全屏占满 */
        <div className="flex-1 min-h-0 p-4 max-w-7xl mx-auto w-full">
          <Terminal />
        </div>
      ) : (
        /* FFmpeg 模式：控制区 + 抽屉 */
        <>
          {/* 控制区：flex-1 可滚动，运行时不折叠，始终可见 */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto w-full px-6 py-4 space-y-4">
              {/* 主操作行：模板 5 · 输入 4 · 输出 3 */}
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    {t('Template')}
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

          {/* ══════════════════════════════════════
              抽屉：Tab 栏（常驻）+ 内容区（高度受控）
          ══════════════════════════════════════ */}
          <div className="flex-shrink-0 flex flex-col">
            {/* Tab 栏：始终可见 */}
            <DrawerTabBar
              isRunning={isRunning}
              isStopping={isStopping}
              progress={progress}
              onStop={handleStop}
              onClearLogs={clearLogs}
              onCopyLogs={handleCopyLogs}
              drawerSize={drawerSize}
              onDrawerSizeChange={handleDrawerSizeChange}
              isAutoScrollEnabled={isAutoScrollEnabled}
            />

            {/* 日志内容区：高度由 drawerSize 控制，CSS transition 平滑 */}
            <div
              style={{
                height: DRAWER_HEIGHT[drawerSize],
                transition: 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
              }}
              className="bg-white dark:bg-slate-900"
            >
              <div
                ref={logsRef}
                role="log"
                aria-live="polite"
                aria-label="FFmpeg log output"
                onScroll={handleLogsScroll}
                className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent font-mono text-sm"
              >
                {logs.length > 0 ? (
                  <div
                    className="p-4"
                    dangerouslySetInnerHTML={{ __html: logs.join('') }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center pointer-events-none select-none">
                    <div className="relative mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center shadow-inner">
                        <TerminalIcon size={24} className="text-slate-400 dark:text-slate-500" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                        <Play size={8} className="text-white ml-0.5" />
                      </div>
                    </div>
                    <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">
                      {t('Ready to process...')}
                    </p>
                    <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">
                      {t('Select a template or enter a command to begin')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Template Dialog */}
      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={closeTemplateDialog}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
      />
    </div>
  );
}

export default Home;
