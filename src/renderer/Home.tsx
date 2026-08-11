import { Upload } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import type React from 'react';
import FFmpegDownloader from './components/FFmpegDownloader';
import { TemplateDialog } from './components/TemplateDialog';
import { useLanguage } from './LanguageContext';

import { useCommandManager } from './hooks/useCommandManager';
import { useElectronIPC } from './hooks/useElectronIPC';
import { useHardwareEncoders } from './hooks/useHardwareEncoders';
import { useFFmpegState } from './hooks/useFFmpegState';
import { useFileSelection } from './hooks/useFileSelection';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { useMediaProbe } from './hooks/useMediaProbe';
import { useTemplateManager } from './hooks/useTemplateManager';
import { useToast } from './hooks/useToast';

import { AppHeader } from './components/AppHeader';
import { CommandBox } from './components/CommandBox';
import { CompletedResultCard } from './components/CompletedResultCard';
import { FailedResultCard } from './components/FailedResultCard';
import { ToastContainer } from './components/ToastContainer';
import { ConfirmModal } from './components/ConfirmModal';
import { type TerminalLogType } from './components/FFmpegTerminal';
import { MediaInfoCard } from './components/MediaInfoCard';
import { PipelineStrip } from './components/PipelineStrip';
import SetupPanel from './components/SetupPanel';
import { WorkspaceDrawer } from './components/WorkspaceDrawer';
import RunningBar from './components/RunningBar';
import StalledBanner from './components/StalledBanner';

import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { useRunState } from './hooks/useRunState';
import { useConfirmModal } from './hooks/useConfirmModal';
import { useWindowDragDrop } from './hooks/useWindowDragDrop';
import { useOnboardingGuide } from './hooks/useOnboardingGuide';
import { useTemplateSync } from './hooks/useTemplateSync';
import { useInputOutputSlots } from './hooks/useInputOutputSlots';
import { useResultCards } from './hooks/useResultCards';
import { useLocalStorage } from './hooks/useLocalStorage';

/**
 * 拖入文件按扩展名 → 自动匹配的模板命令。
 * 仅收录「语义确定」的转换：扩展名能直接推导出目标格式。
 */
