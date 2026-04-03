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
import {
  buildOutputPreview,
  countInputArguments,
  parseInputArguments,
  parseOutputFileName,
  updateCommandPaths,
  updateInputArgument,
  updateOutputFileName,
} from './utils/commandUtils';
import type { MediaProbeResult } from '../shared/mediaProbe';

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

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatBitRate(bitRate: number | null): string {
  if (bitRate === null || !Number.isFinite(bitRate) || bitRate <= 0) return '—';

  if (bitRate >= 1_000_000) {
    return `${(bitRate / 1_000_000).toFixed(1)} Mbps`;
  }

  return `${Math.round(bitRate / 1000)} kbps`;
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

  // ── 统一 ConfirmModal 状态（替代所有 window.confirm）──

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
  });
  const [mediaInfo, setMediaInfo] = useState<MediaProbeResult | null>(null);
  const [isMediaInfoLoading, setIsMediaInfoLoading] = useState(false);
  const [hasMediaInfoError, setHasMediaInfoError] = useState(false);
  const [isMediaProbeAvailable, setIsMediaProbeAvailable] = useState<
    boolean | null
  >(null);

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
        updateCommandWithPaths(tplCmd, currentInputs, o);
      } else updateCommand(tplCmd);
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

      const currentInputs = inputFilesRef.current;
      const o = outputFolderRef.current;
      const nextCmd =
        currentInputs.length > 0 || o
          ? updateCommandPaths(template.command, currentInputs, o)
          : template.command;
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
  const mediaInfoError = hasMediaInfoError
    ? t('Failed to read media details.')
    : '';

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

  const handleOutputFileNameChange = useCallback(
    (value: string) => {
      setCommand((prev) =>
        updateOutputFileName(prev, value, outputFolderRef.current),
      );
    },
    [setCommand],
  );

  useEffect(() => {
    let cancelled = false;

    window.electron.ipcRenderer
      .invoke('check-media-probe-status')
      .then((result) => {
        if (!cancelled) {
          setIsMediaProbeAvailable(result === true);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          setIsMediaProbeAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (isMediaProbeAvailable !== true) {
      setMediaInfo(null);
      setHasMediaInfoError(false);
      setIsMediaInfoLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!primaryInputPath) {
      setMediaInfo(null);
      setHasMediaInfoError(false);
      setIsMediaInfoLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsMediaInfoLoading(true);
    setHasMediaInfoError(false);
    setMediaInfo(null);

    window.electron.ipcRenderer
      .invoke('probe-media', primaryInputPath)
      .then((result) => {
        if (!cancelled) {
          const probeResult = result as
            | { success: true; data: MediaProbeResult }
            | { success: false; error: string };

          if (probeResult?.success) {
            setMediaInfo(probeResult.data);
            setHasMediaInfoError(false);
          } else {
            if (probeResult?.error === 'FFprobe is not available.') {
              setMediaInfo(null);
              setHasMediaInfoError(false);
              setIsMediaProbeAvailable(false);
              setIsMediaInfoLoading(false);
              return undefined;
            }

            setMediaInfo(null);
            setHasMediaInfoError(true);
          }

          setIsMediaInfoLoading(false);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          setMediaInfo(null);
          setHasMediaInfoError(true);
          setIsMediaInfoLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMediaProbeAvailable, primaryInputPath]);

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
  const currentCommand = command.trim();
  const primaryVideoStream = mediaInfo?.videoStreams[0] ?? null;
  const primaryAudioStream = mediaInfo?.audioStreams[0] ?? null;
  const primarySubtitleStream = mediaInfo?.subtitleStreams[0] ?? null;
  const completedOutputFolder = lastCompletedOutputFile
    ? getPathDirectory(lastCompletedOutputFile)
    : '';
  const showCompletedResult =
    status === 'done' && currentCommand === lastStartedCommand;
  let mediaDetailsContent = (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {t('No media details yet')}
    </p>
  );

  if (mediaInfoError) {
    mediaDetailsContent = (
      <p className="text-sm text-red-600 dark:text-red-400">{mediaInfoError}</p>
    );
  } else if (mediaInfo) {
    mediaDetailsContent = (
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('Format')}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {mediaInfo.formatName}
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('Duration')}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatDuration(mediaInfo.durationSeconds)}
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('Size')}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatBytes(mediaInfo.sizeBytes)}
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('Bitrate')}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatBitRate(mediaInfo.bitRate)}
          </p>
        </div>

        <div className="col-span-12 md:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('Video')}
          </p>
          {primaryVideoStream ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p>{primaryVideoStream.codec}</p>
              <p>
                {t('Resolution')}:{' '}
                {primaryVideoStream.width && primaryVideoStream.height
                  ? `${primaryVideoStream.width}×${primaryVideoStream.height}`
                  : '—'}
              </p>
              <p>
                {t('Frame Rate')}:{' '}
                {primaryVideoStream.frameRate
                  ? `${primaryVideoStream.frameRate.toFixed(2)} fps`
                  : '—'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">—</p>
          )}
        </div>

        <div className="col-span-12 md:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('Audio')}
          </p>
          {primaryAudioStream ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p>{primaryAudioStream.codec}</p>
              <p>
                {t('Channels')}: {primaryAudioStream.channels ?? '—'}
              </p>
              <p>
                {t('Sample Rate')}:{' '}
                {primaryAudioStream.sampleRate
                  ? `${Math.round(primaryAudioStream.sampleRate)} Hz`
                  : '—'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">—</p>
          )}
        </div>

        <div className="col-span-12 md:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('Subtitles')}
          </p>
          {primarySubtitleStream ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p>{primarySubtitleStream.codec}</p>
              <p>
                {t('Tracks')}: {mediaInfo.subtitleStreams.length}
              </p>
              <p>{primarySubtitleStream.language ?? '—'}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">—</p>
          )}
        </div>
      </div>
    );
  }

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
            <div
              className={`${inputSlotCount === 1 ? 'col-span-4' : 'col-span-6'} min-w-0`}
            >
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
            {inputSlotCount === 1 && (
              <div className="col-span-4 min-w-0">
                <label
                  htmlFor={inputSlots[0].id}
                  className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5"
                >
                  {inputSlots[0].fieldLabel}
                </label>
                <FileSelector
                  id={inputSlots[0].id}
                  type="input"
                  value={inputSlots[0].selectedValue}
                  onSelect={() => handleSelectInputAtIndex(0)}
                  onClear={() => handleClearInputAtIndex(0)}
                  label={inputSlots[0].label}
                />
              </div>
            )}
            <div
              className={`${inputSlotCount === 1 ? 'col-span-4' : 'col-span-6'} min-w-0`}
            >
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
                    className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5"
                  >
                    {slot.fieldLabel}
                  </label>
                  <FileSelector
                    id={slot.id}
                    type="input"
                    value={slot.selectedValue}
                    onSelect={() => handleSelectInputAtIndex(slot.index)}
                    onClear={() => handleClearInputAtIndex(slot.index)}
                    label={slot.label}
                  />
                </div>
              ))}
            </div>
          )}

          {isMediaProbeAvailable === true && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/40 px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t('Media Details')}
                  </h2>
                  <p
                    className="text-xs text-slate-500 dark:text-slate-400 truncate"
                    title={
                      primaryInputPath ||
                      t('Select a first input file to inspect it here.')
                    }
                  >
                    {primaryInputPath ||
                      t('Select a first input file to inspect it here.')}
                  </p>
                </div>
                {isMediaInfoLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('Reading media details...')}</span>
                  </div>
                )}
              </div>

              {mediaDetailsContent}
            </div>
          )}

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5 min-w-0">
              <label
                htmlFor={`${outputControlId}-name`}
                className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5"
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
              <p className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
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
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-900/20 px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {t('Latest Result')}
                  </p>
                  <h2 className="mt-1 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    {t('Task complete. Your output is ready.')}
                  </h2>
                  {lastCompletedOutputFile ? (
                    <>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">
                        {t('Completed Output')}
                      </p>
                      <p
                        className="mt-1 truncate text-sm font-mono text-emerald-900 dark:text-emerald-100"
                        title={lastCompletedOutputFile}
                      >
                        {lastCompletedOutputFile}
                      </p>
                      <p
                        className="mt-1 truncate text-xs text-emerald-800/80 dark:text-emerald-200/80"
                        title={completedOutputFolder}
                      >
                        {completedOutputFolder}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
                      {t('Task complete. Your output is ready.')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {lastCompletedOutputFile && (
                    <button
                      type="button"
                      onClick={handleOpenCompletedFile}
                      className="px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-sm font-medium text-emerald-800 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors duration-200"
                    >
                      {t('Open File')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenCompletedFolder}
                    className="px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-sm font-medium text-emerald-800 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors duration-200"
                  >
                    {t('Open Folder')}
                  </button>
                  <button
                    type="button"
                    onClick={onStart}
                    disabled={!canStart || !currentCommand}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {t('Run Again')}
                  </button>
                </div>
              </div>
            </div>
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
