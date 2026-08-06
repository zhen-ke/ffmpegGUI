/**
 * FFmpegUpdater — 顶栏 FFmpeg 版本展示 + 一键更新
 *
 * 自包含组件：版本查询、更新检查、确认、下载进度全部内部管理。
 * 复用现有 IPC 管道：
 * - `get-ffmpeg-version`：查询当前版本（主进程缓存，安装后自动失效）
 * - `download-ffmpeg` + 进度事件：下载安装
 * - `ffmpeg-install-complete` / `ffmpeg-install-error`：结果
 *
 * 运行中禁用（Windows 下 exe 被占用无法覆盖）。
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import {
  fetchFFmpegAssets,
  type FFmpegAsset,
} from '../../utils/fetchFFmpegAssets';
import { parseVersion, hasUpdate } from '../utils/version';
import { ipcInvoke, ipcSend, onIpcEvent } from '../ipc/ipcTyped';
import { useLanguage } from '../LanguageContext';
import { ConfirmModal } from './ConfirmModal';
import ProgressBar from './ProgressBar';
import { ToastContainer } from './ToastContainer';

interface FFmpegUpdaterProps {
  /** FFmpeg 进程运行中禁用更新 */
  isRunning: boolean;
}

/** 展示用版本号：可解析出数字则显示 vX.Y.Z，否则原样（如 `latest (Evermeet)`） */
function displayVersion(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = parseVersion(value);
  return parsed ? `v${parsed.join('.')}` : value;
}

function FFmpegUpdater({ isRunning }: FFmpegUpdaterProps) {
  const { t } = useLanguage();
  const { toasts, pushToast, dismissToast } = useToast();

  /** 当前 FFmpeg 版本（null = 未知/解析失败） */
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  /** 最近一次检查到的目标资源 */
  const [latest, setLatest] = useState<FFmpegAsset | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [extractProgress, setExtractProgress] = useState(0);

  const refreshVersion = useCallback(async () => {
    try {
      setVersion(await ipcInvoke('get-ffmpeg-version'));
    } catch (error) {
      console.error('Failed to fetch FFmpeg version:', error);
      setVersion(null);
    }
  }, []);

  useEffect(() => {
    refreshVersion();
  }, [refreshVersion]);

  useEffect(() => {
    const removeDownload = onIpcEvent(
      'ffmpeg-download-progress',
      (progress) => {
        setDownloadProgress(progress);
      },
    );
    const removeExtract = onIpcEvent('ffmpeg-extract-progress', (progress) => {
      setExtractProgress(progress);
    });
    const removeComplete = onIpcEvent('ffmpeg-install-complete', () => {
      setInstalling(false);
      setLatest(null); // 下次检查重新拉取资源
      refreshVersion();
      pushToast('success', t('FFmpeg updated successfully.'));
    });
    const removeError = onIpcEvent('ffmpeg-install-error', (message) => {
      setInstalling(false);
      pushToast('error', `${t('Update failed')}: ${message}`);
    });

    return () => {
      removeDownload();
      removeExtract();
      removeComplete();
      removeError();
    };
  }, [pushToast, refreshVersion, t]);

  const handleCheckUpdates = useCallback(async () => {
    if (isRunning || checking || installing) return;
    setChecking(true);
    try {
      const assets = await fetchFFmpegAssets(window.electron.platform);
      // 优先选版本号可解析的资源（如 macOS Intel 的 Evermeet "latest" 无版本号，跳过）
      const asset = assets.find((a) => parseVersion(a.version)) ?? assets[0];
      setLatest(asset);
      if (asset && hasUpdate(asset.version, version)) {
        setConfirmOpen(true);
      } else {
        pushToast('info', t('FFmpeg is up to date.'));
      }
    } catch (error) {
      console.error('Failed to check FFmpeg updates:', error);
      pushToast('error', t('Failed to check for updates.'));
    } finally {
      setChecking(false);
    }
  }, [checking, installing, isRunning, pushToast, t, version]);

  const handleConfirmUpdate = useCallback(() => {
    setConfirmOpen(false);
    if (!latest) return;
    setDownloadProgress(0);
    setExtractProgress(0);
    setInstalling(true);
    ipcSend('download-ffmpeg', latest.downloadUrl);
  }, [latest]);

  const busy = checking || installing;

  return (
    <>
      <button
        type="button"
        onClick={handleCheckUpdates}
        disabled={isRunning || busy}
        title={
          isRunning
            ? t('Stop the current task before updating.')
            : `${t('Check for updates')}${version ? ` · v${version}` : ''}`
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors duration-200 ${
          isRunning || busy
            ? 'bg-slate-100 dark:bg-slate-700/40 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-600/50 cursor-not-allowed'
            : 'bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-600/50'
        }`}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RefreshCw size={14} />
        )}
        <span>
          FFmpeg {version ? displayVersion(version) : t('Check for updates')}
        </span>
      </button>

      <ConfirmModal
        isOpen={confirmOpen}
        title={t('Update FFmpeg')}
        description={
          latest
            ? `${t('Latest version')}: ${displayVersion(latest.version)}${
                version
                  ? ` · ${t('Current version')}: ${displayVersion(version)}`
                  : ''
              }`
            : undefined
        }
        confirmLabel={t('Update')}
        onConfirm={handleConfirmUpdate}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* 更新进行中：下载/解压进度弹层 */}
      {/* 必须 portal 到 body：header 的 backdrop-blur 会成为 fixed 后代的包含块，内联渲染会被困在顶栏内 */}
      {installing &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]" />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2
                  size={20}
                  className="animate-spin text-primary-500 flex-shrink-0"
                />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('Updating FFmpeg')}
                </h2>
              </div>
              <div className="space-y-4">
                <ProgressBar
                  progress={downloadProgress}
                  color="bg-gradient-to-r from-primary-500 to-primary-600"
                  label={t('Downloading')}
                />
                <ProgressBar
                  progress={extractProgress}
                  color="bg-gradient-to-r from-green-500 to-emerald-500"
                  label={t('Extracting')}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default FFmpegUpdater;
