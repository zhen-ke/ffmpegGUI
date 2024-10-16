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
    const platform = window.electron.platform;

    fetchFFmpegAssets(platform)
      .then((fetchedAssets) => {
        setAssets(fetchedAssets);
        setLoading(false);
        if (fetchedAssets.length === 1) {
          setSelectedAsset(fetchedAssets[0]); // 如果只有一个选项（如 Mac），自动选择它
        }
      })
      .catch((err) => {
        setError('Failed to fetch FFmpeg assets');
        setLoading(false);
        console.error(err);
      });
  }, []);

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

  const ProgressBar = ({
    progress,
    color,
  }: {
    progress: number;
    color: string;
  }) => (
    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
      <div
        className={`${color} h-2 rounded-full transition-all duration-300 ease-out`}
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );

  if (installing) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-r from-blue-50 to-indigo-100">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold mb-6 text-indigo-800 text-center">
            Installing FFmpeg
          </h2>
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Downloading: {downloadProgress}%
            </p>
            <ProgressBar progress={downloadProgress} color="bg-blue-600" />
          </div>
          <div>
            <p className="text-gray-700 mb-2">Extracting: {extractProgress}%</p>
            <ProgressBar progress={extractProgress} color="bg-green-600" />
          </div>
          <div className="mt-8 text-center">
            <svg
              className="animate-spin h-10 w-10 text-indigo-600 mx-auto"
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
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-r from-blue-50 to-indigo-100">
        <div className="text-xl font-semibold text-indigo-700 flex items-center">
          <svg
            className="animate-spin h-8 w-8 mr-3"
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
      <div className="flex items-center justify-center h-screen bg-gradient-to-r from-red-50 to-pink-100">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold mb-4 text-red-600 text-center">
            Error
          </h2>
          <p className="text-gray-700 text-center">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl w-full p-8 bg-white rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold mb-4 text-indigo-800 text-center">
          Download FFmpeg
        </h2>
        <p className="text-gray-600 mb-8 text-center">
          FFmpeg is not detected on your system. Please download it to continue.
        </p>
        {window.electron.platform === 'win32' ? (
          <div className="mb-2">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">
              Select a version:
            </h3>
            <ul className="space-y-3">
              {assets.map((asset, index) => (
                <li
                  key={index}
                  className="bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors duration-200"
                >
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="ffmpeg-asset"
                      checked={selectedAsset === asset}
                      onChange={() => handleAssetSelect(asset)}
                      className="form-radio h-5 w-5 text-indigo-600"
                    />
                    <span className="text-gray-700 font-medium">
                      {`${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-gray-700 mb-8 text-center font-medium">
            The latest version of FFmpeg will be downloaded automatically.
          </p>
        )}
        <button
          onClick={handleDownload}
          disabled={!selectedAsset}
          className={`w-full py-3 px-4 mt-4 rounded-lg font-semibold text-white text-lg transition-all duration-200 ${
            selectedAsset
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Download and Install FFmpeg
        </button>
      </div>
    </div>
  );
};

export default FFmpegDownloader;
