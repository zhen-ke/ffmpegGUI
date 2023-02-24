import React, { useState } from "react";
import { open, runFFmpeg } from "./common/utils";
import { path } from "@tauri-apps/api";
import TerminalLog from "./component/TerminalLog";
import {
  Row,
  Col,
  Container,
  Dropdown,
  Button,
  ProgressBar,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

import styles from "./App.module.scss";

const TAG_MAPS = ["MP4", "MKV", "H264", "H265", "GIF"];

function App() {
  const [currentTag, setCurrentTag] = useState(TAG_MAPS[0]);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState([]);
  const [commandLine, setCommandLine] = useState("");
  const [filePath, setFilePath] = useState("");
  const [inputPathFolder, setInputPathFolder] = useState("");

  const handleProgress = (progressVal, line) => {
    if (+progressVal >= 100) {
      setProgress(0);
    } else {
      setProgress(progressVal);
    }
    setLog((pre) => {
      return [...pre, line];
    });
  };

  const handleConvertTo = async (curTag, pathName = filePath) => {
    setCurrentTag(curTag);
    // 文件路径
    const inputPath = await path.dirname(pathName);
    // 文件名
    const fileName = await path.basename(pathName);
    // 输出目录
    const [firstFileName] = fileName.split(".");
    const outputPath = `${inputPath}/${firstFileName}-${new Date().getTime()}`;

    const headPath = `-i ${pathName}`;
    const footPath = `${outputPath}.mp4`;

    setInputPathFolder(inputPath);
    switch (curTag) {
      case "MP4":
        setCommandLine(`${headPath} -c:v copy ${footPath}`);
        break;
      case "MKV":
        setCommandLine(`${headPath} -c:v copy -c:a copy ${outputPath}.mkv`);
        break;
      case "H264":
        setCommandLine(`${headPath} -vcodec libx264 -acodec aac ${footPath}`);
        break;
      case "H265":
        setCommandLine(`${headPath} -c:v libx265 -vtag hvc1 ${footPath}`);
        break;
      case "GIF":
        setCommandLine(
          `${headPath} -vf 'fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse' -loop 0 ${outputPath}.gif`
        );
        break;
      default:
        setCommandLine(`${headPath} -c:v copy ${footPath}`);
        break;
    }
  };

  const start = async () => {
    try {
      await runFFmpeg(commandLine, inputPathFolder, handleProgress);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={styles.ffmpeg}>
      <Container>
        <Row>
          <Col>
            <Button
              variant='success'
              key={currentTag}
              className={styles.entry}
              onClick={async (e) => {
                const filePathUrl = await open({
                  title: "请选择文件",
                });

                if (!filePathUrl) {
                  return;
                }
                setFilePath(filePathUrl);
                handleConvertTo("MP4", filePathUrl);
              }}
            >
              Choose Files
            </Button>
          </Col>

          <Col>
            <Dropdown>
              <Dropdown.Toggle variant='secondary' id='dropdown-basic'>
                {"Convert To " + currentTag}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {TAG_MAPS.map((it) => (
                  <Dropdown.Item
                    onClick={() => handleConvertTo(it)}
                    key={it}
                    className={`${styles[currentTag === it ? "active" : ""]}`}
                  >
                    {it}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </Col>

          <Col>
            <Button variant='primary' onClick={start}>
              Convert Now
            </Button>
          </Col>
        </Row>
      </Container>

      {progress > 0 && (
        <div className={styles.progressWrap}>
          <ProgressBar animated now={progress} />
        </div>
      )}
      <div className={styles.log}>
        <TerminalLog logList={log} />
      </div>
    </div>
  );
}

export default App;
