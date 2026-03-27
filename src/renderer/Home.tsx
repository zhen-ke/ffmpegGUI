/**
 * Home - FFmpeg GUI 主界面（最优解重构版）
 *
 * 改动要点：
 * 1. useFFmpegState 升级为状态机，isRunning/isStopping 由 deriveFFmpegFlags 派生
 * 2. 所有 window.confirm 替换为 <ConfirmModal>，Electron 内视觉一致
 * 3. 彻底移除 useLogs，系统提示统一写入 xterm（xtermWriteLogRef）
 * 4. FFmpegTerminal 始终挂载（visibility 控制），drawerSize=sm 不销毁 xterm
 * 5. header/drawer 拆分为 AppHeader / WorkspaceDrawer 组件
 */

import { Loader2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
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
import { useTemplateManager } from './hooks/useTemplateManager';

import { AppHeader } from './components/AppHeader';
import { CommandBox } from './components/CommandBox';
import { ConfirmModal } from './components/ConfirmModal';
import { DrawerSize, type WorkspacePane } from './components/DrawerTabBar';
import { type TerminalLogType } from './components/FFmpegTerminal';
import { FileSelector } from './components/FileSelector';
import { WorkspaceDrawer } from './components/WorkspaceDrawer';
import { countInputArguments, updateCommandPaths } from './utils/commandUtils';

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

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

function Home() {
  const { language, setLanguage, t } = useLanguage();
  const { ffmpegExists } = useElectronIPC();
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
  const inputControlId = useId();
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

  // ── 统一 ConfirmModal 状态（替代所有 window.confirm）──

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
  });

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

  // FFmpeg 状态以 hook 的派生结果为单一真源，避免 UI 自己重复推导。
  const {
    canStart,
    canStop,
    isRunning,
    isStopping,
    status,
    progress,
    handleStart,
    handleStop,
  } = useFFmpegState();

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

  // ── 模板切换：有改动时弹 ConfirmModal ──

  const handleTemplateSelectWithConfirm = useCallback(
    (template: DropdownOption) => {
      if (template.id === selectedTemplateIdRef.current) return;

      const f = inputFileRef.current;
      const o = outputFolderRef.current;
      const nextCmd =
        f || o ? updateCommandPaths(template.command, f, o) : template.command;
      const current = commandRef.current.trim();

      if (current && current !== nextCmd.trim()) {
        openConfirm(
          t('Selecting a template will replace the current command. Continue?'),
          () => {
            handleTemplateSelect(template);
            closeConfirm();
          },
        );
        return;
      }
      handleTemplateSelect(template);
    },
    [handleTemplateSelect, openConfirm, closeConfirm, t],
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

  const hasMultipleInputs = useMemo(
    () => countInputArguments(command) > 1,
    [command],
  );
  const hasCommand = command.trim().length > 0;

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  }, [language, setLanguage]);

  const openShellPane = useCallback(() => {
    handleActivePaneChange('terminal');
  }, [handleActivePaneChange]);

  const openActivityPane = useCallback(() => {
    handleActivePaneChange('activity');
  }, [handleActivePaneChange]);

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

  let commandSourceLabel = t('No template selected');
  if (selectedTemplate) {
    commandSourceLabel = t('Working from template');
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
            <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-primary-500" />
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
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-hidden transition-colors duration-300 motion-reduce:transition-none">
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
        t={t}
      />

      {/* ══ 主内容区 ══ */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto w-full px-6 py-4 space-y-4">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-4 min-w-0">
              <label
                htmlFor={templateControlId}
                className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5"
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
              />
            </div>
            <div className="col-span-4 min-w-0">
              <label
                htmlFor={inputControlId}
                className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5"
              >
                {t('Input File')}
              </label>
              <FileSelector
                id={inputControlId}
                type="input"
                value={inputFile}
                onSelect={handleSelectInputFile}
                onClear={clearInputFile}
                label={t('Select Input File')}
              />
            </div>
            <div className="col-span-4 min-w-0">
              <label
                htmlFor={outputControlId}
                className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5"
              >
                {t('Output Folder')}
              </label>
              <FileSelector
                id={outputControlId}
                type="output"
                value={outputFolder}
                onSelect={handleSelectOutputFolder}
                onClear={clearOutputFolder}
                label={t('Select Output Folder')}
              />
            </div>
          </div>

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
          />
        </div>
      </div>

      {/* ══ 抽屉 ══ */}
      <WorkspaceDrawer
        activePane={activePane}
        onActivePaneChange={handleActivePaneChange}
        drawerSize={drawerSize}
        onDrawerSizeChange={handleDrawerSizeChange}
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
    </div>
  );
}

export default Home;
