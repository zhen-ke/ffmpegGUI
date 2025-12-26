/**
 * FFmpeg 状态管理 Hook
 * 管理 FFmpeg 执行状态、进度和 IPC 通信
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LogType } from '../utils/logUtils';

// ========== IPC 事件数据类型 ==========

/** FFmpeg 总时长数据 */
interface FFmpegDurationData {
  duration: number;
}

/** FFmpeg 进度数据 */
interface FFmpegProgressData {
  time: number;
}

// ========== Hook Props ==========

interface UseFFmpegStateProps {
  /** 日志回调 */
  onLog: (type: LogType, message: string) => void;
  /** 进度更新回调（可选） */
  onProgressUpdate?: (currentTime: number) => void;
}

export function useFFmpegState({
  onLog,
  onProgressUpdate,
}: UseFFmpegStateProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // 使用 useRef 存储回调引用，避免 useEffect 依赖变化导致监听器频繁重建
  const onLogRef = useRef(onLog);
  const onProgressUpdateRef = useRef(onProgressUpdate);
  const totalDurationRef = useRef(0);

  // 同步 ref 与最新的 prop 值
  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  /**
   * 更新进度百分比
   * 使用 ref 读取最新值，避免作为 useEffect 依赖
   */
  const updateProgress = useCallback((currentTime: number) => {
    const duration = totalDurationRef.current;
    if (duration > 0) {
      const progressPercentage = (currentTime / duration) * 100;
      setProgress(Math.min(100, progressPercentage));
    }
    onProgressUpdateRef.current?.(currentTime);
  }, []);

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
   * 使用 ref 读取回调，确保监听器只注册一次
   */
  useEffect(() => {
    // Duration 监听
    const removeDurationListener = window.electron.ipcRenderer.on(
      'ffmpeg-duration',
      (...args: unknown[]) => {
        const data = args[0] as FFmpegDurationData;
        setTotalDuration(data.duration);
      },
    );

    // Progress 监听
    const removeProgressListener = window.electron.ipcRenderer.on(
      'ffmpeg-progress',
      (...args: unknown[]) => {
        const data = args[0] as FFmpegProgressData;
        updateProgress(data.time);
      },
    );

    // Output 监听
    const removeOutputListener = window.electron.ipcRenderer.on(
      'ffmpeg-output',
      (...args: unknown[]) => {
        const data = args[0] as string;
        onLogRef.current('info', data);
      },
    );

    // Error 监听
    const removeErrorListener = window.electron.ipcRenderer.on(
      'ffmpeg-error',
      (...args: unknown[]) => {
        const error = args[0] as string;
        onLogRef.current('error', `Error: ${error}`);
        setIsRunning(false);
      },
    );

    // Complete 监听
    const removeCompleteListener = window.electron.ipcRenderer.on(
      'ffmpeg-complete',
      () => {
        setProgress(100);
        setIsRunning(false);
        onLogRef.current('success', 'FFmpeg process completed successfully.');
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
  }, [updateProgress]);

  return {
    isRunning,
    progress,
    totalDuration,
    handleStart,
    handleStop,
  };
}
