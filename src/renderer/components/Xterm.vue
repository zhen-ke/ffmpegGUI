<template>
  <div class="xterm" ref="xterm"></div>
</template>

<script>
import * as os from "os";
import * as pty from "node-pty";
import { resolve } from "path";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { LigaturesAddon } from "xterm-addon-ligatures";

const cwdPath =
  process.env.NODE_ENV != "production" ? process.cwd() : process.resourcesPath;

// Initialize node-pty with an appropriate shell
const shell = process.env[os.platform() === "win32" ? "COMSPEC" : "SHELL"];

let xterm = null;

export default {
  props: {
    currentTab: {
      type: Boolean
    }
  },
  data() {
    return {};
  },
  methods: {
    init() {
      const fitAddon = new FitAddon();
      const ligaturesAddon = new LigaturesAddon();
      xterm = new Terminal({
        cursorStyle: "bar",
        fontSize: 12,
        experimentalCharAtlas: 'dynamic',
        fontFamily: "Monaco,Mono,Consolas,Liberation Mono,Menlo,monospace"
      });

      xterm.open(this.$refs.xterm);
      xterm.loadAddon(fitAddon);
      xterm.loadAddon(ligaturesAddon);
      fitAddon.fit();
      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: xterm.cols || 80,
        rows: xterm.rows || 30,
        cwd: cwdPath + "/core",
        env: process.env
      });

      // Setup communication between xterm.js and node-pty
      xterm.onData(data => ptyProcess.write(data));
      ptyProcess.on("data", function(data) {
        xterm.write(data);
      });
    }
  },
  watch: {
    currentTab(newVal, oldVal) {
      if (newVal && !xterm) {
        this.init();
      } else {
        // xterm.dispose();
      }
    }
  },
  mounted() {
    // this.init();
  }
};
</script>

<style>
</style>
