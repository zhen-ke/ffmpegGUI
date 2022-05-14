import React from "react";
import "./index.css";

const ProgressBar = ({ progress = 0 }) => {
  return (
    <div className="progress">
      <div
        className="progress-bar progress-bar-striped progress-bar-animated"
        role="progressbar"
        style={{ width: `${progress}%` }}
      >
        <span>{progress}%</span>
      </div>
    </div>
  );
};

export default ProgressBar;
