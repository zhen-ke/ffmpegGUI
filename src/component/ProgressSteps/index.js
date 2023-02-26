import React from "react";
import styles from "./index.module.scss";

const renderStepCount = (step, progress) => {
  if (progress < 0) {
    return <div className={`${styles.CheckMark} ${styles.fail}`}>X</div>;
  }
  if (progress === 100) {
    return <div className={styles.CheckMark}>L</div>;
  }
  if (progress === 0) {
    return <div className={styles.StepCount}>{step}</div>;
  }
  return (
    <div className={`${styles.StepCount} ${styles.percentage}`}>
      {progress + "%"}
    </div>
  );
};

const ProgressSteps = ({ steps = [], activeStep = 1, progress = 0 }) => {
  const totalSteps = steps.length;
  const width = `${(100 / (totalSteps - 1)) * (activeStep - 1)}%`;
  return (
    <div className={styles.MainContainer}>
      <div className={styles.StepContainer}>
        {steps.map(({ step, label }) => {
          if (step === totalSteps) {
            return (
              <div className={styles.StepWrapper} key={step}>
                <div className={styles.StepStyle}>
                  {renderStepCount(step, progress)}
                </div>
                <div className={styles.StepsLabelContainer}>
                  <div className={styles.StepLabel} key={step}>
                    {label}
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className={styles.StepWrapper} key={step}>
              <div className={styles.StepStyle}>
                {activeStep > step ? (
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
          );
        })}
        <div className={styles.afterStepBar} style={{ width }} />
      </div>
    </div>
  );
};

export default ProgressSteps;
