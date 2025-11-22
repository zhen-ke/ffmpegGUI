/**
 * Home - FFmpeg GUI 主界面组件（重构版）
 * 使用模块化的 hooks 和组件构建
 */

import { PlusCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Dropdown from './components/Dropdown';
import FFmpegDownloader from './components/FFmpegDownloader';
import { TemplateDialog } from './components/TemplateDialog';
import { commandTemplates } from './constants/commandTemplates';
import { useLanguage } from './LanguageContext';

// 导入自定义 hooks
import { useCommandManager } from './hooks/useCommandManager';
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

function App() {
  const { language, setLanguage, t } = useLanguage();
  const [ffmpegExists, setFfmpegExists] = useState<boolean | null>(null);

  // ========== 使用自定义 Hooks ==========

  // 日志管理
  const { logs, logsRef, addLog, clearLogs, copyLogs } = useLogs();

  // 文件选择
  const {
    inputFile,
    outputFolder,
    handleSelectInputFile,
    handleSelectOutputFolder,
    clearInputFile,
    clearOutputFolder,
  } = useFileSelection();

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
    selectedTemplate,
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
  } = useTemplateManager();

  // FFmpeg 状态管理
  const { isRunning, progress, handleStart, handleStop } = useFFmpegState({
    onLog: addLog,
    onProgressUpdate: () => {}, // 可以在这里添加额外的进度处理逻辑
  });

  // ========== 组件逻辑 ==========

  /**
   * 检查 FFmpeg 是否存在
   */
  const checkFFmpegStatus = async () => {
    const exists = await window.electron.ipcRenderer.invoke(
      'check-ffmpeg-status',
    );
    setFfmpegExists(exists);
  };

  /**
   * 打开终端
   */
  const handleOpenTerminal = async () => {
    try {
      await window.electron.ipcRenderer.invoke('open-terminal');
    } catch (error) {
      console.error('Failed to open terminal:', error);
    }
  };

  /**
   * 切换语言
   */
  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  /**
   * 处理文件选择并更新命令
   */
  const handleInputFileSelect = useCallback(async () => {
    await handleSelectInputFile((input, output) => {
      updateCommandWithPaths(command, input, output);
    });
  }, [handleSelectInputFile, command, updateCommandWithPaths]);

  const handleOutputFolderSelect = useCallback(async () => {
    await handleSelectOutputFolder((input, output) => {
      updateCommandWithPaths(command, input, output);
    });
  }, [handleSelectOutputFolder, command, updateCommandWithPaths]);

  /**
   * 处理模板选择
   */
  const onTemplateChange = useCallback(
    (template: any) => {
      handleTemplateSelect(template, (cmd) => {
        // 如果已经有输入输出路径，自动更新命令
        if (inputFile || outputFolder) {
          updateCommandWithPaths(cmd);
        } else {
          updateCommand(cmd);
        }
      });
    },
    [
      handleTemplateSelect,
      inputFile,
      outputFolder,
      updateCommandWithPaths,
      updateCommand,
    ],
  );

  /**
   * 处理 FFmpeg 启动
   */
  const onStart = useCallback(() => {
    clearLogs();
    handleStart(command);
  }, [clearLogs, handleStart, command]);

  // ========== 生命周期 ==========

  /**
   * 初始化 - 检查 FFmpeg 状态
   */
  useEffect(() => {
    checkFFmpegStatus();

    const removeFFmpegStatusListener = window.electron.ipcRenderer.on(
      'ffmpeg-status',
      (exists: any) => {
        setFfmpegExists(exists);
      },
    );

    return () => {
      removeFFmpegStatusListener();
    };
  }, []);

  // ========== 渲染 ==========

  // 如果 FFmpeg 不存在，显示下载器
  if (!ffmpegExists) {
    return <FFmpegDownloader />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-sans">
      {/* ================= 上半部分：控制区 ================= */}
      <div className="flex-shrink-0 bg-white dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 shadow-sm z-20">
        <div className="max-w-7xl mx-auto w-full px-4 py-8 space-y-4">
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
                FFmpeg Tool
              </h1>
              <button
                type="button"
                onClick={toggleLanguage}
                className="px-2 py-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
              >
                {language === 'en' ? '中文' : 'EN'}
              </button>
            </div>
            <button
              type="button"
              onClick={openNewTemplateDialog}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              <PlusCircle size={16} className="mr-1.5" />
              {t('Add Template')}
            </button>
          </div>

          {/* Dropdown & File Inputs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 模板选择 */}
            <div className="lg:col-span-4">
              <Dropdown
                options={[
                  ...customTemplates.map(transformTemplate),
                  ...commandTemplates.map(transformTemplate),
                ]}
                onChange={onTemplateChange}
                value={selectedTemplate}
                placeholder={t('Select a template')}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
              />
            </div>

            {/* 输入文件 */}
            <div className="lg:col-span-4">
              <FileSelector
                type="input"
                value={inputFile}
                onSelect={handleInputFileSelect}
                onClear={clearInputFile}
                label={t('Select Input File')}
              />
            </div>

            {/* 输出文件夹 */}
            <div className="lg:col-span-4">
              <FileSelector
                type="output"
                value={outputFolder}
                onSelect={handleOutputFolderSelect}
                onClear={clearOutputFolder}
                label={t('Select Output Folder')}
              />
            </div>
          </div>

          {/* Command Input Area */}
          <CommandInput
            command={command}
            onCommandChange={updateCommand}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onCopy={copyCommand}
            onClear={clearCommand}
            onOpenTerminal={handleOpenTerminal}
            placeholder={t('Enter FFmpeg command or drag & drop files here')}
          />

          {/* Main Action Buttons */}
          <ControlButtons
            isRunning={isRunning}
            canStart={!!command}
            onStart={onStart}
            onStop={handleStop}
            startLabel={t('Start')}
            stopLabel={t('Stop')}
          />
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
      <div className="flex-1 flex flex-col min-h-0 relative bg-gray-100 dark:bg-black">
        {/* Progress Bar */}
        <ProgressBar
          progress={progress}
          isVisible={isRunning && progress > 0}
        />

        {/* Logs Terminal */}
        <LogDisplay
          logs={logs}
          logsRef={logsRef}
          onClear={clearLogs}
          onCopy={copyLogs}
        />
      </div>
    </div>
  );
}

export default App;
