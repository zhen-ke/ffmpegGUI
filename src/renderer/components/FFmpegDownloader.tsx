import React, { useState, useEffect } from 'react';
import { FFmpegAsset, fetchFFmpegAssets } from '../../utils/fetchFFmpegAssets';
import { ipcSend, onIpcEvent } from '../ipc/ipcTyped';
import { useLanguage } from '../LanguageContext';
import {
  Download,
  Server,
  Archive,
  CheckCircle,
  AlertCircle,
  Loader2,
  HardDrive,
} from 'lucide-react';
import ProgressBar from './ProgressBar';

const FFmpegDownloader: React.FC = () => {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<FFmpegAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<FFmpegAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [extractProgress, setExtractProgress] = useState(0);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const { platform } = window.electron;

    fetchFFmpegAssets(platform)
      .then((fetchedAssets) => {
        setAssets(fetchedAssets);
        setLoading(false);
        if (fetchedAssets.length === 1) {
          setSelectedAsset(fetchedAssets[0]);
        }
      })
      .catch((err) => {
        setError('Failed to fetch FFmpeg assets.');
        setLoading(false);
        console.error(err);
      });
  }, []);

  useEffect(() => {
    const removeFFmpegDownloadProgressListener = onIpcEvent(
      'ffmpeg-download-progress',
      (progress) => {
        setDownloadProgress(progress);
      },
    );

    const removeFFmpegExtractProgressListener = onIpcEvent(
      'ffmpeg-extract-progress',
      (progress) => {
        setExtractProgress(progress);
      },
    );

    const removeFFmpegInstallCompleteListener = onIpcEvent(
      'ffmpeg-install-complete',
      () => {
        setInstalling(false);
      },
    );

    const removeFFmpegInstallErrorListener = onIpcEvent(
      'ffmpeg-install-error',
      (errorMessage) => {
        setInstalling(false);
        setError(errorMessage);
      },
    );

    return () => {
      removeFFmpegDownloadProgressListener();
      removeFFmpegExtractProgressListener();
      removeFFmpegInstallCompleteListener();
      removeFFmpegInstallErrorListener();
    };
  }, []);

  const handleAssetSelect = (asset: FFmpegAsset) => {
    setSelectedAsset(asset);
  };

  const handleDownload = () => {
    if (selectedAsset) {
      setInstalling(true);
      ipcSend('download-ffmpeg', selectedAsset.downloadUrl);
    }
  };

  if (installing) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--titlebar-height))] bg-gradient-to-br from-slate-50 via-primary-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700">
          <div className="text-center mb-8">
            <div className="relative inline-flex">
              <div className="p-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg shadow-primary-500/25 mb-4">
                <Loader2 size={48} className="text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {t('Installing FFmpeg')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {t('Please wait while FFmpeg is being installed...')}
            </p>
          </div>

          <div className="space-y-6">
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

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span>
              {t('Processing...')} {Math.max(downloadProgress, extractProgress)}
              %
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--titlebar-height))] bg-gradient-to-br from-slate-50 via-primary-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <div className="relative inline-flex mb-6">
            <div className="p-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg shadow-primary-500/25">
              <Loader2 size={40} className="text-white animate-spin" />
            </div>
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">
            {t('Loading FFmpeg assets...')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--titlebar-height))] bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-slate-900/50 border border-red-200 dark:border-red-900/30">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-red-100 dark:bg-red-900/30 rounded-2xl mb-4">
              <AlertCircle
                size={40}
                className="text-red-600 dark:text-red-400"
              />
            </div>
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
              {t('Error')}
            </h2>
            <p className="text-slate-600 dark:text-slate-300">{t(error)}</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg shadow-red-500/25 hover:shadow-xl"
          >
            {t('Try Again')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-var(--titlebar-height))] bg-gradient-to-br from-slate-50 via-primary-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="max-w-2xl w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg shadow-primary-500/25 mb-4">
            <Download size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {t('Download FFmpeg')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            {t(
              'FFmpeg is not detected on your system. Please download it to continue.',
            )}
          </p>
        </div>

        {/* Version Selection */}
        {window.electron.platform === 'win32' ? (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Server size={18} className="text-primary-500" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                {t('Select a version:')}
              </h3>
            </div>
            <ul className="space-y-3">
              {assets.map((asset, index) => (
                <li key={index}>
                  <label
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                      selectedAsset === asset
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ffmpeg-asset"
                      checked={selectedAsset === asset}
                      onChange={() => handleAssetSelect(asset)}
                      className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Archive size={16} className="text-slate-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {asset.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                        <span>
                          {asset.version.includes('OSXExperts')
                            ? `v${asset.version.replace(' (OSXExperts)', '')} · OSXExperts`
                            : asset.version.includes('Evermeet')
                              ? 'Latest · Evermeet'
                              : `v${asset.version}`}
                        </span>
                        {+asset.size > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <HardDrive size={12} />
                              {(asset.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {selectedAsset === asset && (
                      <CheckCircle size={20} className="text-primary-500" />
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Server
                  size={20}
                  className="text-primary-600 dark:text-primary-400"
                />
              </div>
              <p className="text-slate-700 dark:text-slate-200 font-medium">
                {t(
                  'The latest version of FFmpeg will be downloaded automatically.',
                )}
              </p>
            </div>
          </div>
        )}

        {/* Download Button */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={!selectedAsset}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
            selectedAsset
              ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          <Download size={22} />
          {t('Download and Install FFmpeg')}
        </button>
      </div>
    </div>
  );
};

export default FFmpegDownloader;
