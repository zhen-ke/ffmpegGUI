/**
 * 日志管理 Hook
 * 管理 FFmpeg 输出日志的显示和滚动
 */

import { UIEvent, useCallback, useEffect, useRef, useState } from 'react';
import { formatLog, LogType, stripHtmlTags } from '../utils/logUtils';

export type ClipboardResult = 'success' | 'empty' | 'error';

export function useLogs() {
  const [logs, setLogs] = useState('');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);

  /**
   * 添加日志
   */
  const addLog = useCallback((type: LogType, message: string) => {
    const logHtml = formatLog(type, message);
    setLogs((prevLogs) => prevLogs + logHtml);
  }, []);

  /**
   * 清除所有日志
   */
  const clearLogs = useCallback(() => {
    setLogs('');
  }, []);

  /**
   * 复制日志为纯文本
   */
  const copyLogs = useCallback(async (): Promise<ClipboardResult> => {
    if (!logs.trim()) {
      return 'empty';
    }

    const plainText = stripHtmlTags(logs);
    try {
      await navigator.clipboard.writeText(plainText);
      return 'success';
    } catch (error) {
      console.error('Failed to copy logs:', error);
      return 'error';
    }
  }, [logs]);

  /**
   * 监听日志滚动位置，决定是否自动滚动到底部
   */
  const handleLogsScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setIsAutoScrollEnabled(distanceToBottom <= 24);
  }, []);

  /**
   * 自动滚动到底部
   */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    });
  }, []);

  /**
   * 当日志更新时自动滚动
   */
  useEffect(() => {
    if (isAutoScrollEnabled) {
      scrollToBottom();
    }
  }, [isAutoScrollEnabled, logs, scrollToBottom]);

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
