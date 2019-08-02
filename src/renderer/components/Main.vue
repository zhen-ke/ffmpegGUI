<template>
  <div class="container">
    <div class="dragBar" style="-webkit-app-region: drag"></div>
    <div class="tabs">
      <el-tabs type="border-card" v-model="activeTab" @tab-click="handleClick">
        <el-tab-pane name="video">
          <span slot="label">
            <i class="el-icon-video-play"></i> 视频
          </span>
          <div class="selecter">
            <el-input placeholder="请选择视频" v-model="video" :disabled="true">
              <template slot="prepend">
                <el-button type="primary" @click="showFileDialog('video')">选择视频</el-button>
              </template>
            </el-input>
          </div>
        </el-tab-pane>
        <el-tab-pane name="audio">
          <span slot="label">
            <i class="el-icon-headset"></i> 音频
          </span>
          <el-input placeholder="请选择音频" v-model="audio" :disabled="true">
            <template slot="prepend">
              <el-button type="primary" @click="showFileDialog('audio')">选择音频</el-button>
            </template>
          </el-input>
        </el-tab-pane>
        <el-tab-pane name="cutAudio">
          <span slot="label">
            <i class="el-icon-headset"></i> 切割音频
          </span>
          <el-input placeholder="请选择音频" v-model="audio" :disabled="true">
            <template slot="prepend">
              <el-button type="primary" @click="showFileDialog('audio')">选择音频</el-button>
            </template>
          </el-input>
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
          <el-input placeholder="请选择视频" v-model="video" :disabled="true">
            <template slot="prepend">
              <el-button type="primary" @click="showFileDialog('video')">选择视频</el-button>
            </template>
          </el-input>
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
          <div class="selecter">
            <el-input placeholder="请选择视频" v-model="video" :disabled="true">
              <template slot="prepend">
                <el-button type="primary" @click="showFileDialog('video')">选择视频</el-button>
              </template>
            </el-input>
          </div>
          <div class="selecter">
            <el-input placeholder="请选择音频" v-model="audio" :disabled="true">
              <template slot="prepend">
                <el-button type="primary" @click="showFileDialog('audio')">选择音频</el-button>
              </template>
            </el-input>
          </div>
        </el-tab-pane>
        <el-tab-pane name="gif">
          <span slot="label">
            <i class="el-icon-video-play"></i> 视频转gif
          </span>
          <div class="selecter">
            <el-input placeholder="请选择视频" v-model="video" :disabled="true">
              <template slot="prepend">
                <el-button type="primary" @click="showFileDialog('video')">选择视频</el-button>
              </template>
            </el-input>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    <div class="selecter">
      <el-input placeholder="请选择保存位置" v-model="save" :disabled="true">
        <template slot="prepend">
          <el-button type="primary" @click="showFileDialog('save')">保存位置</el-button>
        </template>
      </el-input>
    </div>
    <div class="progress" v-if="progress">
      <el-progress :text-inside="true" :stroke-width="20" :percentage="progress" color="#67C23A"></el-progress>
    </div>
    <div class="footer">
      <el-button type="primary" @click="startCommand()">转换</el-button>
      <el-button type="primary" @click="stopCommand()">中止</el-button>
    </div>
  </div>
</template>

<script>
import { sec_to_time, getProgress, dateNow, getFilename } from "@/utils/common";
import ChildProcessFFmpeg from "@/utils/core";
import AudioSlider from "@/components/AudioSlider";

let ffmpeg = new ChildProcessFFmpeg();

export default {
  data() {
    return {
      video: "",
      audio: "",
      save: "",
      progress: 0,
      activeTab: "video",
      duration: 0,
      cutAudioMarks: {},
      cutAudioValue: [0, 0]
    };
  },
  components: {
    AudioSlider
  },
  watch: {
    video(val, oldVal) {
      if (val) {
        console.log("video", val);
        this.videoPath = val;
        this.getMediaInfo(val);
      }
    },
    audio(val, oldVal) {
      if (val) {
        console.log("audio", val);
        this.audioPath = val;
        this.getMediaInfo(val);
      }
    }
  },
  methods: {
    // 切换 tabs
    handleClick(tab, event) {
      this.video = "";
      this.audio = "";
      this.cutAudioValue = [0, 0];
      this.cutAudioMarks = {};
    },
    // 消息通知
    msg(msg, type) {
      this.$message({
        message: msg,
        type
      });
    },
    // 读取文件路径 openDirectory：选择文件夹 openFile：选择文件
    showFileDialog(name) {
      const dialog = require("electron").remote.dialog;
      dialog.showOpenDialog(
        {
          properties: name === "save" ? ["openDirectory"] : ["openFile"]
        },
        filename => {
          if ((filename && filename.length) === 1) {
            this[name] = filename[0];
          }
        }
      );
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
    startConversion(command, format, time) {
      let inputPath = [];
      switch (command) {
        case "convertMerge":
          inputPath = [this.videoPath, this.audioPath];
          break;
        case "convertAudio":
          inputPath = [this.audioPath];
          break;
        case "convertCutAudio":
          inputPath = [this.audioPath];
          break;
        default:
          inputPath = [this.videoPath];
          break;
      }
      let params = {
        inputPath,
        outputPath: this.save,
        onProgress: this.onProgress,
        command,
        format,
        time
      };
      ffmpeg.convert({ ...params });
    },
    onProgress(data) {
      console.log(data);
      // this.progress = +data;
    },
    // 开始转码
    startCommand() {
      // 基于fluentFFmpeg的转码
      if (this.activeTab === "video") {
        if (this.video === "") {
          this.msg("视频路径为空", "warning");
          return;
        }
        this.startConversion("convertVideo", "mp4");
      }
      if (this.activeTab === "audio") {
        if (this.audio === "") {
          this.msg("音频路径为空", "warning");
          return;
        }
        this.startConversion("convertAudio", "mp3");
      }
      if (this.activeTab === "merge") {
        if (this.video === "") {
          this.msg("视频路径为空", "warning");
          return;
        }
        if (this.audio === "") {
          this.msg("音频路径为空", "warning");
          return;
        }
        this.startConversion("convertMerge", "mp4");
      }
      // 基于node子进程的转码
      if (this.activeTab === "cutAudio") {
        this.startConversion("convertCutAudio", "mp3", this.cutAudioValue);
      }
      if (this.activeTab === "cutVideo") {
        this.startConversion("convertCutVideo", "mp4", this.cutAudioValue);
      }
      if (this.activeTab === "gif") {
        this.startConversion("convertGIF", "gif");
        // let videoToGif = [
        //   "-i",
        //   this.video,
        //   "-s",
        //   "320x180",
        //   "-r",
        //   "15",
        //   `${this.save}/${this.filename}${dateNow()}.gif`
        // ];
        // this.coverTo(videoToGif);
      }
    },
    // 停止转码
    stopCommand() {
      ffmpeg.stop();
      this.progress = 0;
    }
  }
};
</script>

<style>
.container {
  padding: 25px 10px 10px;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}
.dragBar {
  height: 25px;
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
}
.tabs {
  margin-bottom: 30px;
}
.selecter {
  margin-bottom: 10px;
}
/* .selecter:last-child {
  margin-bottom: 0;
} */
.footer {
  text-align: center;
  margin-top: 20px;
}

.card .card-hd {
  float: left;
}
.card .card-hd img {
  vertical-align: top;
}
.el-tabs__content {
  min-height: 200px;
}
.slider {
  padding: 30px;
}
</style>