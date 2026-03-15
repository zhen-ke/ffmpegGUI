import { useCallback, useEffect, useState } from 'react';

export function useElectronIPC() {
  const [ffmpegExists, setFfmpegExists] = useState<boolean | null>(null);

  /**
   * 向主进程查询 FFmpeg 是否可用。
   * useCallback 的目的是保持引用稳定，使下方 useEffect 的 deps 不会在每次渲染时变化。
   */
  const checkFFmpegStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'check-ffmpeg-status',
      );
      // invoke 返回 unknown，严格比较确保类型安全
      const isAvailable = result === true;
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
    return window.electron.ipcRenderer.on(
      'ffmpeg-status',
      (exists: unknown) => {
        if (typeof exists === 'boolean') {
          setFfmpegExists(exists);
        }
      },
    );
  }, [checkFFmpegStatus]);

  return {
    ffmpegExists,
    checkFFmpegStatus,
  };
}
