import React, { useState } from "react";
import { open, runFFmpeg, formatDate } from "./common/utils";
import { path } from "@tauri-apps/api";
import {
  Row,
  Col,
  Container,
  Dropdown,
  Button,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import ProgressSteps from "./component/ProgressSteps";
import "bootstrap/dist/css/bootstrap.min.css";

import styles from "./App.module.scss";

// 转换格式 map
const CONVERT_TO_FORMAT_MAPS = [
  {
    label: "MP4",
    format: "mp4",
    command: "-c:v copy",
  },
  {
    label: "MKV",
    format: "mkv",
    command: "-c:v copy -c:a copy",
  },
  {
    label: "H264",
    format: "mp4",
    command: "-vcodec libx264 -acodec aac",
  },
  {
    label: "H265",
    format: "mp4",
    command: "-c:v libx265 -vtag hvc1",
  },
  {
    label: "GIF",
    format: "gif",
    command:
      "-vf fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
  },
];

function App() {
  const [currentTag, setCurrentTag] = useState(CONVERT_TO_FORMAT_MAPS[0].label);
  const [progress, setProgress] = useState(0);
  // const [log, setLog] = useState([]);
  const [commandLine, setCommandLine] = useState("");
  const [filePath, setFilePath] = useState("");
  const [inputPathFolder, setInputPathFolder] = useState("");
  const [activeStep, setActiveStep] = useState(1);

  const handleProgress = (progressVal, state) => {
    setProgress(progressVal);
    // setLog((pre) => {
    //   return [...pre, line];
    // });
  };

  const handleConvertTo = async (curTag, pathName = filePath) => {
    setCurrentTag(curTag);
    // 文件路径
    const inputPath = await path.dirname(pathName);
    // 文件名
    const fileName = await path.basename(pathName);
    // 输出目录
    const [firstFileName] = fileName.split(".");
    const outputPath = `${inputPath}/${firstFileName}_${formatDate(
      new Date(),
      "YY-MM-DD_hh-mm-ss"
    )}`;

    const selectFormatCommand = CONVERT_TO_FORMAT_MAPS.find(
      (it) => it.label === curTag
    );

    setInputPathFolder(inputPath);

    setCommandLine([
      "-i",
      `${pathName}`,
      ...selectFormatCommand.command.split(" "),
      `${outputPath}.${selectFormatCommand.format}`,
    ]);
  };

  const start = async () => {
    try {
      setActiveStep(3);
      await runFFmpeg(commandLine, inputPathFolder, handleProgress);
    } catch (error) {
      console.error(error);
    }
  };

  const steps = [
    {
      label: "",
      step: 1,
    },
    {
      label: "",
      step: 2,
    },
    {
      label: "",
      step: 3,
    },
  ];

  return (
    <div className={styles.ffmpeg}>
      <div className={styles.uploadTool}>
        <ProgressSteps
          steps={steps}
          activeStep={activeStep}
          progress={progress}
        />
        <Container>
          <Row>
            <Col>
              <OverlayTrigger
                placement='bottom'
                overlay={
                  <Tooltip>
                    {filePath ? filePath : "请选择要转换的文件"}
                  </Tooltip>
                }
              >
                <Button
                  variant='primary'
                  key={currentTag}
                  disabled={progress > 0 && progress !== 100}
                  className={styles.entry}
                  onClick={async (e) => {
                    const filePathUrl = await open({
                      title: "请选择文件",
                    });

                    if (!filePathUrl) {
                      return;
                    }

                    handleConvertTo("MP4", filePathUrl);

                    setFilePath(filePathUrl);
                    setActiveStep(2);
                    setCommandLine("");
                    setProgress(0);
                  }}
                >
                  Choose Files
                </Button>
              </OverlayTrigger>
            </Col>

            <Col>
              <Dropdown>
                <Dropdown.Toggle
                  disabled={progress > 0 && progress !== 100}
                  variant='secondary'
                  id='dropdown-basic'
                >
                  {"Convert To " + currentTag}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {CONVERT_TO_FORMAT_MAPS.map((it) => (
                    <Dropdown.Item
                      onClick={() => handleConvertTo(it.label)}
                      key={it.label}
                    >
                      {it.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Col>

            <Col>
              {progress > 0 && progress !== 100 ? (
                <Button variant='danger' onClick={start}>
                  Convert Stop
                </Button>
              ) : (
                <Button variant='success' onClick={start}>
                  Convert Now
                </Button>
              )}
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
}

export default App;
