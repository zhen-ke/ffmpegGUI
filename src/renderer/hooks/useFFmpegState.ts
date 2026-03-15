/**
 * FFmpeg 状态管理 Hook
 * 管理 FFmpeg 执行状态、进度和 IPC 通信
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LogType } from '../utils/logUtils';

// ========== 工具 Hook ==========

/**
 * 始终持有最新值的 ref，在渲染阶段同步。
 * 用于在 useCallback / useEffect 内读取最新 prop/state，同时保持依赖数组稳定。
 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

// ========== IPC 数据类型 ==========

interface FFmpegDurationData {
  duration: number;
}

interface FFmpegProgressData {
  time: number;
}

// ========== Hook Props ==========

interface UseFFmpegStateProps {
  onLog: (type: LogType, message: string) => void;
  onProgressUpdate?: (currentTime: number) => void;
}

// ========== Hook ==========

export function useFFmpegState({
  onLog,
  onProgressUpdate,
}: UseFFmpegStateProps) {
  const [isRunning, setIsRunning]       = useState(false);
  const [isStopping, setIsStopping]     = useState(false);
  const [progress, setProgress]         = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // useLatest 统一管理"最新值"，替代三个独立的同步 useEffect
  const onLogRef            = useLatest(onLog);
  const onProgressUpdateRef = useLatest(onProgressUpdate);
  const totalDurationRef    = useLatest(totalDuration);

  // isRunning / isStopping 用 ref 存储，消除 handleStop 对这两个状态的依赖
  const isRunningRef  = useLatest(isRunning);
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
   * 重置全部状态（包括直接写 ref，避免 totalDurationRef 在当帧读到旧值）。
   */
  const handleStart = useCallback((command: string) => {
    setIsRunning(true);
    setIsStopping(false);
    setProgress(0);
    setTotalDuration(0);
    // 立即同步 ref，防止本帧内 updateProgress 读到上一次的 totalDuration
    totalDurationRef.current = 0;
    window.electron.ipcRenderer.sendMessage('start-ffmpeg', command);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 停止 FFmpeg。
   * 通过 ref 读取最新状态，不将 isRunning / isStopping 列为依赖。
   */
  const handleStop = useCallback(() => {
    if (!isRunningRef.current || isStoppingRef.current) return;
    setIsStopping(true);
    onLogRef.current('info', 'Stopping FFmpeg process...');
    window.electron.ipcRenderer.sendMessage('stop-ffmpeg', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 注册全部 FFmpeg IPC 事件监听器。
   * deps 为 [] — updateProgress 引用稳定，监听器只需注册一次。
   */
  useEffect(() => {
    const listeners = [
      window.electron.ipcRenderer.on(
        'ffmpeg-duration',
        (data: unknown) => {
          setTotalDuration((data as FFmpegDurationData).duration);
        },
      ),

      window.electron.ipcRenderer.on(
        'ffmpeg-progress',
        (data: unknown) => {
          updateProgress((data as FFmpegProgressData).time);
        },
      ),

      window.electron.ipcRenderer.on(
        'ffmpeg-output',
        (data: unknown) => {
          onLogRef.current('info', data as string);
        },
      ),

      window.electron.ipcRenderer.on(
        'ffmpeg-error',
        (error: unknown) => {
          // error 已是主进程传来的消息字符串，不再拼接 "Error: " 前缀
          onLogRef.current('error', error as string);
          setIsRunning(false);
          setIsStopping(false);
        },
      ),

      window.electron.ipcRenderer.on(
        'ffmpeg-cancelled',
        (message: unknown) => {
          onLogRef.current(
            'info',
            (message as string | undefined) ?? 'FFmpeg process stopped.',
          );
          setIsRunning(false);
          setIsStopping(false);
        },
      ),

      window.electron.ipcRenderer.on(
        'ffmpeg-complete',
        () => {
          setProgress(100);
          setIsRunning(false);
          setIsStopping(false);
          onLogRef.current('success', 'FFmpeg process completed successfully.');
        },
      ),
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
