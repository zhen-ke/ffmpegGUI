/**
 * useMediaProbe — 媒体探针 Hook
 *
 * 从 Home.tsx 提取，负责：
 * 1. 检测 ffprobe 是否可用（check-media-probe-status）
 * 2. 在 primaryInputPath 变化时自动探针媒体信息（probe-media）
 */

import { useEffect, useState } from 'react';
import type { MediaProbeResult } from '../../shared/mediaProbe';
import { ipcInvoke } from '../ipc/ipcTyped';

interface UseMediaProbeProps {
  /** 第一个输入文件路径；为空字符串时不触发探针 */
  primaryInputPath: string;
}

interface UseMediaProbeReturn {
  isMediaProbeAvailable: boolean | null;
  mediaInfo: MediaProbeResult | null;
  isMediaInfoLoading: boolean;
  hasMediaInfoError: boolean;
}

export function useMediaProbe({
  primaryInputPath,
}: UseMediaProbeProps): UseMediaProbeReturn {
  const [isMediaProbeAvailable, setIsMediaProbeAvailable] = useState<
    boolean | null
  >(null);
  const [mediaInfo, setMediaInfo] = useState<MediaProbeResult | null>(null);
  const [isMediaInfoLoading, setIsMediaInfoLoading] = useState(false);
  const [hasMediaInfoError, setHasMediaInfoError] = useState(false);

  // ── 1. 检测 ffprobe 可用性 ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    ipcInvoke('check-media-probe-status')
      .then((result) => {
        if (!cancelled) {
          setIsMediaProbeAvailable(result === true);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          setIsMediaProbeAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── 2. 探针媒体信息 ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (isMediaProbeAvailable !== true) {
      setMediaInfo(null);
      setHasMediaInfoError(false);
      setIsMediaInfoLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!primaryInputPath) {
      setMediaInfo(null);
      setHasMediaInfoError(false);
      setIsMediaInfoLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsMediaInfoLoading(true);
    setHasMediaInfoError(false);
    setMediaInfo(null);

    ipcInvoke('probe-media', primaryInputPath)
      .then((result) => {
        if (!cancelled) {
          if (result.success) {
            setMediaInfo(result.data);
            setHasMediaInfoError(false);
          } else {
            if (result.error === 'FFprobe is not available.') {
              setMediaInfo(null);
              setHasMediaInfoError(false);
              setIsMediaProbeAvailable(false);
              setIsMediaInfoLoading(false);
              return undefined;
            }

            setMediaInfo(null);
            setHasMediaInfoError(true);
          }

          setIsMediaInfoLoading(false);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          setMediaInfo(null);
          setHasMediaInfoError(true);
          setIsMediaInfoLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMediaProbeAvailable, primaryInputPath]);

  return {
    isMediaProbeAvailable,
    mediaInfo,
    isMediaInfoLoading,
    hasMediaInfoError,
  };
}
