import { Upload } from 'lucide-react';
import { useCallback, useId, useRef } from 'react';
import FFmpegDownloader from './components/FFmpegDownloader';
import { TemplateDialog } from './components/TemplateDialog';
import { useLanguage } from './LanguageContext';

import { useCommandManager } from './hooks/useCommandManager';
import { useElectronIPC } from './hooks/useElectronIPC';
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

import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { useConfirmModal } from './hooks/useConfirmModal';
import { useWindowDragDrop } from './hooks/useWindowDragDrop';
import { useOnboardingGuide } from './hooks/useOnboardingGuide';
import { useTemplateSync } from './hooks/useTemplateSync';
import { useInputOutputSlots } from './hooks/useInputOutputSlots';
import { useResultCards } from './hooks/useResultCards';

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
  const isMac = window.electron.platform === 'darwin';

  const templateControlId = useId();
  const inputControlBaseId = useId();
  const outputControlId = useId();
  const commandControlId = useId();

  const { activePane, isCompact, expandDrawerRef, handleActivePaneChange } =
    useWorkspaceLayout();
  const { confirmState, openConfirm, closeConfirm } = useConfirmModal();

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
    handleStart,
    handleStop,
  } = useFFmpegState();

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

  const { isWindowDragActive, dragHandlers } = useWindowDragDrop({
    onFileDrop: handleDropInputAtIndex,
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
    handleActivePaneChange('activity');
    xtermClearRef.current?.();
    handleStart(cmd);
  }, [
    canStart,
    command,
    handleActivePaneChange,
    handleStart,
    setupReadiness.isSetupComplete,
  ]);

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
        } ${isMac ? 'bg-transparent' : 'bg-white/80 dark:bg-slate-800/80'}`}
      >
        <SetupPanel
          isCompact={isCompact}
          isMac={isMac}
          templateControlId={templateControlId}
          templateOptions={templateOptions}
          selectedTemplate={selectedTemplate}
          onTemplateChange={handleTemplateSelectWithConfirm}
          onEditTemplate={templateManager.handleEditTemplate}
          onDeleteTemplate={handleDeleteTemplateWithConfirm}
          onClearTemplate={handleTemplateClear}
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

        <main
          className={`flex-1 min-w-0 px-4 py-4 space-y-4 ${
            isCompact ? '' : 'overflow-y-auto'
          }`}
        >
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
        onConfirm={confirmState.isOpen ? confirmState.onConfirm : closeConfirm}
        onCancel={closeConfirm}
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
