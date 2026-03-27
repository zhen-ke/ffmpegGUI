/**
 * useTerminal — 交互式 PTY 终端 Hook
 *
 * 基于 useXterm 构建，添加 PTY 连接、输入/输出绑定和进程管理。
 * useXterm 负责 xterm.js 实例的创建/销毁/FitAddon/WebLinksAddon/ResizeObserver，
 * 本 hook 通过 onInit/onResize 回调接入 PTY 层。
 */

import { useCallback, type RefObject } from 'react';
import { type Terminal } from 'xterm';
import { useXterm } from '../../hooks/useXterm';

// ========== Hook ==========

export interface UseTerminalReturn {
  /** 手动触发终端重新适配容器尺寸 */
  fit: () => void;
  /** 让 xterm 获取键盘焦点 */
  focus: () => void;
}

/**
 * 管理 xterm.js Terminal 实例的完整生命周期：
 * 初始化、PTY 连接、尺寸自适应、清理。
 *
 * @param containerRef 挂载终端的 DOM 容器
 */
export function useTerminal(
  containerRef: RefObject<HTMLDivElement>,
): UseTerminalReturn {
  const handleResize = useCallback((cols: number, rows: number) => {
    window.terminalAPI.resize(cols, rows);
  }, []);

  const handleInit = useCallback((term: Terminal) => {
    // ── PTY 连接 ──
    window.terminalAPI.start(term.cols, term.rows).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      term.writeln(
        `\r\n\x1b[31m[Error] Failed to start PTY: ${message}\x1b[0m`,
      );
    });

    const unlistenOutput = window.terminalAPI.onOutput((data) => {
      term.write(data);
    });

    const unlistenExit = window.terminalAPI.onExit((code) => {
      term.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`);
    });

    const onDataDisposable = term.onData((data) =>
      window.terminalAPI.sendInput(data),
    );

    // 返回清理函数
    return () => {
      onDataDisposable.dispose();
      unlistenOutput();
      unlistenExit();
      window.terminalAPI.kill();
    };
  }, []);

  const { fit, focus } = useXterm(containerRef, {
    scrollback: 5000,
    cursorBlink: true,
    onResize: handleResize,
    onInit: handleInit,
  });

  return { fit, focus };
}
