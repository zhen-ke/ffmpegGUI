<template>
  <div ref="drop" class="dropify-wrapper" @click="showFileDialog">
    <div class="dropify-message">{{message}}</div>
  </div>
</template>

<script>
export default {
  props: {
    name: {
      type: String
    }
  },
  data() {
    return {
      message: "点击或将文件拖拽到至此处"
    };
  },
  methods: {
    // 拖拽文件
    drop() {
      const drop = this.$refs.drop;

      drop.ondragover = () => {
        return false;
      };
      drop.ondragleave = drop.ondragend = () => {
        return false;
      };
      drop.ondrop = e => {
        e.preventDefault();
        for (let f of e.dataTransfer.files) {
          this.message = "已选择文件：" + f.path;
          this.$emit("updateTypesPath", f.path, this.name);
        }
        return false;
      };
    },
    // 读取文件路径 （openDirectory：选择文件夹 、openFile：选择文件）
    showFileDialog(name = "file") {
      const dialog = require("electron").remote.dialog;
      dialog.showOpenDialog(
        {
          properties: name === "save" ? ["openDirectory"] : ["openFile"]
        },
        filename => {
          if ((filename && filename.length) === 1) {
            // this[name] = filename[0];
            this.message = "已选择文件：" + filename[0];
            this.$emit("updateTypesPath", filename[0], this.name);
          }
        }
      );
    }
  },
  mounted() {
    this.drop();
  }
};
</script>

<style scoped>
.dropify-wrapper {
  min-height: 190px;
  max-width: 100%;
  font-size: 14px;
  padding: 20px 10px;
  color: #777;
  background-color: #fff;
  text-align: center;
  border: 2px dashed #e5e5e5;
}
</style>