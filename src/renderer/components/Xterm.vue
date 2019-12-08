<template>
  <div class="xterm" ref="xterm"></div>
</template>

<script>
import { resolve } from "path";
import { FitAddon } from "xterm-addon-fit";
const os = require("os");
const pty = require("node-pty");
const Terminal = require("xterm").Terminal;
const cwdPath =
  process.env.NODE_ENV != "production" ? process.cwd() : process.resourcesPath;

// Initialize node-pty with an appropriate shell
const shell = process.env[os.platform() === "win32" ? "COMSPEC" : "SHELL"];

const ptyProcess = pty.spawn(shell, [], {
  name: "xterm-color",
  cols: 80,
  rows: 30,
  cwd: cwdPath + "/core",
  env: process.env
});

let xterm = null;

export default {
  props: {
    currentTab: {
      type: Boolean
    }
  },
  data() {
    return {
      xterm: null
    };
  },
  methods: {
    init() {
      xterm = new Terminal({
        cursorStyle: "bar",
        fontSize: 12,
        fontFamily: "Monaco,Mono,Consolas,Liberation Mono,Menlo,monospace"
      });

      // Initialize xterm.js and attach it to the DOM
      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.open(this.$refs.xterm);
      fitAddon.fit();
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
