import { useRef } from 'react';
import { useTerminal } from './useTerminal';
import 'xterm/css/xterm.css';
import styles from './Terminal.module.css';

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef);
  return <div ref={containerRef} className={styles.terminal} />;
}
