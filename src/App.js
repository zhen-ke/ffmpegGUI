import React from "react";
import { open, runFFmpeg } from "./common/utils";
import "./App.css";

function App() {
  return (
    <div className="ffmpeg">
      <header className="ffmpeg-header">
        <p
          onClick={async (e) => {
            const filePath = await open({
              title: "请选择视频文件",
            });
            if (!filePath) {
              return;
            }
            const outputFolder = "/Users/xmit/Movies";

            await runFFmpeg(
              [
                "-i",
                filePath,
                "-codec",
                "copy",
                `${outputFolder}/${new Date().getTime()}.mp4`,
              ],
              outputFolder
            );
          }}
        >
          点击选择文件
        </p>
      </header>
    </div>
  );
}

export default App;
