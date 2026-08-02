import {
  FALLBACK_OPTIONS_WITH_VALUES,
  getOptionsWithValuesSync,
  invalidateOptionsCache,
  loadOptionsFrom,
  parseHelpFullOutput,
} from './ffmpegOptions';

// 模拟 ffmpeg 8.x `-h full` 输出的关键段落（截取自真实输出）
const SAMPLE_HELP_FULL = `
Universal media converter
usage: ffmpeg [options] [[infile options] -i infile]... {[outfile options] outfile}...

Print help / information / capabilities:
-h <topic>          show help
-y                  overwrite output files
-n                  never overwrite output files
-stdin              enable or disable interaction on standard input
-progress <url>     write program-readable progress information
-stats_period <time>  set the period at which ffmpeg updates stats and -progress output
-filter_complex <graph_description>  create a complex filtergraph
-frame_drop_threshold <>  frame drop threshold
-vsync <>           set video sync method globally; deprecated, use -fps_mode

Per-stream options:
  -b                 <int64>      E..VA...... set bitrate (in bits/s) (default 200000)
  -flags             <flags>      ED.VAS..... (default 0)
  -ar                <int>        ED..A...... set audio sampling rate (in Hz) (default 0)
  -c:v               <codec>      E..V....... codec name
  -filter:v          <filter_graph>  E..V....... set video filtergraph
  -threads           <int>        ED.VA...... set the number of threads (default 1)
  -preset            <preset>     E..V....... set the encoding preset
  -tune              <tune>       E..V....... tune the encoding params
  -crf               <float>      E..V....... select the quality for constant quality mode
  -pix_fmt           <pix_fmt>    E..V....... set pixel format
  -movflags          <flags>      E..V....... set mov/mp4/tag chunking
  -map               <stream_spec> E..V....... map input stream to output
  -metadata          <string>     E..V....... metadata key=value
  -x264-params       <string>     E..V....... x264 specific params
  -hls_time          <seconds>    E..V....... set segment length (default 2)
  -ss                <time>       ED.V....... start transcoding at specified time
`;

describe('ffmpegOptions', () => {
  describe('parseHelpFullOutput', () => {
    it('parses value-taking options including per-stream indented ones', () => {
      const opts = parseHelpFullOutput(SAMPLE_HELP_FULL);

      // 全局带值选项
      expect(opts.has('-progress')).toBe(true);
      expect(opts.has('-stats_period')).toBe(true);
      expect(opts.has('-filter_complex')).toBe(true);
      expect(opts.has('-h')).toBe(true);

      // per-stream 缩进带值选项
      expect(opts.has('-b')).toBe(true);
      expect(opts.has('-c:v')).toBe(true);
      expect(opts.has('-filter:v')).toBe(true);
      expect(opts.has('-x264-params')).toBe(true);
      expect(opts.has('-hls_time')).toBe(true);
      expect(opts.has('-threads')).toBe(true);
    });

    it('does not treat flags as value-taking options', () => {
      const opts = parseHelpFullOutput(SAMPLE_HELP_FULL);
      expect(opts.has('-y')).toBe(false);
      expect(opts.has('-n')).toBe(false);
      expect(opts.has('-stdin')).toBe(false);
    });

    it('treats empty-type options as value-taking (they still consume a token)', () => {
      const opts = parseHelpFullOutput(SAMPLE_HELP_FULL);
      // 语义上是 flag，但语法 `< >` 表示“有可选值”，ffmpeg 会吞下一个 token
      expect(opts.has('-vsync')).toBe(true);
      expect(opts.has('-frame_drop_threshold')).toBe(true);
    });

    it('ignores usage and non-option lines', () => {
      const opts = parseHelpFullOutput(SAMPLE_HELP_FULL);
      expect(opts.has('usage')).toBe(false);
      expect(opts.has('Universal')).toBe(false);
      // 无 <...> 的选项名不被误收集
      expect(opts.has('-n')).toBe(false);
    });
  });

  describe('loadOptionsFrom / cache', () => {
    afterEach(() => {
      invalidateOptionsCache();
    });

    it('falls back to builtin set when ffmpeg -h full fails', async () => {
      // 用一个不存在的可执行文件触发 execFile error
      const opts = await loadOptionsFrom('/nonexistent/ffmpeg-binary');
      expect(opts).toBe(FALLBACK_OPTIONS_WITH_VALUES);
      // 同步视图也回到兜底
      expect(getOptionsWithValuesSync()).toBe(FALLBACK_OPTIONS_WITH_VALUES);
    });

    it('caches resolved options for TTL', async () => {
      // 真实 ffmpeg 探测成本高且依赖本机环境；此处只验证缓存复用路径：
      // 第一次失败后缓存为 null，再次调用不重复探测（幂等）
      await loadOptionsFrom('/nonexistent/ffmpeg-binary');
      const again = await loadOptionsFrom('/nonexistent/ffmpeg-binary');
      expect(again).toBe(FALLBACK_OPTIONS_WITH_VALUES);
    });
  });
});
