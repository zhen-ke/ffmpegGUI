import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

export function useTerminal(containerRef: React.RefObject<HTMLDivElement>) {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const fit = useCallback(() => {
    if (!fitRef.current || !termRef.current) return;
    fitRef.current.fit();
    const { cols, rows } = termRef.current;
    window.terminalAPI.resize(cols, rows);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13.5,
      lineHeight: 1.2,
      letterSpacing: 0.3,
      fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace",
      theme: {
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
      },
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    window.terminalAPI.start(term.cols, term.rows);

    const unlisten = window.terminalAPI.onOutput((data) => term.write(data));

    term.onData((data) => window.terminalAPI.sendInput(data));

    const ro = new ResizeObserver(fit);
    ro.observe(containerRef.current);

    return () => {
      unlisten();
      ro.disconnect();
      window.terminalAPI.kill();
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { term: termRef, fit };
}
