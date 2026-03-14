import { useCallback, useEffect, useState } from 'react';
import type { IpcChannel } from '../../shared/ipcChannels';

const CHECK_FFMPEG_STATUS_CHANNEL: IpcChannel = 'check-ffmpeg-status';
const FFMPEG_STATUS_CHANNEL: IpcChannel = 'ffmpeg-status';

export function useElectronIPC() {
  const [ffmpegExists, setFfmpegExists] = useState<boolean | null>(null);

  /**
   * Check if FFmpeg is available
   */
  const checkFFmpegStatus = useCallback(async () => {
    try {
      const exists = await window.electron.ipcRenderer.invoke(
        CHECK_FFMPEG_STATUS_CHANNEL,
      );
      const isAvailable = exists === true;
      setFfmpegExists(isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('Failed to check FFmpeg status:', error);
      setFfmpegExists(false);
      return false;
    }
  }, []);

  // Setup listener for FFmpeg status updates
  useEffect(() => {
    // Initial check
    checkFFmpegStatus();

    // Listener for status updates from main process
    const removeListener = window.electron.ipcRenderer.on(
      FFMPEG_STATUS_CHANNEL,
      (exists: unknown) => {
        // Ensure type safety
        if (typeof exists === 'boolean') {
          setFfmpegExists(exists);
        }
      },
    );

    return () => {
      removeListener();
    };
  }, [checkFFmpegStatus]);

  return {
    ffmpegExists,
    checkFFmpegStatus,
  };
}
