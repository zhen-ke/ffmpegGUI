import { useCallback, useEffect, useState } from 'react';
import { onFFmpegEvent } from '../ipc/ffmpegEvents';
import { ipcInvoke } from '../ipc/ipcTyped';

/**
 * 获取当前机器可用的硬件编码器集合。
 *
 * 挂载时向主进程探测一次（ffmpeg -encoders），并订阅 ffmpeg-status
 * 事件——FFmpeg 安装完成后编码器集合可能变化，需要重新探测。
 *
 * @returns { availableEncoders: string[], isLoaded: boolean }
 *   - availableEncoders: 可用硬件编码器名（如 ['h264_videotoolbox']）；未加载时为空数组
 *   - isLoaded: 探测是否完成（用于 UI 在加载完成前避免误判"无可用编码器"）
 */
export function useHardwareEncoders(): {
  availableEncoders: string[];
  isLoaded: boolean;
} {
  const [availableEncoders, setAvailableEncoders] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const checkEncoders = useCallback(async (): Promise<void> => {
    try {
      const result = await ipcInvoke('check-hardware-encoders');
      setAvailableEncoders(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to check hardware encoders:', error);
      setAvailableEncoders([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    // 挂载时主动探测一次
    checkEncoders();

    // FFmpeg 安装/更新后重新探测
    return onFFmpegEvent('ffmpeg-status', (exists) => {
      if (exists) {
        checkEncoders();
      } else {
        setAvailableEncoders([]);
        setIsLoaded(true);
      }
    });
  }, [checkEncoders]);

  return { availableEncoders, isLoaded };
}
