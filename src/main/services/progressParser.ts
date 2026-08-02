/**
 * 解析 `ffmpeg -progress pipe:1` 输出的结构化进度块。
 *
 * ffmpeg 以空行分隔的 key=value 块向 stdout 输出进度：
 * ```
 * frame=60
 * fps=0.00
 * out_time_us=2000000
 * out_time=00:00:02.000000
 * bitrate=N/A
 * progress=continue|end
 * ```
 * 优先取 `out_time_us`（微秒，最精确），回退 `out_time`（HH:MM:SS.ffffff）。
 * 无进度值时返回 NaN。
 */
export class ProgressBlockParser {
  private lines: string[] = [];

  /**
   * 喂入一行 stdout。遇到空行（块结束）时解析累积的 key=value，
   * 返回进度秒数；非块结束或无进度时返回 NaN。
   */
  push(line: string): number {
    const trimmed = line.trim();
    if (trimmed === '') {
      return this.flushBlock();
    }
    this.lines.push(trimmed);
    return NaN;
  }

  /** 进程退出时冲刷残余块（可能无结尾空行） */
  flush(): number {
    return this.flushBlock();
  }

  private flushBlock(): number {
    if (this.lines.length === 0) return NaN;

    const block = this.lines;
    this.lines = [];

    // 优先 out_time_us（微秒，最精确）
    for (const line of block) {
      const us = /^out_time_us=(\d+)$/.exec(line);
      if (us) {
        const micros = parseInt(us[1], 10);
        if (Number.isFinite(micros)) return micros / 1_000_000;
      }
    }
    // 回退 out_time（HH:MM:SS.ffffff）
    for (const line of block) {
      const t = /^out_time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(line);
      if (t) {
        const h = parseInt(t[1], 10);
        const m = parseInt(t[2], 10);
        const s = parseFloat(t[3]);
        if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s)) {
          return h * 3600 + m * 60 + s;
        }
      }
    }
    return NaN;
  }
}
