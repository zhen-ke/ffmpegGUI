/**
 * Home - FFmpeg GUI 主界面组件（重构版）
 * 使用模块化的 hooks 和组件构建
 */

import { Loader2, PlusCircle } from 'lucide-react';
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

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
  const [showTerminal, setShowTerminal] = useState(false);

  // ========== 使用自定义 Hooks ==========

  // 日志管理
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

  // 文件选择
  const {
    inputFile,
    outputFolder,
    handleSelectInputFile,
    handleSelectOutputFolder,
    clearInputFile,
    clearOutputFolder,
  } = useFileSelection({
    onError: handleOperationalError,
  });

  // 命令管理
  const {
    command,
    updateCommand,
    updateCommandWithPaths,
    handleDragOver,
    handleDrop,
    clearCommand,
    copyCommand,
  } = useCommandManager({ inputFile, outputFolder });

  // 模板管理
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
  } = useTemplateManager({
    onError: handleOperationalError,
  });

  const templateOptions = useMemo(
    () => [
      ...customTemplates.map(transformTemplate),
      ...commandTemplates.map(transformTemplate),
    ],
    [customTemplates, transformTemplate],
  );

  const selectedTemplate = useMemo(
    () =>
      templateOptions.find((template) => template.id === selectedTemplateId) ??
      null,
    [templateOptions, selectedTemplateId],
  );

  // FFmpeg 状态管理（onProgressUpdate 现在是可选的，无需传递空函数）
  const { isRunning, isStopping, progress, handleStart, handleStop } =
    useFFmpegState({
      onLog: addLog,
    });

  // ========== 组件逻辑 ==========

  /**
   * Toggle terminal visibility
   */
  const handleOpenTerminal = useCallback(() => {
    setShowTerminal((prev) => !prev);
  }, []);

  /**
   * 切换语言
   */
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

  /**
   * 追踪是否为首次渲染，避免初始化时错误触发路径更新
   */
  const isInitialRender = useRef(true);

  /**
   * 监听文件路径变化，自动更新命令中的路径
   * updateCommandWithPaths 内部会读取最新 command，避免循环依赖
   */
  useEffect(() => {
    // 跳过首次渲染，避免在没有 command 时错误触发
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    if (inputFile || outputFolder) {
      updateCommandWithPaths();
    }
  }, [inputFile, outputFolder, updateCommandWithPaths]);

  /**
   * 监听模板选择变化，更新命令
   * 模板变化时总是用模板的命令替换当前命令
   */
  const selectedTemplateCommand = selectedTemplate?.command;

  const applyTemplateCommand = useCallback(
    (templateCommand: string) => {
      const latestInputFile = inputFileRef.current;
      const latestOutputFolder = outputFolderRef.current;

      if (latestInputFile || latestOutputFolder) {
        updateCommandWithPaths(
          templateCommand,
          latestInputFile,
          latestOutputFolder,
        );
      } else {
        updateCommand(templateCommand);
      }
    },
    [updateCommand, updateCommandWithPaths],
  );

  useEffect(() => {
    if (!selectedTemplateId || !selectedTemplateCommand) {
      return;
    }

    applyTemplateCommand(selectedTemplateCommand);
  }, [applyTemplateCommand, selectedTemplateCommand, selectedTemplateId]);

  const handleTemplateSelectWithConfirm = useCallback(
    (template: DropdownOption) => {
      if (template.id === selectedTemplateIdRef.current) {
        return;
      }

      const latestInputFile = inputFileRef.current;
      const latestOutputFolder = outputFolderRef.current;
      const nextCommand =
        latestInputFile || latestOutputFolder
          ? updateCommandPaths(
              template.command,
              latestInputFile,
              latestOutputFolder,
            )
          : template.command;

      const currentCommand = commandRef.current.trim();
      if (currentCommand && currentCommand !== nextCommand.trim()) {
        const shouldReplace = window.confirm(
          t('Selecting a template will replace the current command. Continue?'),
        );
        if (!shouldReplace) {
          return;
        }
      }

      handleTemplateSelect(template);
    },
    [handleTemplateSelect, t],
  );

  /**
   * 处理 FFmpeg 启动
   */
  const onStart = useCallback(() => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      return;
    }

    clearLogs();
    handleStart(trimmedCommand);
  }, [clearLogs, handleStart, command]);

  const handleCopyCommand = useCallback(async () => {
    const result = await copyCommand();
    if (result === 'success') {
      addLog('success', t('Command copied to clipboard.'));
      return;
    }
    if (result === 'empty') {
      addLog('info', t('Nothing to copy.'));
      return;
    }
    addLog('error', t('Failed to copy command.'));
  }, [addLog, copyCommand, t]);

  const handleCopyLogs = useCallback(async () => {
    const result = await copyLogs();
    if (result === 'success') {
      addLog('success', t('Log copied to clipboard.'));
      return;
    }
    if (result === 'empty') {
      addLog('info', t('Nothing to copy.'));
      return;
    }
    addLog('error', t('Failed to copy logs.'));
  }, [addLog, copyLogs, t]);

  const handleDeleteTemplateWithConfirm = useCallback(
    (templateId: string) => {
      const shouldDelete = window.confirm(t('Delete this custom template?'));
      if (!shouldDelete) {
        return;
      }
      handleDeleteTemplate(templateId);
    },
    [handleDeleteTemplate, t],
  );

  const hasMultipleInputs = useMemo(
    () => countInputArguments(command) > 1,
    [command],
  );

  // ========== 渲染 ==========

  // 加载状态：FFmpeg 状态检查中
  if (ffmpegExists === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // 如果 FFmpeg 不存在，显示下载器
  if (!ffmpegExists) {
    return <FFmpegDownloader />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-sans">
      {/* ================= 上半部分：控制区 ================= */}
      <div
        className={`${showTerminal ? 'flex-1 flex flex-col min-h-0' : 'flex-shrink-0'} bg-white dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 shadow-sm z-20`}
      >
        <div
          className={`max-w-7xl mx-auto w-full px-4 ${showTerminal ? 'pt-8 pb-4 flex-1 flex flex-col min-h-0' : 'py-8'} space-y-4`}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {t('FFmpeg Tool')}
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => showTerminal && handleOpenTerminal()}
                    disabled={!showTerminal}
                    className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                      !showTerminal
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer'
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    FFmpeg
                  </button>
                  <button
                    type="button"
                    onClick={() => !showTerminal && handleOpenTerminal()}
                    disabled={showTerminal}
                    className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                      showTerminal
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer'
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {t('Terminal')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                >
                  {language === 'en' ? '中文' : 'EN'}
                </button>
              </div>
            </div>
            {!showTerminal && (
              <button
                type="button"
                onClick={openNewTemplateDialog}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                <PlusCircle size={16} className="mr-1.5" />
                {t('Add Template')}
              </button>
            )}
          </div>

          {/* Dropdown & File Inputs Grid */}
          {!showTerminal && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 模板选择 */}
              <div className="lg:col-span-4">
                <Dropdown
                  options={templateOptions}
                  onChange={handleTemplateSelectWithConfirm}
                  value={selectedTemplate}
                  placeholder={t('Select a template')}
                  onEdit={handleEditTemplate}
                  onDelete={handleDeleteTemplateWithConfirm}
                />
              </div>

              {/* 输入文件 */}
              <div className="lg:col-span-4">
                <FileSelector
                  type="input"
                  value={inputFile}
                  onSelect={handleSelectInputFile}
                  onClear={clearInputFile}
                  label={t('Select Input File')}
                />
              </div>

              {/* 输出文件夹 */}
              <div className="lg:col-span-4">
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

          {/* 模式切换：CommandInput+按钮 vs Terminal */}
          {showTerminal ? (
            <div className="flex-1 min-h-0 mt-2">
              <Terminal />
            </div>
          ) : (
            <>
              {/* Command Input Area */}
              <CommandInput
                command={command}
                onCommandChange={updateCommand}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onCopy={handleCopyCommand}
                onClear={clearCommand}
                placeholder={t(
                  'Enter FFmpeg command or drag & drop files here',
                )}
              />
              {hasMultipleInputs && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t(
                    'This command has multiple input files; only the first -i is auto-bound from the input selector.',
                  )}
                </p>
              )}

              {/* Main Action Buttons */}
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

      {/* Template Dialog */}
      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={closeTemplateDialog}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
      />

      {/* ================= 下半部分：Logs & Progress ================= */}
      {!showTerminal && (
        <div className="flex-1 flex flex-col min-h-0 relative bg-gray-100 dark:bg-black">
          {/* Progress Bar */}
          <ProgressBar progress={progress} isVisible={isRunning} />

          {/* Logs Terminal */}
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
    </div>
  );
}

export default Home;
