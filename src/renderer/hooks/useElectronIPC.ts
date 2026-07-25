import { useCallback, useEffect, useState } from 'react';
import { onFFmpegEvent } from '../ipc/ffmpegEvents';
import { ipcInvoke } from '../ipc/ipcTyped';

export function useElectronIPC() {
  const [ffmpegExists, setFfmpegExists] = useState<boolean | null>(null);

  /**
   * 向主进程查询 FFmpeg 是否可用。
   * useCallback 的目的是保持引用稳定，使下方 useEffect 的 deps 不会在每次渲染时变化。
   */
  const checkFFmpegStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await ipcInvoke('check-ffmpeg-status');
      // invoke 返回 boolean
      const isAvailable = result;
      setFfmpegExists(isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('Failed to check FFmpeg status:', error);
      setFfmpegExists(false);
      return false;
    }
  }, []);

  useEffect(() => {
    // 挂载时主动检查一次
    checkFFmpegStatus();

    // 监听主进程推送的状态变更（如安装完成后）
    return onFFmpegEvent('ffmpeg-status', (exists) => {
      setFfmpegExists(exists);
    });
  }, [checkFFmpegStatus]);

  return {
    ffmpegExists,
    checkFFmpegStatus,
  };
}
