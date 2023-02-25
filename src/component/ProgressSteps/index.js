import React from "react";
import styles from "./index.module.scss";

const ProgressSteps = ({ steps = [], activeStep = 0 }) => {
  return (
    <div className={styles.MainContainer}>
      <div className={styles.StepContainer}>
        {steps.map(({ step, label }) => (
          <div className={styles.StepWrapper} key={step}>
            <div
              className={`${styles.StepStyle} ${
                activeStep >= step ? "completed" : "incomplete"
              }`}
            >
              {activeStep >= step ? (
                <div className={styles.CheckMark}>L</div>
              ) : (
                <div className={styles.StepCount}>{step}</div>
              )}
            </div>
            <div className={styles.StepsLabelContainer}>
              <div className={styles.StepLabel} key={step}>
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressSteps;
