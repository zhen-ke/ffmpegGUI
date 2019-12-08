<template>
  <div class="container">
    <div class="dragBar" style="-webkit-app-region: drag"></div>
    <div class="tabs">
      <el-tabs type="border-card" v-model="activeTab" @tab-click="handleClick">
        <el-tab-pane name="video">
          <span slot="label">
            <i class="el-icon-video-play"></i> 视频
          </span>
          <Entry @updateTypesPath="updateTypesPath" />
        </el-tab-pane>
        <el-tab-pane name="audio">
          <span slot="label">
            <i class="el-icon-headset"></i> 音频
          </span>
          <Entry @updateTypesPath="updateTypesPath" />
        </el-tab-pane>
        <el-tab-pane name="cutAudio">
          <span slot="label">
            <i class="el-icon-headset"></i> 切割音频
          </span>
          <Entry @updateTypesPath="updateTypesPath" />
          <div class="slider">
            <AudioSlider
              :cutAudioMarks.sync="cutAudioMarks"
              :cutAudioValue.sync="cutAudioValue"
              :duration="duration"
            />
          </div>
        </el-tab-pane>
        <el-tab-pane name="cutVideo">
          <span slot="label">
            <i class="el-icon-video-play"></i> 切割视频
          </span>
          <Entry @updateTypesPath="updateTypesPath" />
          <div class="slider">
            <AudioSlider
              :cutAudioMarks.sync="cutAudioMarks"
              :cutAudioValue.sync="cutAudioValue"
              :duration="duration"
            />
          </div>
        </el-tab-pane>
        <el-tab-pane name="merge">
          <span slot="label">
            <i class="el-icon-refresh"></i> 合并(视频/音频)
          </span>
          <div class="cloumn">
            <div class="selecter">
              <Entry @updateTypesPath="updateTypesPath" name="video" />
            </div>
            <div class="selecter">
              <Entry @updateTypesPath="updateTypesPath" name="audio" />
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane name="gif">
          <span slot="label">
            <i class="el-icon-video-play"></i> 视频转gif
          </span>
          <Entry @updateTypesPath="updateTypesPath" />
        </el-tab-pane>
        <el-tab-pane name="customize">
          <span slot="label">
            <i class="el-icon-video-play"></i> 命令行转码
          </span>
          <Xterm :currentTab="activeTab == 'customize'" />
        </el-tab-pane>
      </el-tabs>
    </div>
    <div class="progress" v-if="progress">
      <el-progress :text-inside="true" :stroke-width="20" :percentage="progress" color="#67C23A"></el-progress>
    </div>
    <div class="footer" v-if="activeTab !== 'customize'">
      <el-button type="primary" @click="startCommand()">转换</el-button>
      <el-button type="primary" @click="stopCommand()">中止</el-button>
    </div>
  </div>
</template>

<script>
import Entry from "@/components/Entry";
import Xterm from "@/components/Xterm";
import ChildProcessFFmpeg from "@/utils/core";
import AudioSlider from "@/components/AudioSlider";
import { sec_to_time, getProgress, dateNow, getFilename } from "@/utils/common";
import { remote } from "electron";

const ffmpeg = new ChildProcessFFmpeg();

export default {
  data() {
    return {
      entry: "",
      output: "",
      activeTab: "video",
      audioPath: "",
      progress: 0,
      duration: 0,
      cutAudioMarks: {},
      cutAudioValue: [0, 0]
    };
  },
  methods: {
    //  获取用户选择文件的路径
    updateTypesPath(path, name) {
      if (name === "audio") {
        this.audioPath = path;
      } else {
        this.entry = path;
      }
    },
    // 切换 tabs
    handleClick(tab, event) {
      this.cutAudioValue = [0, 0];
      this.cutAudioMarks = {};
    },
    // 选择保存路经
    savePath() {
      return new Promise((resolve, reject) => {
        remote.dialog.showOpenDialog(
          {
            buttonLabel: "保存",
            properties: ["openDirectory"]
          },
          filename => {
            if (filename) {
              this.output = filename[0];
              resolve(filename[0]);
            } else {
              reject("用户取消");
            }
          }
        );
      });
    },
    // 准备转码
    startCommand() {
      if (this.activeTab == "merge") {
        if (this.entry === "") {
          this.msg("视频路径为空", "warning");
          return;
        }
        if (this.audioPath === "") {
          this.msg("音频路径为空", "warning");
          return;
        }
      } else {
        if (this.entry === "") {
          this.msg("视频或者路径为空", "warning");
          return;
        }
      }
      switch (this.activeTab) {
        case "video":
          this.startConversion("convertVideo", "mp4");
          break;
        case "audio":
          this.startConversion("convertAudio", "mp3");
          break;
        case "cutAudio":
          this.startConversion("convertCutAudio", "mp3", this.cutAudioValue);
          break;
        case "cutVideo":
          this.startConversion("convertCutVideo", "mp4", this.cutAudioValue);
          break;
        case "merge":
          this.startConversion("convertMerge", "mp4");
          break;
        case "gif":
          this.startConversion("convertGIF", "gif", [0, 5]);
          break;
        case "customize":
          this.customizeStartConversion(this.customize);
          break;
        default:
          this.startConversion("convertVideo", "mp4");
          break;
      }
    },
    // 开始转码
    async startConversion(command, format, time) {
      try {
        await this.savePath();
      } catch (error) {
        console.log(error);
        return;
      }
      let inputPath = {};
      switch (command) {
        case "convertMerge":
          inputPath = { videoPath: this.entry, aidioPath: this.audioPath };
          break;
        default:
          inputPath = this.entry;
          break;
      }
      let params = {
        inputPath,
        outputPath: this.output,
        onProgress: this.onProgress,
        command,
        format,
        time
      };
      ffmpeg.convert({ ...params });
    },
    customizeStartConversion(commandLine) {
      let params = {
        onProgress: this.onProgress,
        commandLine
      };
      ffmpeg.customize({ ...params });
    },
    // 消息通知
    msg(msg, type) {
      this.$message({
        message: msg,
        type
      });
    },
    // 读取媒体元数据
    getMediaInfo(media) {
      ffmpeg.getMediaInfo(media).then(it => {
        let { duration } = it;
        console.log(it);
        this.duration = duration;
        this.cutAudioValue = [0, duration];
        this.cutAudioMarks = {
          0: "0:00:00",
          [duration]: sec_to_time(duration) + ""
        };
      });
    },
    // 进度条
    onProgress(data) {
      this.progress = +data;
    },
    // 停止转码
    stopCommand() {
      ffmpeg.stop();
      this.progress = 0;
    }
  },
  watch: {
    entry(newVal, oldVal) {
      if (newVal) {
        this.getMediaInfo(newVal);
      }
    }
  },
  components: {
    AudioSlider,
    Xterm,
    Entry
  }
};
</script>

<style>
.container {
  padding: 25px 10px 10px;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}
.tabs {
  margin-bottom: 30px;
}
.cloumn {
  overflow: hidden;
}
.selecter {
  width: 50%;
  float: left;
}
.footer {
  text-align: center;
  margin-top: 20px;
}
</style>