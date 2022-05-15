import React from "react";
import styles from "./index.module.scss";

const ProgressBar = ({ progress = 0 }) => {
  return (
    <div className={styles.progress}>
      <div
        className={`${styles["progress-bar"]} ${styles["progress-bar-striped"]} ${styles["progress-bar-animated"]}`}
        role="progressbar"
        style={{ width: `${progress}%` }}
      >
        <span>{progress}%</span>
      </div>
    </div>
  );
};

export default ProgressBar;
