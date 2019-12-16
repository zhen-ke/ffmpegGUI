<template>
  <el-slider
    v-model="audioValue"
    range
    :max="duration"
    :marks="cutAudioMarks"
    @change="sliderChange"
  ></el-slider>
</template>

<script>
import { sec_to_time } from "@/utils/common";

export default {
  props: {
    cutAudioValue: {
      type: Array
    },
    cutAudioMarks: {
      type: Object
    },
    duration: {
      type: Number
    }
  },
  data() {
    return {};
  },
  computed: {
    audioValue: {
      get() {
        return this.cutAudioValue;
      },
      set(value) {
        this.$emit("update:cutAudioValue", value);
      }
    }
  },
  methods: {
    sliderChange([start, end]) {
      let s = Math.ceil(start);
      let e = Math.ceil(end);
      this.$emit("update:cutAudioMarks", {
        [s]: sec_to_time(start) + "",
        [e]: sec_to_time(end) + ""
      });
    }
  }
};
</script>

<style>
</style>
