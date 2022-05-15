import React, { useRef, useEffect } from "react";
import styles from "./index.module.scss";

const TerminalLog = ({ logList = [] }) => {
  const terminalLogRef = useRef(null);

  useEffect(() => {
    terminalLogRef.current.scrollTop = terminalLogRef.current.scrollHeight;
  }, [JSON.stringify(logList)]);

  return (
    <ul className={styles.terminalLog} ref={terminalLogRef}>
      {logList.map((it, index) => (
        <li key={index}>{it}</li>
      ))}
    </ul>
  );
};

export default TerminalLog;
