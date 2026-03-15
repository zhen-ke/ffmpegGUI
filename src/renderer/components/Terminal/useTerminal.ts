import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useEffect, useRef } from 'react';
import { Terminal, type ITheme } from 'xterm';

// ========== 常量 ==========

const TERMINAL_THEME: ITheme = {
  background:        '#0D1117',
  foreground:        '#E6EDF3',
  cursor:            '#58A6FF',
  cursorAccent:      '#0D1117',
  selectionBackground: 'rgba(88,166,255,0.3)',
  black:             '#21262D',
  brightBlack:       '#6E7681',
  red:               '#FF7B72',
  brightRed:         '#FFA198',
  green:             '#3FB950',
  brightGreen:       '#56D364',
  yellow:            '#D29922',
  brightYellow:      '#E3B341',
  blue:              '#58A6FF',
  brightBlue:        '#79C0FF',
  magenta:           '#BC8CFF',
  brightMagenta:     '#D2A8FF',
  cyan:              '#39C5CF',
  brightCyan:        '#56D4DD',
  white:             '#B1BAC4',
  brightWhite:       '#F0F6FC',
};

const TERMINAL_OPTIONS = {
  cursorBlink:   true,
  fontSize:      13.5,
  lineHeight:    1.2,
  letterSpacing: 0.3,
  fontFamily:    "'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace",
  convertEol:    true,
  scrollback:    5000,
  theme:         TERMINAL_THEME,
} as const;

// ========== Hook ==========

export interface UseTerminalReturn {
  /** 手动触发终端重新适配容器尺寸 */
  fit: () => void;
}

/**
 * 管理 xterm.js Terminal 实例的完整生命周期：
 * 初始化、PTY 连接、尺寸自适应、清理。
 *
 * @param containerRef 挂载终端的 DOM 容器
 */
export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement>,
): UseTerminalReturn {
  // 用 ref 存储 fit 函数，让 ResizeObserver 回调始终拿到最新版本
  const fitFnRef = useRef<() => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── 初始化 ────────────────────────────────────────────
    const term = new Terminal(TERMINAL_OPTIONS);
    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    fitAddon.fit();

    // fit 定义在 effect 内，直接闭包访问 term / fitAddon，无需 useCallback
    const fit = () => {
      fitAddon.fit();
      window.terminalAPI.resize(term.cols, term.rows);
    };

    // 同步到 ref，使 ResizeObserver 回调始终调用最新版本
    fitFnRef.current = fit;

    // ── PTY 连接 ──────────────────────────────────────────
    window.terminalAPI.start(term.cols, term.rows).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      term.writeln(`\r\n\x1b[31m[Error] Failed to start PTY: ${message}\x1b[0m`);
    });

    const unlistenOutput = window.terminalAPI.onOutput((data) => {
      term.write(data);
    });

    const unlistenExit = window.terminalAPI.onExit((code) => {
      term.writeln(
        `\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`,
      );
    });

    term.onData((data) => window.terminalAPI.sendInput(data));

    // ── 尺寸自适应 ────────────────────────────────────────
    const ro = new ResizeObserver(fit);
    ro.observe(container);

    // ── 清理 ──────────────────────────────────────────────
    return () => {
      ro.disconnect();        // 先停止观察，防止 dispose 后触发 fit
      unlistenOutput();
      unlistenExit();
      window.terminalAPI.kill();
      term.dispose();
      fitFnRef.current = () => {};
    };
  }, [containerRef]);

  return {
    fit: () => fitFnRef.current(),
  };
}
