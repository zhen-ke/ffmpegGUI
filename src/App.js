import React, { useState } from "react";
import { open, runFFmpeg } from "./common/utils";
import { path } from "@tauri-apps/api";
import ProgressBar from "./component/ProgressBar";
import TerminalLog from "./component/TerminalLog";
import Dropdown from "react-bootstrap/Dropdown";
import "bootstrap/dist/css/bootstrap.min.css";

import styles from "./App.module.scss";

const TRANSCODE_MAPS = {
  mp4: {
    command: ["-i", "filePath", "-c:v", "copy"],
    format: "mp4",
  },
  mkv: {
    command: ["-i", "filePath", "-c", "copy"],
    format: "mkv",
  },
  h264: {
    command: [
      "-i",
      "filePath",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "23",
      "-c:a",
      "copy",
    ],
    format: "mp4",
  },
  h265: {
    command: [
      "-i",
      "filePath",
      "-c:v",
      "libx265",
      "-crf",
      "23",
      "-c:a",
      "copy",
    ],
    format: "mp4",
  },
  GIF: {
    command: [
      "-i",
      "filePath",
      "-filter_complex",
      "[0:v] scale=480:-1, fps=15, split [a][b];[a] palettegen [p];[b][p] paletteuse",
    ],
    format: "gif",
  },
  // ffmpeg -i sample.avi -q:a 0 -map a sample.mp3
  // ffmpeg -i video.mp4 -vn -y -acodec copy video.m4a
  // ffmpeg -i video.mp4 video.mp3
  extractAudioFromVideo: {
    command: ["-i", "filePath"],
    format: "mp3",
  },
};

const TAG_MAPS = Object.keys(TRANSCODE_MAPS);

function App() {
  const [currentTag, setCurrentTag] = useState(TAG_MAPS[0]);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState([]);

  const handleProgress = (progressVal, line) => {
    const val = progressVal.toFixed(2);
    if (+val >= 100) {
      setProgress(0);
    } else {
      setProgress(val);
    }
    setLog((pre) => {
      return [...pre, line];
    });
  };

  return (
    <div className={styles.ffmpeg}>
      <Dropdown>
        <Dropdown.Toggle variant='success' id='dropdown-basic'>
          Dropdown Button
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <Dropdown.Item href='#/action-1'>Action</Dropdown.Item>
          <Dropdown.Item href='#/action-2'>Another action</Dropdown.Item>
          <Dropdown.Item href='#/action-3'>Something else</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      <p
        key={currentTag}
        className={styles.entry}
        onClick={async (e) => {
          const filePath = await open({
            title: "请选择文件",
          });

          if (!filePath) {
            return;
          }

          // 文件路径
          const dirname = await path.dirname(filePath);
          // 文件名
          const filename = await path.basename(filePath);

          // 输出目录
          const outputDir = `${dirname}/${filename}_${new Date().getTime()}.${
            TRANSCODE_MAPS[currentTag].format
          }`;

          // const outputFolder = "/Users/xmit/Movies";
          const command = TRANSCODE_MAPS[currentTag].command;

          const newCommand = command.map((it) => {
            if (it === "filePath") {
              return (it = filePath);
            } else {
              return it;
            }
          });

          await runFFmpeg([...newCommand, outputDir], dirname, handleProgress);
          // await runFFmpeg(["-encoders"], dirname, handleProgress);
        }}
      >
        点击选择文件
      </p>
      <ul className={styles.tag}>
        {TAG_MAPS.map((it) => (
          <li
            onClick={() => setCurrentTag(it)}
            key={it}
            className={`${styles[currentTag === it ? "active" : ""]}`}
          >
            {it}
          </li>
        ))}
      </ul>
      {progress > 0 && (
        <div className={styles.progressWrap}>
          <ProgressBar progress={progress} />
        </div>
      )}
      <div className={styles.log}>
        <TerminalLog logList={log} />
      </div>
    </div>
  );
}

export default App;
