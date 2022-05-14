import React, { useState } from "react";
import { open, runFFmpeg } from "./common/utils";
import { path } from "@tauri-apps/api";
import ProgressBar from "./component/ProgressBar";
import "./App.css";

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
};

const TAG_MAPS = Object.keys(TRANSCODE_MAPS);

function App() {
  const [currentTag, setCurrentTag] = useState(TAG_MAPS[0]);
  const [progress, setProgress] = useState(0);

  const handleProgress = (progressVal) => {
    const val = progressVal.toFixed(2);
    if (+val >= 100) {
      setProgress(0);
    } else {
      setProgress(val);
    }
  };

  return (
    <div className="ffmpeg">
      <header className="ffmpeg-header">
        <p
          key={currentTag}
          className="ffmpeg-entry"
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

            await runFFmpeg(
              [...newCommand, outputDir],
              dirname,
              handleProgress
            );
          }}
        >
          点击选择文件
        </p>
        <ul className="tag">
          {TAG_MAPS.map((it) => (
            <li
              onClick={() => setCurrentTag(it)}
              key={it}
              className={currentTag === it ? "active" : ""}
            >
              {it}
            </li>
          ))}
        </ul>
        {progress > 0 && (
          <div className="progressWrap">
            <ProgressBar progress={progress} />
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
