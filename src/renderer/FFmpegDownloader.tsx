import React, { useState, useEffect } from 'react';
import { FFmpegAsset, fetchFFmpegAssets } from '../utils/fetchFFmpegAssets';

const FFmpegDownloader: React.FC = () => {
  const [assets, setAssets] = useState<FFmpegAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<FFmpegAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [extractProgress, setExtractProgress] = useState(0);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const removeFFmpegDownloadProgressListener = window.electron.ipcRenderer.on(
      'ffmpeg-download-progress',
      (progress: number) => {
        setDownloadProgress(progress);
      },
    );

    const removeFFmpegExtractProgressListener = window.electron.ipcRenderer.on(
      'ffmpeg-extract-progress',
      (progress: number) => {
        setExtractProgress(progress);
      },
    );

    const removeFFmpegInstallCompleteListener = window.electron.ipcRenderer.on(
      'ffmpeg-install-complete',
      () => {
        setInstalling(false);
        // 可能需要刷新 FFmpeg 状态或重新加载应用
      },
    );

    const removeFFmpegInstallErrorListener = window.electron.ipcRenderer.on(
      'ffmpeg-install-error',
      (errorMessage: string) => {
        setInstalling(false);
        setError(errorMessage);
      },
    );

    // 清理函数
    return () => {
      removeFFmpegDownloadProgressListener();
      removeFFmpegExtractProgressListener();
      removeFFmpegInstallCompleteListener();
      removeFFmpegInstallErrorListener();
    };
  }, []);

  useEffect(() => {
    fetchFFmpegAssets()
      .then((fetchedAssets) => {
        setAssets(fetchedAssets);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to fetch FFmpeg assets');
        setLoading(false);
        console.error(err);
      });
  }, []);

  const handleAssetSelect = (asset: FFmpegAsset) => {
    setSelectedAsset(asset);
  };

  const handleDownload = () => {
    if (selectedAsset) {
      setInstalling(true);
      // 通过 IPC 发送下载 URL 到主进程
      window.electron.ipcRenderer.sendMessage(
        'download-ffmpeg',
        selectedAsset.downloadUrl,
      );
    }
  };

  if (installing) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            Installing FFmpeg
          </h2>
          <div className="mb-4">
            <p className="text-gray-600">Downloading: {downloadProgress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
          </div>
          <div>
            <p className="text-gray-600">Extracting: {extractProgress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-green-600 h-2.5 rounded-full"
                style={{ width: `${extractProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">
          <svg
            className="animate-spin h-8 w-8 mr-3 inline"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Loading FFmpeg assets...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="max-w-2xl w-full p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-8 text-gray-800 text-center">
          Download FFmpeg
        </h2>
        <p className="text-gray-600 mb-6 text-center">
          FFmpeg is not detected on your system. Please select a version to
          download.
        </p>
        <ul className="space-y-2 mb-6">
          {assets.map((asset, index) => (
            <li key={index} className="flex items-center">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="ffmpeg-asset"
                  checked={selectedAsset === asset}
                  onChange={() => handleAssetSelect(asset)}
                  className="form-radio h-5 w-5 text-blue-600"
                />
                <span className="text-gray-700">
                  {`${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          onClick={handleDownload}
          disabled={!selectedAsset}
          className={`w-full py-2 px-4 rounded-md font-semibold text-white transition-colors duration-200 ${
            selectedAsset
              ? 'bg-blue-500 hover:bg-blue-600'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Update to Selected Version
        </button>
      </div>
    </div>
  );
};

export default FFmpegDownloader;
