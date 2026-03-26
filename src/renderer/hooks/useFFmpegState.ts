/**
 * FFmpeg 状态管理 Hook（重构版）
 *
 * 职责：只管 isRunning / isStopping / progress / totalDuration 状态。
 */

import { useCallback, useEffect } from 'react';
import { useLatest } from './useLatest';
import { useState } from 'react';

// ========== IPC 数据类型 ==========

interface FFmpegDurationData {
  duration: number;
}

interface FFmpegProgressData {
  time: number;
}

// ========== Hook Props ==========

interface UseFFmpegStateProps {
  /**
   * 进度更新回调（可选），用于需要同步当前时间到外部的场景。
   */
  onProgressUpdate?: (currentTime: number) => void;
}

// ========== Hook ==========

export function useFFmpegState({ onProgressUpdate }: UseFFmpegStateProps = {}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  const onProgressUpdateRef = useLatest(onProgressUpdate);
  const totalDurationRef = useLatest(totalDuration);
  const isRunningRef = useLatest(isRunning);
  const isStoppingRef = useLatest(isStopping);

  /**
   * 更新进度百分比。
   * 通过 ref 读取最新 totalDuration，deps 保持为 []，引用永远稳定。
   */
  const updateProgress = useCallback((currentTime: number) => {
    const duration = totalDurationRef.current;
    if (duration > 0) {
      setProgress(Math.min(100, (currentTime / duration) * 100));
    }
    onProgressUpdateRef.current?.(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 启动 FFmpeg。
   */
  const handleStart = useCallback((command: string) => {
    setIsStopping(false);
    setProgress(0);
    setTotalDuration(0);
    totalDurationRef.current = 0;

    const trimmed = command?.trim();
    if (!trimmed) return;

    window.electron.ipcRenderer
      .invoke('start-ffmpeg', trimmed)
      .then((result: unknown) => {
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true
        ) {
          setIsRunning(true);
          return;
        }
        setIsRunning(false);
        setIsStopping(false);
      })
      .catch(() => {
        setIsRunning(false);
        setIsStopping(false);
        // 错误日志由 FFmpegTerminal 监听 ffmpeg-error 事件输出，这里不重复写
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 停止 FFmpeg。
   */
  const handleStop = useCallback(() => {
    if (!isRunningRef.current || isStoppingRef.current) return;

    window.electron.ipcRenderer
      .invoke('stop-ffmpeg')
      .then((result: unknown) => {
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true
        ) {
          setIsStopping(true);
          return;
        }
        setIsStopping(false);
      })
      .catch(() => {
        setIsStopping(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 只监听进度相关事件：duration / progress / error状态重置 / cancelled / complete
   * 不监听 ffmpeg-output（纯日志，由 FFmpegTerminal 处理）
   */
  useEffect(() => {
    const listeners = [
      window.electron.ipcRenderer.on('ffmpeg-duration', (data: unknown) => {
        setTotalDuration((data as FFmpegDurationData).duration);
      }),

      window.electron.ipcRenderer.on('ffmpeg-progress', (data: unknown) => {
        updateProgress((data as FFmpegProgressData).time);
      }),

      // 只重置运行状态，日志由 FFmpegTerminal 负责
      window.electron.ipcRenderer.on('ffmpeg-error', () => {
        setIsRunning(false);
        setIsStopping(false);
      }),

      window.electron.ipcRenderer.on('ffmpeg-cancelled', () => {
        setIsRunning(false);
        setIsStopping(false);
      }),

      window.electron.ipcRenderer.on('ffmpeg-complete', () => {
        setProgress(100);
        setIsRunning(false);
        setIsStopping(false);
      }),
    ];

    return () => listeners.forEach((remove) => remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isRunning,
    isStopping,
    progress,
    totalDuration,
    handleStart,
    handleStop,
  };
}
