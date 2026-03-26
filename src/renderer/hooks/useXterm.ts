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
import { Terminal, type ITheme } from 'xterm';

const TERMINAL_THEME: ITheme = {
  background: '#0D1117',
  foreground: '#E6EDF3',
  cursor: '#58A6FF',
  cursorAccent: '#0D1117',
  selectionBackground: 'rgba(88,166,255,0.3)',
  black: '#21262D',
  brightBlack: '#6E7681',
  red: '#FF7B72',
  brightRed: '#FFA198',
  green: '#3FB950',
  brightGreen: '#56D364',
  yellow: '#D29922',
  brightYellow: '#E3B341',
  blue: '#58A6FF',
  brightBlue: '#79C0FF',
  magenta: '#BC8CFF',
  brightMagenta: '#D2A8FF',
  cyan: '#39C5CF',
  brightCyan: '#56D4DD',
  white: '#B1BAC4',
  brightWhite: '#F0F6FC',
};

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
}

export interface UseXtermOptions {
  autoFit?: boolean;
  webLinks?: boolean;
  scrollback?: number;
  /** 隐藏光标，适用于纯展示型终端（如 FFmpegTerminal） */
  disableCursor?: boolean;
}

export const useXterm = (
  containerRef: React.RefObject<HTMLDivElement>,
  options: UseXtermOptions = {},
) => {
  const { autoFit = true, webLinks = true, scrollback = 10000, disableCursor = false } = options;

  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      ...TERMINAL_OPTIONS,
      scrollback,
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

    if (autoFit) {
      const ro = new ResizeObserver(() => fitAddon.fit());
      ro.observe(container);
      return () => {
        ro.disconnect();
        term.dispose();
        termRef.current = null;
        fitAddonRef.current = null;
      };
    }

    return () => {
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [containerRef, autoFit, webLinks, scrollback, disableCursor]);

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

  return { term: termRef, write, writeln, clear, getSelection, getAllText, resize, fit };
};