const DROP_MATCH_BY_EXT: Record<string, string> = {
  // 视频 → 常见容器/编码
  mp4: '-i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
  mkv: '-i input.mkv -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
  avi: '-i input.avi -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
  mov: '-i input.mov -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
  webm: '-i input.webm -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4',
  // 音频 → 提取/转 MP3
  mp3: '-i input.mp3 -vn -c:a libmp3lame -b:a 192k output.mp3',
  flac: '-i input.flac -c:a libmp3lame -ar 44100 -ab 192k output.mp3',
  wav: '-i input.wav -c:a libmp3lame -ar 44100 -ab 192k output.mp3',
  m4a: '-i input.m4a -c:a libmp3lame -ar 44100 -ab 192k output.mp3',
  ogg: '-i input.ogg -c:a libmp3lame -ar 44100 -ab 192k output.mp3',
  // 图片 → GIF / 视频
  gif: '-i input.gif -c:v libx264 -pix_fmt yuv420p -movflags +faststart output.mp4',
};

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
  const { availableEncoders, isLoaded: encodersLoaded } = useHardwareEncoders();
  const isMac = window.electron.platform === 'darwin';

  const templateControlId = useId();
  const inputControlBaseId = useId();
  const outputControlId = useId();
  const commandControlId = useId();
  // 用于从 CommandBox 的「浏览全部模板」触发左侧模板下拉打开
  const [templateOpenSignal, setTemplateOpenSignal] = useState(0);

  const { activePane, isCompact, expandDrawerRef, handleActivePaneChange } =
    useWorkspaceLayout();
  const { confirmState, openConfirm, closeConfirm } = useConfirmModal();

  // 左栏宽度（可拖拽调宽，持久化）
  const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>(
    'ffmpeg-sidebar-width-v1',
    300,
    {
      serialize: String,
      deserialize: (raw) => Math.max(240, Number(raw) || 300),
    },
  );
  const handleSidebarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = sidebarWidth;
      const onMove = (ev: PointerEvent) => {
        setSidebarWidth(
          Math.max(240, Math.min(480, startW + (ev.clientX - startX))),
        );
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [setSidebarWidth, sidebarWidth],
  );

  const startButtonRef = useRef<HTMLButtonElement>(null);
  const { toasts, pushToast, dismissToast } = useToast();

  const xtermClearRef = useRef<(() => void) | null>(null);
  const xtermCopyRef = useRef<(() => string) | null>(null);
  const xtermWriteLogRef = useRef<
    ((type: TerminalLogType, message: string) => void) | null
  >(null);

  const handleOperationalError = useCallback(
    (message: string) => {
      const translated = t(message);
      xtermWriteLogRef.current?.('error', translated);
      pushToast('error', translated);
    },
    [pushToast, t],
  );

  const {
    inputFiles,
    outputFolder,
    handleSelectInputFile,
    handleSelectOutputFolder,
    clearInputFile,
    clearOutputFolder,
    handleInputFileDrop,
    handleOutputFolderDrop,
  } = useFileSelection({ onError: handleOperationalError });

  const {
    command,
    lastAppliedCommand,
    updateCommand,
    updateCommandWithPaths,
    applyTemplateCommand,
    setCommand,
    handleDragOver,
    handleDrop,
    clearCommand,
    copyCommand,
  } = useCommandManager({ inputFiles, outputFolder });

  const templateManager = useTemplateManager({
    onError: handleOperationalError,
  });

  const {
    canStart,
    canStop,
    isRunning,
    isStopping,
    lastCompletedOutputFile,
    status,
    stalledForMs,
    handleStart,
    handleStop,
    handleResumeStalled,
  } = useFFmpegState();

  const runState = useRunState(status);

  const {
    templateOptions,
    selectedTemplate,
    commandSource,
    commandSourceLabel,
    handleTemplateSelectWithConfirm,
    handleDeleteTemplateWithConfirm,
    handleTemplateClear,
    handleResetToTemplate,
  } = useTemplateSync({
    templateManager,
    command,
    lastAppliedCommand,
    applyTemplateCommand,
    updateCommandWithPaths,
    clearCommand,
    outputFolder,
    openConfirm,
    closeConfirm,
    t,
  });

  const {
    showCompletedResult,
    setShowCompletedResult,
    showFailedResult,
    setShowFailedResult,
    completedOutputFolder,
    handleViewLogs,
    handleOpenCompletedFile,
    handleOpenCompletedFolder,
  } = useResultCards({
    status,
    lastCompletedOutputFile,
    handleActivePaneChange,
    expandDrawerRef,
    pushToast,
    handleOperationalError,
    t,
  });

  // 卡死检测提示改为非模态横幅（StalledBanner）：原确认框把 Esc / 点遮罩
  // 映射到取消（= 停止任务），用户想"关掉提示"会误终止转码。横幅只提供
  // 显式按钮（继续等待 / 停止任务），无遮罩、不打断操作。

  const {
    inputSlots,
    primaryInputPath,
    outputFileName,
    finalOutputPath,
    setupReadiness,
    isReadyToRun,
    setupBlockerMessage,
    hasMultipleInputs,
    handleSelectInputAtIndex,
    handleClearInputAtIndex,
    handleDropInputAtIndex,
    handleOutputFileNameChange,
    handleCopyOutputPath,
    handleSelectPipelineStep,
  } = useInputOutputSlots({
    command,
    setCommand,
    inputFiles,
    outputFolder,
    handleSelectInputFile,
    clearInputFile,
    handleInputFileDrop,
    canStart,
    language,
    t,
    pushToast,
    inputControlBaseId,
    outputControlId,
    commandControlId,
  });

  // 拖入文件时按扩展名自动匹配模板；匹配成功则应用模板 + 绑定输入，返回 true。
  // 命令非空时直接覆盖会丢失当前命令，先弹确认框；取消则仅将文件添加为输入。
  const handleMatchTemplateForDrop = useCallback(
    (filePath: string): boolean => {
      const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
      const templateCommand = DROP_MATCH_BY_EXT[ext];
      if (!templateCommand) return false;

      const applyDropTemplate = () => {
        // 先写入输入文件（触发 inputFiles 状态 + 输出目录自动联动）
        handleDropInputAtIndex(filePath, 0);
        // 用匹配的模板命令重写 command，并绑定真实输入/输出路径
        updateCommandWithPaths(templateCommand, [filePath], outputFolder);
      };

      // 命令为空：全新开始，直接应用模板（无覆盖风险）
      if (command.trim().length === 0) {
        applyDropTemplate();
        return true;
      }

      // 命令非空：套模板会覆盖当前命令，先征求用户确认
      openConfirm(t('Apply drop template?'), applyDropTemplate, {
        description: t('Drop template will replace the current command.'),
        confirmLabel: t('Apply template'),
        cancelLabel: t('Just add input'),
        onCancel: () => handleDropInputAtIndex(filePath, 0),
      });
      return true;
    },
    [
      command,
      handleDropInputAtIndex,
      openConfirm,
      outputFolder,
      updateCommandWithPaths,
      t,
    ],
  );

  const { isWindowDragActive, dragHandlers } = useWindowDragDrop({
    onFileDrop: handleDropInputAtIndex,
    onMatchTemplate: handleMatchTemplateForDrop,
  });

  const { showOnboardingGuide, dismissGuide, handleGuideStepClick } =
    useOnboardingGuide({
      status,
      templateControlId,
      inputControlBaseId,
      outputControlId,
      startButtonRef,
    });

  const {
    mediaInfo,
    isMediaInfoLoading,
    hasMediaInfoError,
    isMediaProbeAvailable,
  } = useMediaProbe({
    primaryInputPath,
  });

  const onStart = useCallback(() => {
    const cmd = command.trim();
    if (!cmd || !canStart || !setupReadiness.isSetupComplete) return;
    // 不再自动展开抽屉/切换 pane——执行时用户不想看日志就不弹，
    // 状态由标签栏圆点提示（running 脉冲 / success 绿 / error 红）。
    xtermClearRef.current?.();
    handleStart(cmd);
  }, [canStart, command, handleStart, setupReadiness.isSetupComplete]);

  const onStop = useCallback(() => {
    if (!canStop) return;
    handleStop();
  }, [canStop, handleStop]);

  const handleCopyCommand = useCallback(async () => {
    const r = await copyCommand();
    if (r === 'success')
      xtermWriteLogRef.current?.('success', t('Command copied to clipboard.'));
    else if (r === 'empty')
      xtermWriteLogRef.current?.('info', t('Nothing to copy.'));
    else handleOperationalError('Failed to copy command.');
  }, [copyCommand, handleOperationalError, t]);

  const handleCopyLogs = useCallback(async () => {
    const getText = xtermCopyRef.current;
    if (!getText) return;
    const text = getText();
    if (!text.trim()) {
      xtermWriteLogRef.current?.('info', t('Nothing to copy.'));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      xtermWriteLogRef.current?.('success', t('Log copied to clipboard.'));
    } catch {
      handleOperationalError('Failed to copy logs.');
    }
  }, [handleOperationalError, t]);

  const handleSelectPreset = useCallback(
    (presetCmd: string, label: string) => {
      // 根据命令内容找到对应的内置模板，同步模板下拉选中状态
      const matchingTemplate = templateOptions.find(
        (tpl) => tpl.command === presetCmd,
      );
      if (matchingTemplate) {
        handleTemplateSelectWithConfirm(matchingTemplate);
      } else {
        updateCommand(presetCmd);
      }
      pushToast('info', `${t('Applied preset')}: ${label}`);
    },
    [
      templateOptions,
      handleTemplateSelectWithConfirm,
      updateCommand,
      pushToast,
      t,
    ],
  );

  useGlobalHotkeys({
    onStart,
    onCopyCommand: handleCopyCommand,
    onClearLogs: () => xtermClearRef.current?.(),
  });

  const hasCommand = command.trim().length > 0;
  const currentCommand = command.trim();

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  }, [language, setLanguage]);

  let workflowLabel = t('Needs Setup');
  let workflowTone =
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600';

  if (status === 'stopping') {
    workflowLabel = t('Stopping...');
    workflowTone =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60';
  } else if (status === 'running') {
    workflowLabel = t('Running');
    workflowTone =
      'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-200 dark:border-primary-800/60';
  } else if (status === 'error') {
    workflowLabel = t('Failed');
    workflowTone =
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/60';
  } else if (isReadyToRun) {
    workflowLabel = t('Ready');
    workflowTone =
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/60';
  } else if (setupReadiness.blocker === 'command') {
    workflowLabel = t('Missing command');
    workflowTone =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60';
  } else if (setupReadiness.blocker === 'input') {
    workflowLabel = t('Missing input');
    workflowTone =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60';
  } else if (
    setupReadiness.blocker === 'outputFolder' ||
    setupReadiness.blocker === 'outputName'
  ) {
    workflowLabel = t('Missing output');
    workflowTone =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60';
  }

  if (ffmpegExists === null) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 dark:border-primary-900/50 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 animate-spin rounded-full border-4 border-transparent border-t-primary-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {t('Loading…')}
          </p>
        </div>
      </div>
    );
  }

  if (!ffmpegExists) return <FFmpegDownloader />;

  return (
    <div
      {...dragHandlers}
      className="h-full flex flex-col mac-vibrant-bg overflow-hidden relative transition-colors duration-300 motion-reduce:transition-none"
    >
      <AppHeader
        language={language}
        toggleLanguage={toggleLanguage}
        openNewTemplateDialog={templateManager.openNewTemplateDialog}
        workflowLabel={workflowLabel}
        workflowTone={workflowTone}
        commandSourceLabel={commandSourceLabel}
        hasCommand={hasCommand}
        hasInputFile={setupReadiness.hasInput}
        hasOutputReady={
          setupReadiness.hasOutputFolder && setupReadiness.hasOutputName
        }
        isReadyToRun={isReadyToRun}
        isRunning={isRunning}
        showOnboardingGuide={showOnboardingGuide}
        onDismissGuide={dismissGuide}
        onGuideStepClick={handleGuideStepClick}
      />

      <div
        className={`flex-1 min-h-0 flex backdrop-blur-sm ${
          isCompact ? 'flex-col overflow-y-auto' : 'flex-row'
        } ${isMac ? 'bg-transparent' : 'bg-white/80 dark:bg-slate-900/80'}`}
      >
        <SetupPanel
          isCompact={isCompact}
          isMac={isMac}
          sidebarWidth={sidebarWidth}
          templateControlId={templateControlId}
          templateOptions={templateOptions}
          selectedTemplate={selectedTemplate}
          onTemplateChange={handleTemplateSelectWithConfirm}
          onEditTemplate={templateManager.handleEditTemplate}
          onDeleteTemplate={handleDeleteTemplateWithConfirm}
          onClearTemplate={handleTemplateClear}
          templateOpenSignal={templateOpenSignal}
          availableEncoders={availableEncoders}
          encodersLoaded={encodersLoaded}
          inputSlots={inputSlots}
          onSelectInput={handleSelectInputAtIndex}
          onClearInput={handleClearInputAtIndex}
          onDropInput={handleDropInputAtIndex}
          outputControlId={outputControlId}
          outputFolder={outputFolder}
          onSelectOutputFolder={handleSelectOutputFolder}
          onClearOutputFolder={clearOutputFolder}
          onDropOutputFolder={handleOutputFolderDrop}
          outputFileName={outputFileName}
          onOutputFileNameChange={handleOutputFileNameChange}
          finalOutputPath={finalOutputPath}
          onCopyOutputPath={handleCopyOutputPath}
          startButtonRef={startButtonRef}
          isRunning={isRunning}
          isStopping={isStopping}
          canStop={canStop}
          isReadyToRun={isReadyToRun}
          onStart={onStart}
          onStop={onStop}
          setupBlockerMessage={setupBlockerMessage}
        />

        {!isCompact && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={handleSidebarPointerDown}
            className="w-1 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary-500/30 active:bg-primary-500/40 transition-colors duration-150"
          />
        )}

        <main
          className={`flex-1 min-w-0 px-4 py-4 space-y-4 ${
            isCompact ? '' : 'overflow-y-auto'
          }`}
        >
          <RunningBar
            isRunning={isRunning}
            isStopping={isStopping}
            canStop={canStop}
            onStop={onStop}
          />

          {stalledForMs !== null && status === 'running' && (
            <StalledBanner
              stalledForMs={stalledForMs}
              isStopping={isStopping}
              canStop={canStop}
              onResume={handleResumeStalled}
              onStop={handleStop}
            />
          )}

          <CommandBox
            id={commandControlId}
            command={command}
            onCommandChange={updateCommand}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onCopy={handleCopyCommand}
            onClear={clearCommand}
            isReadyToRun={isReadyToRun}
            placeholder={t('Enter FFmpeg command or drag & drop files here')}
            hasMultipleInputs={hasMultipleInputs}
            commandSource={commandSource}
            onReset={handleResetToTemplate}
            onSelectPreset={handleSelectPreset}
            onBrowseTemplates={() => setTemplateOpenSignal((n) => n + 1)}
          />

          <PipelineStrip
            inputFiles={inputFiles}
            command={command}
            finalOutputPath={finalOutputPath}
            templateName={selectedTemplate?.name}
            onSelectStep={handleSelectPipelineStep}
          />

          {isMediaProbeAvailable === true && primaryInputPath && (
            <MediaInfoCard
              mediaInfo={mediaInfo}
              isLoading={isMediaInfoLoading}
              hasError={hasMediaInfoError}
              primaryInputPath={primaryInputPath}
            />
          )}

          {showCompletedResult && (
            <CompletedResultCard
              lastCompletedOutputFile={lastCompletedOutputFile}
              completedOutputFolder={completedOutputFolder}
              canStart={canStart}
              currentCommand={currentCommand}
              onOpenFile={handleOpenCompletedFile}
              onOpenFolder={handleOpenCompletedFolder}
              onRunAgain={onStart}
              onDismiss={() => setShowCompletedResult(false)}
            />
          )}

          {showFailedResult && (
            <FailedResultCard
              onViewLogs={handleViewLogs}
              onTryAgain={onStart}
              canRetry={isReadyToRun}
              onDismiss={() => setShowFailedResult(false)}
            />
          )}
        </main>
      </div>

      <WorkspaceDrawer
        activePane={activePane}
        onActivePaneChange={handleActivePaneChange}
        canStop={canStop}
        isRunning={isRunning}
        isStopping={isStopping}
        runState={runState}
        onStop={onStop}
        onCopyLogs={handleCopyLogs}
        xtermClearRef={xtermClearRef}
        xtermCopyRef={xtermCopyRef}
        xtermWriteLogRef={xtermWriteLogRef}
        onExpandRef={expandDrawerRef}
        t={t}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.isOpen ? confirmState.title : ''}
        description={confirmState.isOpen ? confirmState.description : undefined}
        danger={confirmState.isOpen ? confirmState.danger : undefined}
        confirmLabel={
          confirmState.isOpen ? confirmState.confirmLabel : undefined
        }
        cancelLabel={confirmState.isOpen ? confirmState.cancelLabel : undefined}
        onConfirm={confirmState.isOpen ? confirmState.onConfirm : closeConfirm}
        onCancel={
          confirmState.isOpen
            ? (confirmState.onCancel ?? closeConfirm)
            : closeConfirm
        }
      />

      <TemplateDialog
        isOpen={templateManager.isTemplateDialogOpen}
        onClose={templateManager.closeTemplateDialog}
        onSave={templateManager.handleSaveTemplate}
        initialTemplate={templateManager.editingTemplate}
      />

      {isWindowDragActive && (
        <div className="absolute inset-0 bg-primary-500/10 dark:bg-primary-500/5 backdrop-blur-md border-4 border-dashed border-primary-500 z-[9999] flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
          <div className="bg-white dark:bg-slate-800 px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 border border-slate-200 dark:border-slate-700">
            <Upload size={32} className="text-primary-500 animate-bounce" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {t('Drop to inspect or convert')}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {t('File will be assigned as Input 1')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
