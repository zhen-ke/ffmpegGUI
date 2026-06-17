/**
 * Home - FFmpeg GUI 主界面
 *
 * 改动历史：
 * 1. useFFmpegState 升级为状态机，isRunning/isStopping 由 deriveFFmpegFlags 派生
 * 2. 所有 window.confirm 替换为 <ConfirmModal>，Electron 内视觉一致
 * 3. 彻底移除 useLogs，系统提示统一写入 xterm（xtermWriteLogRef）
 * 4. FFmpegTerminal 始终挂载（visibility 控制），drawerSize=sm 不销毁 xterm
 * 5. header/drawer 拆分为 AppHeader / WorkspaceDrawer 组件
 * 6. 提取 useMediaProbe hook、MediaInfoCard、CompletedResultCard 组件
 * 7. isCommandDirty 改用 useState 确保正确响应模板注入
 * 8. Dropdown 支持清除选中模板，AppHeader 加入三步骤引导
 */

import { Upload } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import Dropdown, { type DropdownOption } from './components/Dropdown';
import FFmpegDownloader from './components/FFmpegDownloader';
import { TemplateDialog } from './components/TemplateDialog';
import { commandTemplates } from './constants/commandTemplates';
import { useLanguage } from './LanguageContext';

import { useCommandManager } from './hooks/useCommandManager';
import { useElectronIPC } from './hooks/useElectronIPC';
import { useFFmpegState } from './hooks/useFFmpegState';
import { useFileSelection } from './hooks/useFileSelection';
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys';
import { useMediaProbe } from './hooks/useMediaProbe';
import { useTemplateManager } from './hooks/useTemplateManager';

import { AppHeader } from './components/AppHeader';
import { CommandBox } from './components/CommandBox';
import { CompletedResultCard } from './components/CompletedResultCard';
import { ConfirmModal } from './components/ConfirmModal';
import { DrawerSize, type WorkspacePane } from './components/DrawerTabBar';
import { type TerminalLogType } from './components/FFmpegTerminal';
import { FileSelector } from './components/FileSelector';
import { MediaInfoCard } from './components/MediaInfoCard';
import { WorkspaceDrawer } from './components/WorkspaceDrawer';
import {
  buildOutputPreview,
  countInputArguments,
  parseInputArguments,
  parseOutputFileName,
  updateCommandPaths,
  updateInputArgument,
  updateOutputFileName,
} from './utils/commandUtils';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const LS_DRAWER_KEY = 'ffmpeg-drawer-size-v1';
const LS_WORKSPACE_PANE_KEY = 'ffmpeg-workspace-pane-v1';

// ─────────────────────────────────────────────
// ConfirmModal 状态类型
// ─────────────────────────────────────────────

type ConfirmState =
  | { isOpen: false }
  | {
      isOpen: true;
      title: string;
      description?: string;
      danger?: boolean;
      onConfirm: () => void;
    };

function getIndexedInputLabel(language: string, index: number): string {
  return language === 'zh' ? `输入 ${index + 1}` : `Input ${index + 1}`;
}

function getIndexedSelectLabel(language: string, index: number): string {
  return language === 'zh'
    ? `选择输入 ${index + 1}`
    : `Select Input ${index + 1}`;
}


