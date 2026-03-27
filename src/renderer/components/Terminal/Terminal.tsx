import { useEffect, useRef } from 'react';
import { useTerminal } from './useTerminal';
import 'xterm/css/xterm.css';
import styles from './Terminal.module.css';

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { focus } = useTerminal(containerRef);

  useEffect(() => {
    // 终端刚显示出来时把键盘焦点放进去，方便直接输入命令。
    focus();
  }, [focus]);

  return <div ref={containerRef} className={styles.terminal} />;
}
