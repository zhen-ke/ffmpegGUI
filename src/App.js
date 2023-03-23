import React, { useState, useRef, useEffect } from "react";
import { formatDate } from "./common/utils";
import createFFmpeg from "./common/createFFmpeg";
import { path, dialog } from "@tauri-apps/api";
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

const { open } = dialog;

// 转换格式 map
const CONVERT_TO_FORMAT_MAPS = [
  {
    label: "复制流到MP4",
    format: "mp4",
    command: "-c:v copy",
  },
  {
    label: "复制流到MKV",
    format: "mkv",
    command: "-c:v copy -c:a copy",
  },
  {
    label: "H264",
    format: "mp4",
    command: "-vcodec libx264 -acodec aac",
  },
  {
    label: "H264  (Intel硬件加速)",
    format: "mp4",
    command: "-c:v h264_qsv",
  },
  {
    label: "H264 (AMD硬件加速)",
    format: "mp4",
    command: "-c:v h264_amf",
  },
  {
    label: "H264 (Nvidia硬件加速)",
    format: "mp4",
    command: "-c:v h264_nvenc",
  },
  {
    label: "H264 (Mac硬件加速)",
    format: "mp4",
    command: "-c:v h264_videotoolbox",
  },
  {
    label: "H264超快",
    format: "mp4",
    command: "-map 0 -c:v libx264 -crf 23 -preset ultrafast -c:a copy",
  },
  {
    label: "H264 HQ + 源音频",
    format: "mp4",
    command: "-map 0 -c:v libx264 -crf 20 -c:a copy",
  },
  {
    label: "H265",
    format: "mp4",
    command: "-c:v libx265 -vtag hvc1",
  },
  {
    label: "H265 (Intel硬件加速)",
    format: "mp4",
    command: "-c:v hevc_qsv",
  },
  {
    label: "H265 (AMD硬件加速)",
    format: "mp4",
    command: "-c:v hevc_amf",
  },
  {
    label: "H265 (Nvidia硬件加速)",
    format: "mp4",
    command: "-c:v hevc_nvenc",
  },
  {
    label: "H265 (Mac硬件加速)",
    format: "mp4",
    command: "-c:v hevc_videotoolbox",
  },
  {
    label: "H265 HQ + 源音频",
    format: "mp4",
    command: "-map 0 -c:v libx265 -crf 23 -c:a copy",
  },
  {
    label: "GIF",
    format: "gif",
    command:
      "-vf fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
  },
  {
    label: "MP3 (嵌入式封面)",
    format: "mp3",
    command: "-c:v copy -c:a libmp3lame -qscale:a 0 -ac 2",
  },
  // {
  //   label: "录制屏幕",
  //   format: "mp4",
  //   command: "-f gdigrab -i desktop -preset ultrafast -crf 20",
  // },
];

function App() {
  const [currentTag, setCurrentTag] = useState(CONVERT_TO_FORMAT_MAPS[0].label);
  const [progress, setProgress] = useState(0);
  // const [log, setLog] = useState ([]);
  const [commandLine, setCommandLine] = useState("");
  const [filePath, setFilePath] = useState("");
  const [inputPathFolder, setInputPathFolder] = useState("");
  const [activeStep, setActiveStep] = useState(1);
  const ffmpegRef = useRef(null);

  const handleConvertTo = async (cur, pathName = filePath) => {
    setCurrentTag(cur.label);
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
      (it) => it.command === cur.command
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
      await ffmpegRef.current.run(commandLine, inputPathFolder);
    } catch (error) {
      console.error(error);
    }
  };

  const stop = () => {
    ffmpegRef.current.exit();
    setActiveStep(2);
    setProgress(0);
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

  const showNotification = async ({ title = "通知", body = "" }) => {
    const status = await Notification.requestPermission();
    console.log(status);
    new Notification(title, { body });
  };

  useEffect(() => {
    ffmpegRef.current = createFFmpeg({
      success: () => {
        showNotification({
          body: "转成成功",
        });
      },
      error: () => {
        showNotification({
          body: "转成失败",
        });
      },
      log: (e) => {
        console.log(e, "日志");
      },
      progress: ({ ratio }) => {
        setProgress(Math.floor(100 * ratio));
      },
    });
  }, []);

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

                    handleConvertTo(CONVERT_TO_FORMAT_MAPS[0], filePathUrl);

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
                  style={{ minWidth: 130 }}
                >
                  {currentTag ? currentTag : "Convert To"}
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ height: 240, overflow: "auto" }}>
                  {CONVERT_TO_FORMAT_MAPS.map((it) => (
                    <Dropdown.Item
                      onClick={() => handleConvertTo(it)}
                      key={it.command}
                    >
                      {it.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Col>

            <Col>
              {progress > 0 && progress !== 100 ? (
                <Button variant='danger' onClick={stop}>
                  Convert Stop
                </Button>
              ) : (
                <Button disabled={!filePath} variant='success' onClick={start}>
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
