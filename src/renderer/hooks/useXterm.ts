/**
 * useXterm Hook（修复版）
 *
 * 修复：write / writeln / clear / getSelection / getAllText / fit
 * 从函数体内直接定义改为 useCallback，确保引用稳定，
 * 避免 FFmpegTerminal 的 useEffect deps 因函数引用每帧变化而重复注册监听器。
 */

import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useCallback, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { useLatest } from './useLatest';
import { TERMINAL_THEME } from '../constants/terminalTheme';

const TERMINAL_OPTIONS = {
  cursorBlink: false,
  cursorStyle: 'bar' as const,
  cursorInactiveStyle: 'none' as const,
  fontSize: 13.5,
  lineHeight: 1.2,
  letterSpacing: 0.3,
  fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace",
  convertEol: true,
  scrollback: 10000,
  theme: TERMINAL_THEME,
  // 内边距，避免文字和光标紧贴容器边缘
  padding: 8,
} as const;

export interface XtermHandle {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
  getSelection: () => string;
  getAllText: () => string;
  resize: (cols: number, rows: number) => void;
  fit: () => void;
  focus: () => void;
}

export interface UseXtermOptions {
  autoFit?: boolean;
  webLinks?: boolean;
  scrollback?: number;
  cursorBlink?: boolean;
  /** 隐藏光标，适用于纯展示型终端（如 FFmpegTerminal） */
  disableCursor?: boolean;
  /** 每次 ResizeObserver/fit 触发后的回调，用于通知 PTY 等外部系统 */
  onResize?: (cols: number, rows: number) => void;
  /** 终端实例创建后的回调，用于连接 PTY 或绑定额外事件 */
  onInit?: (term: Terminal) => (() => void) | void;
}

export const useXterm = (
  containerRef: React.RefObject<HTMLDivElement>,
  options: UseXtermOptions = {},
) => {
  const {
    autoFit = true,
    webLinks = true,
    scrollback = 10000,
    cursorBlink = false,
    disableCursor = false,
    onResize,
    onInit,
  } = options;

  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // 用 useLatest 保持 onResize/onInit 的最新引用，避免加入 effect deps
  const onResizeRef = useLatest(onResize);
  const onInitRef = useLatest(onInit);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      ...TERMINAL_OPTIONS,
      scrollback,
      cursorBlink,
      ...(disableCursor && {
        cursorBlink: false,
        cursorStyle: 'bar' as const,
        cursorInactiveStyle: 'none' as const,
        // cursor 颜色设为透明，彻底隐藏，不影响文字渲染
        theme: {
          ...TERMINAL_THEME,
          cursor: 'transparent',
          cursorAccent: 'transparent',
        },
      }),
    });
    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);
    if (webLinks) term.loadAddon(new WebLinksAddon());
    term.open(container);
    if (autoFit) fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // onInit 回调：允许外部连接 PTY 等，并返回清理函数
    const cleanupInit = onInitRef.current?.(term);

    let ro: ResizeObserver | null = null;
    if (autoFit) {
      ro = new ResizeObserver(() => {
        fitAddon.fit();
        onResizeRef.current?.(term.cols, term.rows);
      });
      ro.observe(container);
    }

    return () => {
      ro?.disconnect();
      cleanupInit?.();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // onResizeRef / onInitRef 由 useLatest 提供，稳定，无需列入 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, autoFit, webLinks, scrollback, cursorBlink, disableCursor]);

  // ── 使用 useCallback 保证引用稳定，避免 FFmpegTerminal useEffect 反复重注册 ──

  const write = useCallback((text: string) => {
    termRef.current?.write(text);
  }, []);

  const writeln = useCallback((text: string) => {
    termRef.current?.writeln(text);
  }, []);

  const clear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const getSelection = useCallback(() => {
    return termRef.current?.getSelection() ?? '';
  }, []);

  const getAllText = useCallback(() => {
    const term = termRef.current;
    if (!term) return '';
    const buffer = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
    }
    // 去除尾部空行
    while (lines.length > 0 && !lines[lines.length - 1].trim()) {
      lines.pop();
    }
    return lines.join('\n');
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    termRef.current?.resize(cols, rows);
  }, []);

  const fit = useCallback(() => {
    if (autoFit && fitAddonRef.current) fitAddonRef.current.fit();
  }, [autoFit]);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  return {
    term: termRef,
    write,
    writeln,
    clear,
    getSelection,
    getAllText,
    resize,
    fit,
    focus,
  };
};
