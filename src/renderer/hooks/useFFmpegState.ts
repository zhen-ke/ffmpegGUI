/**
 * FFmpeg 状态管理 Hook
 * 管理 FFmpeg 执行状态、进度和 IPC 通信
 */

import { useCallback, useEffect, useState } from 'react';
import { LogType } from '../utils/logUtils';

interface UseFFmpegStateProps {
  onLog: (type: LogType, message: string) => void;
  onProgressUpdate: (currentTime: number) => void;
}

export function useFFmpegState({
  onLog,
  onProgressUpdate,
}: UseFFmpegStateProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  /**
   * 更新进度百分比
   */
  const updateProgress = useCallback(
    (currentTime: number) => {
      if (totalDuration > 0) {
        const progressPercentage = (currentTime / totalDuration) * 100;
        setProgress(Math.min(100, progressPercentage));
      }
      onProgressUpdate(currentTime);
    },
    [totalDuration, onProgressUpdate],
  );

  /**
   * 启动 FFmpeg
   */
  const handleStart = useCallback((command: string) => {
    setIsRunning(true);
    setProgress(0);
    setTotalDuration(0);
    window.electron.ipcRenderer.sendMessage('start-ffmpeg', command);
  }, []);

  /**
   * 停止 FFmpeg
   */
  const handleStop = useCallback(() => {
    window.electron.ipcRenderer.sendMessage('stop-ffmpeg', null);
    setIsRunning(false);
  }, []);

  /**
   * 设置 FFmpeg 事件监听器
   */
  useEffect(() => {
    // Duration 监听
    const removeDurationListener = window.electron.ipcRenderer.on(
      'ffmpeg-duration',
      (data: { duration: number }) => {
        setTotalDuration(data.duration);
      },
    );

    // Progress 监听
    const removeProgressListener = window.electron.ipcRenderer.on(
      'ffmpeg-progress',
      (data: { time: number }) => {
        updateProgress(data.time);
      },
    );

    // Output 监听
    const removeOutputListener = window.electron.ipcRenderer.on(
      'ffmpeg-output',
      (data: string) => {
        onLog('info', data);
      },
    );

    // Error 监听
    const removeErrorListener = window.electron.ipcRenderer.on(
      'ffmpeg-error',
      (error: string) => {
        onLog('error', `Error: ${error}`);
        setIsRunning(false);
      },
    );

    // Complete 监听
    const removeCompleteListener = window.electron.ipcRenderer.on(
      'ffmpeg-complete',
      () => {
        setProgress(100);
        setIsRunning(false);
        onLog('success', 'FFmpeg process completed successfully.');
      },
    );

    // 清理函数
    return () => {
      removeDurationListener();
      removeProgressListener();
      removeOutputListener();
      removeErrorListener();
      removeCompleteListener();
    };
  }, [updateProgress, onLog]);

  return {
    isRunning,
    progress,
    totalDuration,
    handleStart,
    handleStop,
  };
}
