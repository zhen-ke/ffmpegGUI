import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

function App() {
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState('');
  const [progress, setProgress] = useState(0);
  const logsRef = useRef<HTMLDivElement>(null);
  const [totalDuration, setTotalDuration] = useState(0);

  const updateProgress = useCallback(
    (currentTime: number) => {
      if (totalDuration > 0) {
        const progressPercentage = (currentTime / totalDuration) * 100;
        setProgress(Math.min(100, progressPercentage));
      }
    },
    [totalDuration],
  );

  const addLog = useCallback(
    (type: 'info' | 'error' | 'success', message: string) => {
      setLogs(
        (prevLogs) =>
          prevLogs +
          `<div class="log-entry log-${type}"><span class="log-icon">${type === 'info' ? '🔵' : type === 'error' ? '🔴' : '🟢'}</span>${message}</div>`,
      );
    },
    [],
  );

  useEffect(() => {
    const removeFFmpegDurationListener = window.electron.ipcRenderer.on(
      'ffmpeg-duration',
      (data: { duration: number }) => {
        setTotalDuration(data.duration);
      },
    );

    const removeFFmpegProgressListener = window.electron.ipcRenderer.on(
      'ffmpeg-progress',
      (data: { time: number }) => {
        updateProgress(data.time);
      },
    );

    const removeFFmpegOutputListener = window.electron.ipcRenderer.on(
      'ffmpeg-output',
      (data: string) => {
        addLog('info', data);
      },
    );

    const removeFFmpegErrorListener = window.electron.ipcRenderer.on(
      'ffmpeg-error',
      (error: string) => {
        addLog('error', `Error: ${error}`);
        setIsRunning(false);
      },
    );

    const removeFFmpegCompleteListener = window.electron.ipcRenderer.on(
      'ffmpeg-complete',
      () => {
        setProgress(100);
        setIsRunning(false);
        addLog('success', 'FFmpeg process completed successfully.');
      },
    );

    return () => {
      removeFFmpegDurationListener();
      removeFFmpegProgressListener();
      removeFFmpegOutputListener();
      removeFFmpegErrorListener();
      removeFFmpegCompleteListener();
    };
  }, [updateProgress, addLog]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStart = () => {
    setIsRunning(true);
    setLogs('');
    setProgress(0);
    setTotalDuration(0);
    window.electron.ipcRenderer.sendMessage('start-ffmpeg', command);
  };

  const handleStop = () => {
    window.electron.ipcRenderer.sendMessage('stop-ffmpeg');
    setIsRunning(false);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      <div className="flex-shrink-0 bg-white shadow-md p-4">
        <div className="mb-4">
          <label
            htmlFor="ffmpeg-command"
            className="block font-semibold text-gray-700 mb-2"
          >
            FFmpeg Command
          </label>

          <textarea
            id="ffmpeg-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Enter FFmpeg command"
            className="w-full p-2 border border-gray-300 rounded resize-none font-mono text-sm"
            rows={3}
            spellCheck="false"
            style={{ minHeight: '4.5rem' }}
          />
        </div>
        <div className="flex justify-between">
          <button
            onClick={handleStart}
            disabled={isRunning || !command}
            className={`flex items-center px-4 py-2 rounded ${
              isRunning || !command
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            <Play size={18} className="mr-2" />
            Start
          </button>
          <button
            onClick={handleStop}
            disabled={!isRunning}
            className={`flex items-center px-4 py-2 rounded ${
              !isRunning
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            <Square size={18} className="mr-2" />
            Stop
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col overflow-hidden">
        {isRunning && (
          <div className="flex-shrink-0 bg-white p-4">
            <div className="mb-2 font-semibold text-gray-700">Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="mt-2 text-right text-sm text-gray-600">
              {progress.toFixed(2)}%
            </div>
          </div>
        )}

        <div className="flex-grow overflow-hidden bg-white p-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg text-blue-400">Logs</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setLogs('')}
                className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-300"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(logs);
                }}
                className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-300"
              >
                Copy
              </button>
            </div>
          </div>
          <div
            ref={logsRef}
            className="h-full overflow-y-auto font-mono text-sm bg-gray-100 p-4 rounded"
            dangerouslySetInnerHTML={{ __html: logs }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
