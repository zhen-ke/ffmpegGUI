import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { type WorkspacePane } from '../components/DrawerTabBar';
import { type ToastType } from './useToast';
import { ipcInvoke } from '../ipc/ipcTyped';
import { getFileDirectory } from '../utils/filePath';

/**
 * useResultCards manages the state of result cards.
 */
export function useResultCards(options: {
  status: string;
  lastCompletedOutputFile: string;
  handleActivePaneChange: (pane: WorkspacePane) => void;
  expandDrawerRef: MutableRefObject<(() => void) | null>;
  pushToast: (type: ToastType, msg: string) => void;
  handleOperationalError: (msg: string) => void;
  t: (key: string) => string;
}): {
  showCompletedResult: boolean;
  setShowCompletedResult: Dispatch<SetStateAction<boolean>>;
  showFailedResult: boolean;
  setShowFailedResult: Dispatch<SetStateAction<boolean>>;
  completedOutputFolder: string;
  handleViewLogs: () => void;
  handleOpenCompletedFile: () => Promise<void>;
  handleOpenCompletedFolder: () => Promise<void>;
} {
  const {
    status,
    lastCompletedOutputFile,
    handleActivePaneChange,
    expandDrawerRef,
    pushToast,
    handleOperationalError,
    t,
  } = options;

  const [showCompletedResult, setShowCompletedResult] = useState(false);
  const [showFailedResult, setShowFailedResult] = useState(false);

  const prevStatusRef = useRef<string>('idle');

  useEffect(() => {
    if (status === 'done' && lastCompletedOutputFile) {
      setShowCompletedResult(true);
      setShowFailedResult(false);
    } else if (status !== 'done') {
      setShowCompletedResult(false);
    }
  }, [status, lastCompletedOutputFile]);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === 'error' && prevStatus !== 'error') {
      setShowFailedResult(true);
      pushToast('error', t('Task failed. Check the activity log for details.'));
      handleActivePaneChange('activity');
      expandDrawerRef.current?.();
    }

    if (status === 'running') {
      setShowFailedResult(false);
    }
  }, [handleActivePaneChange, pushToast, status, t]);

  const handleViewLogs = useCallback(() => {
    handleActivePaneChange('activity');
    expandDrawerRef.current?.();
  }, [handleActivePaneChange, expandDrawerRef]);

  const handleOpenCompletedFile = useCallback(async () => {
    if (!lastCompletedOutputFile) return;

    try {
      const result = await ipcInvoke(
        'open-output-file',
        lastCompletedOutputFile,
      );

      if (!result?.success) {
        handleOperationalError('Failed to open output file.');
      }
    } catch {
      handleOperationalError('Failed to open output file.');
    }
  }, [handleOperationalError, lastCompletedOutputFile]);

  const handleOpenCompletedFolder = useCallback(async () => {
    if (!lastCompletedOutputFile) return;

    try {
      const result = await ipcInvoke(
        'open-output-folder',
        lastCompletedOutputFile,
      );

      if (!result?.success) {
        handleOperationalError('Failed to open output folder.');
      }
    } catch {
      handleOperationalError('Failed to open output folder.');
    }
  }, [handleOperationalError, lastCompletedOutputFile]);

  const completedOutputFolder = lastCompletedOutputFile
    ? getFileDirectory(lastCompletedOutputFile)
    : '';

  return {
    showCompletedResult,
    setShowCompletedResult,
    showFailedResult,
    setShowFailedResult,
    completedOutputFolder,
    handleViewLogs,
    handleOpenCompletedFile,
    handleOpenCompletedFolder,
  };
}
