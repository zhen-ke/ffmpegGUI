/**
 * 日志管理 Hook
 * 管理 FFmpeg 输出日志的显示和滚动
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatLog, LogType, stripHtmlTags } from '../utils/logUtils';

export function useLogs() {
  const [logs, setLogs] = useState('');
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
  const copyLogs = useCallback(() => {
    const plainText = stripHtmlTags(logs);
    navigator.clipboard.writeText(plainText);
  }, [logs]);

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
    scrollToBottom();
  }, [logs, scrollToBottom]);

  return {
    logs,
    logsRef,
    addLog,
    clearLogs,
    copyLogs,
  };
}
