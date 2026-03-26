/**
 * 日志管理 Hook
 * 管理 FFmpeg 输出日志的显示和滚动
 */

import { UIEvent, useCallback, useEffect, useRef, useState } from 'react';
import { formatLog, LogType, stripHtmlTags } from '../utils/logUtils';
import { useLatest } from './useLatest';

// ========== 常量 ==========

/**
 * 距底部不超过此像素数时视为"已滚动到底部"，保持自动滚动。
 * 容忍小误差，防止亚像素偏差导致自动滚动意外关闭。
 */
const AUTO_SCROLL_THRESHOLD_PX = 24;

// ========== 类型 ==========

export type ClipboardResult = 'success' | 'empty' | 'error';

// ========== Hook ==========

export function useLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // useLatest 消除 copyLogs 对 logs state 的依赖
  const logsLatest = useLatest(logs);

  /**
   * 追加一条日志（HTML 格式）。最多保留 2000 条以防内存和 DOM 溢出。
   */
  const addLog = useCallback((type: LogType, message: string) => {
    setLogs((prev) => {
      const newLogs = [...prev, formatLog(type, message)];
      return newLogs.length > 2000 ? newLogs.slice(newLogs.length - 2000) : newLogs;
    });
  }, []);

  /**
   * 清除所有日志
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  /**
   * 复制日志为纯文本
   */
  const copyLogs = useCallback(async (): Promise<ClipboardResult> => {
    if (logsLatest.current.length === 0) return 'empty';

    const plain = stripHtmlTags(logsLatest.current.join('')).trim();
    if (!plain) return 'empty';

    try {
      await navigator.clipboard.writeText(plain);
      return 'success';
    } catch (error) {
      console.error('Failed to copy logs:', error);
      return 'error';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 监听滚动位置，距底部超过阈值时关闭自动滚动。
   * 程序化滚动期间忽略此事件。
   */
  const handleLogsScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (isScrollingRef.current) return;

    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    setIsAutoScrollEnabled(
      scrollHeight - scrollTop - clientHeight <= AUTO_SCROLL_THRESHOLD_PX,
    );
  }, []);

  /**
   * 日志更新时若自动滚动已开启则滚动到底部。
   *
   * deps 只列 logs — 日志内容变化才需要滚动；
   * isAutoScrollEnabled 通过闭包在 effect 内读取最新值，不作为触发条件
   * （避免开关从 true→false 时意外触发一次滚动）。
   */
  useEffect(() => {
    if (!isAutoScrollEnabled) return;

    isScrollingRef.current = true;
    requestAnimationFrame(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  return {
    logs,
    logsRef,
    isAutoScrollEnabled,
    addLog,
    clearLogs,
    copyLogs,
    handleLogsScroll,
  };
}
