import React from "react";
import styles from "./index.module.scss";

const renderStepCount = (activeStep, step, totalSteps, progress) => {
  if (activeStep >= step) {
    if (step === totalSteps) {
      if (progress >= 100) {
        return <div className={styles.CheckMark}>L</div>;
      }
      return (
        <div className={`${styles.StepCount} ${styles.percentage}`}>
          {progress + "%"}
        </div>
      );
    }
    return <div className={styles.CheckMark}>L</div>;
  }
  return <div className={styles.StepCount}>{step}</div>;
};

const ProgressSteps = ({ steps = [], activeStep = 1, progress = 0 }) => {
  const totalSteps = steps.length;
  const width = `${(100 / (totalSteps - 1)) * (activeStep - 1)}%`;
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
              {renderStepCount(activeStep, step, totalSteps, progress)}
            </div>
            <div className={styles.StepsLabelContainer}>
              <div className={styles.StepLabel} key={step}>
                {label}
              </div>
            </div>
          </div>
        ))}
        <div className={styles.afterStepBar} style={{ width }} />
      </div>
    </div>
  );
};

export default ProgressSteps;