function getPathDirectory(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\'),
  );
  return lastSlash > 0 ? filePath.slice(0, lastSlash) : filePath;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
  const isMac = window.electron.platform === 'darwin';
  const [activePane, setActivePane] = useState<WorkspacePane>(() => {
    try {
      return (
        (localStorage.getItem(LS_WORKSPACE_PANE_KEY) as WorkspacePane) ??
        'activity'
      );
    } catch {
      return 'activity';
    }
  });
  const templateControlId = useId();
  const inputControlBaseId = useId();
  const outputControlId = useId();
  const commandControlId = useId();

  // ── 抽屉状态 ──

  const [drawerSize, setDrawerSize] = useState<DrawerSize>(() => {
    try {
      return (localStorage.getItem(LS_DRAWER_KEY) as DrawerSize) ?? 'md';
    } catch {
      return 'md';
    }
  });
  const userDrawerSizeRef = useRef<DrawerSize>(drawerSize);

  const handleDrawerSizeChange = useCallback((sz: DrawerSize) => {
    setDrawerSize(sz);
    userDrawerSizeRef.current = sz;
    try {
      localStorage.setItem(LS_DRAWER_KEY, sz);
    } catch {
      /* ignore */
    }
  }, []);

  const handleActivePaneChange = useCallback((pane: WorkspacePane) => {
    setActivePane(pane);
    try {
      localStorage.setItem(LS_WORKSPACE_PANE_KEY, pane);
    } catch {
      /* ignore */
    }
    setDrawerSize((prev) => (prev === 'sm' ? 'md' : prev));
  }, []);

  const handleToggleDrawer = useCallback(() => {
    setDrawerSize((prev) => {
      if (prev === 'sm') {
        const restore =
          userDrawerSizeRef.current === 'sm' ? 'md' : userDrawerSizeRef.current;
        return restore;
      }
      userDrawerSizeRef.current = prev;
      return 'sm';
    });
  }, []);

  // ── 统一 ConfirmModal 状态（替代所有 window.confirm）──

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
  });
  const [isWindowDragActive, setIsWindowDragActive] = useState(false);
  const dragCounter = useRef(0);

  const openConfirm = useCallback(
    (
      title: string,
      onConfirm: () => void,
      opts?: { description?: string; danger?: boolean },
    ) => {
      setConfirmState({ isOpen: true, title, onConfirm, ...opts });
    },
    [],
  );

  const closeConfirm = useCallback(() => {
    setConfirmState({ isOpen: false });
  }, []);

  // ── xterm 命令式 API refs ──

  const xtermClearRef = useRef<(() => void) | null>(null);
  const xtermCopyRef = useRef<(() => string) | null>(null);
  const xtermWriteLogRef = useRef<
    ((type: TerminalLogType, message: string) => void) | null
  >(null);

  // ── 错误处理：写入 xterm ──

  const handleOperationalError = useCallback(
    (message: string) => {
      xtermWriteLogRef.current?.('error', t(message));
    },
    [t],
  );

  // ── 业务 Hooks ──

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
    updateCommand,
    updateCommandWithPaths,
    setCommand,
    handleDragOver,
    handleDrop,
    clearCommand,
    copyCommand,
  } = useCommandManager({ inputFiles, outputFolder });

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
    clearTemplateSelection,
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

  // FFmpeg 状态以 hook 的派生结果为单一真源，避免 UI 自己重复推导。
  const {
    canStart,
    canStop,
    isRunning,
    isStopping,
    lastCompletedOutputFile,
    lastStartedCommand,
    status,
    progress,
    handleStart,
    handleStop,
  } = useFFmpegState();

  // ── Refs for stale-closure safety ──

  const inputFilesRef = useRef(inputFiles);
  const outputFolderRef = useRef(outputFolder);
  const commandRef = useRef(command);
  const selectedTemplateIdRef = useRef<string | null>(selectedTemplateId);
  // lastAppliedCommand: 用 state 而非 ref，确保模板注入后 isCommandDirty 正确触发重算
  const [lastAppliedCommand, setLastAppliedCommand] = useState<string | null>(null);
  inputFilesRef.current = inputFiles;
  outputFolderRef.current = outputFolder;
  commandRef.current = command;
  selectedTemplateIdRef.current = selectedTemplateId;

  // ── 运行时自动切换抽屉尺寸 ──

  const prevIsRunningRef = useRef(false);
  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = isRunning;

    if (!wasRunning && isRunning) {
      userDrawerSizeRef.current = drawerSize;
      setDrawerSize('lg');
    } else if (wasRunning && !isRunning) {
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
    if (outputFolder) updateCommandWithPaths();
  }, [outputFolder, updateCommandWithPaths]);

  // ── 模板变化 → 更新命令 ──

  const selectedTemplateCommand = selectedTemplate?.command;
  const applyTemplateCommand = useCallback(
    (tplCmd: string) => {
      const currentInputs = inputFilesRef.current;
      const o = outputFolderRef.current;
      if (currentInputs.length > 0 || o) {
        // updateCommandWithPaths 内部调用 updateCommandPaths 再 setCommand
        // 同步计算期望值写入 state，确保 isCommandDirty 正确响应
        const expected = updateCommandPaths(tplCmd, currentInputs, o);
        setLastAppliedCommand(expected);
        updateCommandWithPaths(tplCmd, currentInputs, o);
      } else {
        setLastAppliedCommand(tplCmd);
        updateCommand(tplCmd);
      }
    },
    [updateCommand, updateCommandWithPaths, setLastAppliedCommand],
  );
  useEffect(() => {
    if (!selectedTemplateId || !selectedTemplateCommand) return;
    applyTemplateCommand(selectedTemplateCommand);
  }, [applyTemplateCommand, selectedTemplateCommand, selectedTemplateId]);

  // 清空模板选中时，重置 lastAppliedCommand
  useEffect(() => {
    if (!selectedTemplateId) {
      setLastAppliedCommand(null);
    }
  }, [selectedTemplateId]);

  // dirty：有模板被选中，且当前命令与最后一次模板注入的值不一致
  const isCommandDirty = useMemo(() => {
    if (!selectedTemplateId) return false;
    if (lastAppliedCommand === null) return false;
    return command.trim() !== lastAppliedCommand.trim();
  }, [command, selectedTemplateId, lastAppliedCommand]);

  // 重置：把命令恢复到模板的最后注入值
  const handleResetToTemplate = useCallback(() => {
    if (!selectedTemplateCommand) return;
    applyTemplateCommand(selectedTemplateCommand);
  }, [applyTemplateCommand, selectedTemplateCommand]);

  // 清除模板选中：同时清空命令和 lastAppliedCommand
  const handleTemplateClear = useCallback(() => {
    clearTemplateSelection();
    clearCommand();
  }, [clearTemplateSelection, clearCommand]);

  // ── 模板切换：直接替换命令 ──

  const handleTemplateSelectWithConfirm = useCallback(
    (template: DropdownOption) => {
      if (template.id === selectedTemplateIdRef.current) return;
      handleTemplateSelect(template);
    },
    [handleTemplateSelect],
  );

  // ── 模板删除：弹 ConfirmModal（danger 模式）──

  const handleDeleteTemplateWithConfirm = useCallback(
    (templateId: string) => {
      openConfirm(
        t('Delete this custom template?'),
        () => {
          handleDeleteTemplate(templateId);
          closeConfirm();
        },
        { danger: true },
      );
    },
    [handleDeleteTemplate, openConfirm, closeConfirm, t],
  );

  const inputSlotCount = useMemo(
    () => Math.max(1, countInputArguments(command), inputFiles.length),
    [command, inputFiles.length],
  );

  const inputArguments = useMemo(() => parseInputArguments(command), [command]);
  const outputFileName = useMemo(() => parseOutputFileName(command), [command]);
  const finalOutputPath = useMemo(
    () => buildOutputPreview(outputFolder, outputFileName),
    [outputFolder, outputFileName],
  );


  const inputSlots = useMemo(
    () =>
      Array.from({ length: inputSlotCount }, (_, index) => {
        const token = inputArguments[index] ?? '';
        const selectedValue =
          inputFiles[index] ||
          (/^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(token) ? token : '');
        const actionLabel =
          inputSlotCount === 1
            ? t('Select Input File')
            : getIndexedSelectLabel(language, index);
        const fieldLabel =
          inputSlotCount === 1
            ? t('Input File')
            : getIndexedInputLabel(language, index);
        const label =
          token && !selectedValue ? `${actionLabel} (${token})` : actionLabel;

        return {
          id: `${inputControlBaseId}-${index}`,
          index,
          label,
          fieldLabel,
          selectedValue,
        };
      }),
    [
      inputArguments,
      inputFiles,
      inputSlotCount,
      inputControlBaseId,
      language,
      t,
    ],
  );
  const primaryInputPath = inputSlots[0]?.selectedValue ?? '';

  const handleSelectInputAtIndex = useCallback(
    async (index: number) => {
      const filePath = await handleSelectInputFile(index);
      if (!filePath) return;

      setCommand((prev) => updateInputArgument(prev, index, filePath));
    },
    [handleSelectInputFile, setCommand],
  );

  const handleClearInputAtIndex = useCallback(
    (index: number) => {
      clearInputFile(index);
      setCommand((prev) => updateInputArgument(prev, index));
    },
    [clearInputFile, setCommand],
  );

  const handleDropInputAtIndex = useCallback(
    (filePath: string, index: number) => {
      handleInputFileDrop(filePath, index);
      setCommand((prev) => updateInputArgument(prev, index, filePath));
    },
    [handleInputFileDrop, setCommand],
  );

  const handleWindowDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsWindowDragActive(true);
    }
  }, []);

  const handleWindowDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsWindowDragActive(false);
    }
  }, []);

  const handleWindowDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleWindowDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsWindowDragActive(false);
      dragCounter.current = 0;

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        const file = files[0] as File & { path: string };
        if (file.path) {
          handleDropInputAtIndex(file.path, 0);
        }
      }
    },
    [handleDropInputAtIndex],
  );

  const handleOutputFileNameChange = useCallback(
    (value: string) => {
      setCommand((prev) =>
        updateOutputFileName(prev, value, outputFolderRef.current),
      );
    },
    [setCommand],
  );

  // ── 媒体探针（已提取到 useMediaProbe hook）──

  const { mediaInfo, isMediaInfoLoading, hasMediaInfoError, isMediaProbeAvailable } = useMediaProbe({
    primaryInputPath,
  });

  // ── 运行 ──

  const onStart = useCallback(() => {
    const cmd = command.trim();
    if (!cmd || !canStart) return;
    handleActivePaneChange('activity');
    xtermClearRef.current?.();
    handleStart(cmd);
  }, [canStart, command, handleActivePaneChange, handleStart]);

  // ── 停止：用 canStop 守卫（状态机保证） ──

  const onStop = useCallback(() => {
    if (!canStop) return;
    handleStop();
  }, [canStop, handleStop]);

  // ── 复制命令 ──

  const handleCopyCommand = useCallback(async () => {
    const r = await copyCommand();
    if (r === 'success')
      xtermWriteLogRef.current?.('success', t('Command copied to clipboard.'));
    else if (r === 'empty')
      xtermWriteLogRef.current?.('info', t('Nothing to copy.'));
    else xtermWriteLogRef.current?.('error', t('Failed to copy command.'));
  }, [copyCommand, t]);

  // ── 复制日志 ──

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
      xtermWriteLogRef.current?.('error', t('Failed to copy logs.'));
    }
  }, [t]);

  // ── 全局快捷键 ──

  useGlobalHotkeys({
    onStart,
    onCopyCommand: handleCopyCommand,
    onClearLogs: () => xtermClearRef.current?.(),
  });

  const hasMultipleInputs = useMemo(
    () => countInputArguments(command) > 1,
    [command],
  );
  const hasCommand = command.trim().length > 0;
  const currentCommand = command.trim();
  const completedOutputFolder = lastCompletedOutputFile
    ? getPathDirectory(lastCompletedOutputFile)
    : '';
  const showCompletedResult =
    status === 'done' && !!lastCompletedOutputFile;

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  }, [language, setLanguage]);

  const openShellPane = useCallback(() => {
    handleActivePaneChange('terminal');
  }, [handleActivePaneChange]);

  const openActivityPane = useCallback(() => {
    handleActivePaneChange('activity');
  }, [handleActivePaneChange]);

  const handleOpenCompletedFile = useCallback(async () => {
    if (!lastCompletedOutputFile) return;

    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'open-output-file',
        lastCompletedOutputFile,
      )) as { success: boolean; error?: string };

      if (!result?.success) {
        xtermWriteLogRef.current?.('error', t('Failed to open output file.'));
      }
    } catch {
      xtermWriteLogRef.current?.('error', t('Failed to open output file.'));
    }
  }, [lastCompletedOutputFile, t]);

  const handleOpenCompletedFolder = useCallback(async () => {
    if (!lastCompletedOutputFile) return;

    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'open-output-folder',
        lastCompletedOutputFile,
      )) as { success: boolean; error?: string };

      if (!result?.success) {
        xtermWriteLogRef.current?.('error', t('Failed to open output folder.'));
      }
    } catch {
      xtermWriteLogRef.current?.('error', t('Failed to open output folder.'));
    }
  }, [lastCompletedOutputFile, t]);

  // ── 派生展示状态 ──

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
  } else if (canStart && hasCommand) {
    workflowLabel = t('Ready');
    workflowTone =
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/60';
  }

  // commandSource: 传给 CommandBox 的来源元数据
  const commandSource = useMemo(() => {
    if (!selectedTemplate) return null;
    return {
      label: selectedTemplate.name,
      isDirty: isCommandDirty,
    };
  }, [selectedTemplate, isCommandDirty]);

  let commandSourceLabel = t('No template selected');
  if (selectedTemplate) {
    commandSourceLabel = isCommandDirty
      ? t('Modified (from template)')
      : t('Working from template');
  } else if (hasCommand) {
    commandSourceLabel = t('Custom command');
  }

  // ── 加载态 ──

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

  // ─────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────

  return (
    <div
      onDragEnter={handleWindowDragEnter}
      onDragLeave={handleWindowDragLeave}
      onDragOver={handleWindowDragOver}
      onDrop={handleWindowDrop}
      className="h-full flex flex-col mac-vibrant-bg overflow-hidden relative transition-colors duration-300 motion-reduce:transition-none"
    >
      {/* ══ 导航条 ══ */}
      <AppHeader
        language={language}
        toggleLanguage={toggleLanguage}
        activePane={activePane}
        openActivityPane={openActivityPane}
        openShellPane={openShellPane}
        openNewTemplateDialog={openNewTemplateDialog}
        workflowLabel={workflowLabel}
        workflowTone={workflowTone}
        commandSourceLabel={commandSourceLabel}
        hasCommand={hasCommand}
        hasInputFile={!!inputFiles[0]}
        isRunning={isRunning}
      />

      {/* ══ 主内容区 ══ */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto backdrop-blur-sm ${
          isMac ? 'bg-transparent' : 'bg-white/80 dark:bg-slate-800/80'
        }`}
      >
        <div className="max-w-7xl mx-auto w-full px-6 py-4 space-y-4">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div
              className={`${inputSlotCount === 1 ? 'col-span-4' : 'col-span-6'} min-w-0`}
            >
              <label
                htmlFor={templateControlId}
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5"
              >
                {t('Template')}
              </label>
              <Dropdown
                id={templateControlId}
                options={templateOptions}
                onChange={handleTemplateSelectWithConfirm}
                value={selectedTemplate}
                placeholder={t('Select a template')}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplateWithConfirm}
                onClear={handleTemplateClear}
              />
            </div>
            {inputSlotCount === 1 && (
              <div className="col-span-4 min-w-0">
                <label
                  htmlFor={inputSlots[0].id}
                  className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  {inputSlots[0].fieldLabel}
                </label>
                <FileSelector
                  id={inputSlots[0].id}
                  type="input"
                  value={inputSlots[0].selectedValue}
                  onSelect={() => handleSelectInputAtIndex(0)}
                  onClear={() => handleClearInputAtIndex(0)}
                  onDrop={(path) => handleDropInputAtIndex(path, 0)}
                  label={inputSlots[0].label}
                />
              </div>
            )}
            <div
              className={`${inputSlotCount === 1 ? 'col-span-4' : 'col-span-6'} min-w-0`}
            >
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
                onSelect={handleSelectOutputFolder}
                onClear={clearOutputFolder}
                onDrop={handleOutputFolderDrop}
                label={t('Select Output Folder')}
              />
            </div>
          </div>

          {inputSlotCount > 1 && (
            <div className="grid grid-cols-12 gap-3 items-end">
              {inputSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={`min-w-0 ${
                    inputSlotCount === 2 ? 'col-span-6' : 'col-span-4'
                  }`}
                >
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
                    onSelect={() => handleSelectInputAtIndex(slot.index)}
                    onClear={() => handleClearInputAtIndex(slot.index)}
                    onDrop={(path) => handleDropInputAtIndex(path, slot.index)}
                    label={slot.label}
                  />
                </div>
              ))}
            </div>
          )}

          {isMediaProbeAvailable === true && primaryInputPath && (
            <MediaInfoCard
              mediaInfo={mediaInfo}
              isLoading={isMediaInfoLoading}
              hasError={hasMediaInfoError}
              primaryInputPath={primaryInputPath}
            />
          )}

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5 min-w-0">
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
                onChange={(event) =>
                  handleOutputFileNameChange(event.target.value)
                }
                spellCheck={false}
                className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="col-span-7 min-w-0">
              <p className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {t('Final Output Path')}
              </p>
              <div className="h-10 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 flex items-center">
                <span
                  className="truncate text-sm text-slate-600 dark:text-slate-300 font-mono"
                  title={finalOutputPath}
                >
                  {finalOutputPath}
                </span>
              </div>
            </div>
          </div>

          {showCompletedResult && (
            <CompletedResultCard
              lastCompletedOutputFile={lastCompletedOutputFile}
              completedOutputFolder={completedOutputFolder}
              canStart={canStart}
              currentCommand={currentCommand}
              onOpenFile={handleOpenCompletedFile}
              onOpenFolder={handleOpenCompletedFolder}
              onRunAgain={onStart}
            />
          )}

          <CommandBox
            id={commandControlId}
            canStart={canStart && command.trim().length > 0}
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
            commandSource={commandSource}
            onReset={handleResetToTemplate}
          />
        </div>
      </div>

      {/* ══ 抽屉 ══ */}
      <WorkspaceDrawer
        activePane={activePane}
        onActivePaneChange={handleActivePaneChange}
        drawerSize={drawerSize}
        onDrawerSizeChange={handleDrawerSizeChange}
        onToggleDrawer={handleToggleDrawer}
        canStop={canStop}
        isRunning={isRunning}
        isStopping={isStopping}
        progress={progress}
        onStop={onStop}
        onCopyLogs={handleCopyLogs}
        xtermClearRef={xtermClearRef}
        xtermCopyRef={xtermCopyRef}
        xtermWriteLogRef={xtermWriteLogRef}
        t={t}
      />

      {/* ══ ConfirmModal（替代所有 window.confirm）══ */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.isOpen ? confirmState.title : ''}
        description={confirmState.isOpen ? confirmState.description : undefined}
        danger={confirmState.isOpen ? confirmState.danger : undefined}
        onConfirm={confirmState.isOpen ? confirmState.onConfirm : closeConfirm}
        onCancel={closeConfirm}
      />

      {/* ══ Template Dialog ══ */}
      <TemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={closeTemplateDialog}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
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
