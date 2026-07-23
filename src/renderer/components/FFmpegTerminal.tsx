/**
 * FFmpegTerminal（重构版）
 *
 * 职责：
 * 1. 挂载 xterm 实例，作为唯一的 FFmpeg 日志渲染层
 * 2. 监听所有 ffmpeg-* 日志 IPC 事件，直接写入 xterm（不走 React State）
 * 3. 通过 ref 回调向父级暴露 clear / getAllText API
 * 4. 通过 ref 回调向父级暴露 writeLog API，供父级写入系统级提示（复制成功等）
 *
 * 修复问题：
 * - useImperativeHandle 改为 useEffect 赋值 MutableRefObject
 * - 移除多余的 xtermRef 中间层
 * - 所有 IPC 监听集中在此，useFFmpegState 不再重复监听日志事件
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import 'xterm/css/xterm.css';
import { onFFmpegEvent } from '../ipc/ffmpegEvents';
import { useXterm } from '../hooks/useXterm';

// ========== ANSI 颜色常量 ==========

const ESC = '\x1b';
const RESET = `${ESC}[0m`;
const RED = `${ESC}[31m`;
const GREEN = `${ESC}[32m`;
const CYAN = `${ESC}[36m`;
const GRAY = `${ESC}[90m`;

// ========== 工具函数 ==========

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export type TerminalLogType = 'info' | 'error' | 'success';

function buildLine(type: TerminalLogType, message: string): string {
  const time = `${GRAY}[${formatTime()}]${RESET}`;
  const prefix =
    type === 'error'
      ? `${RED}✕ ${RESET}`
      : type === 'success'
        ? `${GREEN}✓ ${RESET}`
        : `${CYAN}➜ ${RESET}`;
  return `${time} ${prefix}${message}`;
}

// ========== Props ==========

export interface FFmpegTerminalProps {
  /** 父级持有此 ref 可调用 clear() */
  onClearRef: MutableRefObject<(() => void) | null>;
  /** 父级持有此 ref 可调用 getAllText()，用于复制全部日志 */
  onCopyRef: MutableRefObject<(() => string) | null>;
  /**
   * 父级持有此 ref 可主动向 xterm 写入一条带样式的日志行。
   * 用于替代原 addLog：系统提示（复制成功、命令已复制等）也写入 xterm，
   * 而不是走独立的 React State toast。
   */
  onWriteLogRef: MutableRefObject<
    ((type: TerminalLogType, message: string) => void) | null
  >;
}

// ========== 组件 ==========

export function FFmpegTerminal({
  onClearRef,
  onCopyRef,
  onWriteLogRef,
}: FFmpegTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { writeln, clear, getAllText } = useXterm(containerRef, {
    autoFit: true,
    webLinks: true,
    scrollback: 10000,
    disableCursor: true,
  });

  // —— 向父级暴露 API（useEffect 赋值，避免 useImperativeHandle 误用）——

  useEffect(() => {
    if (onClearRef) onClearRef.current = clear;
    if (onCopyRef) onCopyRef.current = getAllText;
    if (onWriteLogRef) {
      onWriteLogRef.current = (type: TerminalLogType, message: string) => {
        writeln(buildLine(type, message));
      };
    }
    return () => {
      if (onClearRef) onClearRef.current = null;
      if (onCopyRef) onCopyRef.current = null;
      if (onWriteLogRef) onWriteLogRef.current = null;
    };
  }, [clear, getAllText, writeln, onClearRef, onCopyRef, onWriteLogRef]);

  // —— 监听所有 ffmpeg-* 日志事件，直接写入 xterm ——

  useEffect(() => {
    const unlistenOutput = onFFmpegEvent('ffmpeg-output', (line) => {
      writeln(buildLine('info', line));
    });

    const unlistenError = onFFmpegEvent('ffmpeg-error', (message) => {
      writeln(buildLine('error', message));
    });

    const unlistenCancelled = onFFmpegEvent('ffmpeg-cancelled', (message) => {
      writeln(buildLine('info', message || 'FFmpeg process stopped.'));
    });

    const unlistenComplete = onFFmpegEvent('ffmpeg-complete', () => {
      writeln(buildLine('success', 'FFmpeg process completed successfully.'));
    });

    return () => {
      unlistenOutput();
      unlistenError();
      unlistenCancelled();
      unlistenComplete();
    };
  }, [writeln]);

  return (
    <div className="h-full w-full bg-[#0D1117] overflow-hidden relative">
      {/* xterm 的 padding option 部分版本不生效，改用 CSS 注入内边距 */}
      <style>{`
        .xterm .xterm-viewport { padding: 6px 8px !important; box-sizing: border-box; }
        .xterm .xterm-screen   { margin: 6px 8px !important; }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
