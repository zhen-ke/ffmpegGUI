import {
  containsUnsupportedShellOperators,
  deriveWorkingDirectory,
  extractOutputFile,
  parseFFmpegCommand,
  splitCommandChain,
} from './commandParser';
import { FALLBACK_OPTIONS_WITH_VALUES } from './ffmpegOptions';

// 测试环境无 electron/ffmpeg，注入内置兜底集合，避免 extractOutputFile 走异步路径
const OPTS = FALLBACK_OPTIONS_WITH_VALUES;

describe('commandParser', () => {
  it('parses quoted paths without keeping quote characters', () => {
    const args = parseFFmpegCommand(
      'ffmpeg -i "/tmp/input file.mp4" -c:v libx264 "/tmp/output file.mp4"',
    );

    expect(args).toEqual([
      '-i',
      '/tmp/input file.mp4',
      '-c:v',
      'libx264',
      '/tmp/output file.mp4',
    ]);
  });

  it('keeps filter expressions as a single argument', () => {
    const args = parseFFmpegCommand(
      '-i in.mp4 -vf "fps=10,scale=320:-2:flags=lanczos" out.gif',
    );

    expect(args).toEqual([
      '-i',
      'in.mp4',
      '-vf',
      'fps=10,scale=320:-2:flags=lanczos',
      'out.gif',
    ]);
  });

  it('keeps backslashes in Windows-style paths', () => {
    const args = parseFFmpegCommand(
      'ffmpeg -i "C:\\Videos\\input file.mp4" "C:\\Videos\\output file.mp4"',
    );

    expect(args).toEqual([
      '-i',
      'C:\\Videos\\input file.mp4',
      'C:\\Videos\\output file.mp4',
    ]);
  });

  it('throws when quotes are unmatched', () => {
    expect(() => parseFFmpegCommand('-i "in.mp4 out.mp4')).toThrow(
      'Unmatched quotes in command',
    );
  });

  it('extracts output file from parsed args', async () => {
    const args = parseFFmpegCommand('-i in.mp4 -c:v libx264 "out file.mp4"');
    expect(await extractOutputFile(args, OPTS)).toBe('out file.mp4');
  });

  it('does not treat stdout marker as output file', async () => {
    const args = parseFFmpegCommand('-i in.mp4 -f null -');
    expect(await extractOutputFile(args, OPTS)).toBeUndefined();
  });

  it('prefers first absolute input dir over output dir for working directory', () => {
    // 辅助输入（字幕/水印/列表）通常与主输入同目录，cwd 用输入目录更直觉；
    // 输出已被 GUI 改为绝对路径，cwd 不影响输出写入位置。
    const args = parseFFmpegCommand(
      '-i "/tmp/input file.mp4" -c:v libx264 "/tmp/out/output file.mp4"',
    );

    expect(deriveWorkingDirectory(args)).toBe('/tmp');
  });

  it('resolves relative aux inputs against the main input dir, not output dir', () => {
    // 复现 P0-2：第二输入 subtitles.srt 为相对路径，输出为绝对路径。
    // 旧逻辑 cwd=输出目录 → ffmpeg 在输出目录找 subtitles.srt 失败；
    // 新逻辑 cwd=主输入目录 → 与主视频同目录查找。
    const args = parseFFmpegCommand(
      '-i "/tmp/input file.mp4" -i subtitles.srt -c copy "/tmp/out/output.mp4"',
    );

    expect(deriveWorkingDirectory(args)).toBe('/tmp');
  });

  it('falls back to first absolute input path when output is relative', () => {
    const args = parseFFmpegCommand(
      '-i "/tmp/input file.mp4" -i subtitles.srt -c copy output.mp4',
    );

    expect(deriveWorkingDirectory(args)).toBe('/tmp');
  });

  it('allows && chaining but rejects other shell operators', () => {
    // && 是受支持的顺序执行链
    expect(
      containsUnsupportedShellOperators(
        parseFFmpegCommand('-i in.mp4 out.mp4 && ffmpeg -version'),
      ),
    ).toBe(false);

    // 管道 / 分号 / 重定向 / || 仍被拒绝
    expect(
      containsUnsupportedShellOperators(
        parseFFmpegCommand('-i in.mp4 | ffmpeg -'),
      ),
    ).toBe(true);
    expect(
      containsUnsupportedShellOperators(
        parseFFmpegCommand('-i in.mp4 ; ffmpeg -'),
      ),
    ).toBe(true);
    expect(
      containsUnsupportedShellOperators(
        parseFFmpegCommand('-i in.mp4 > out.txt'),
      ),
    ).toBe(true);
    expect(
      containsUnsupportedShellOperators(
        parseFFmpegCommand('-i a.mp4 || ffmpeg -i b.mp4'),
      ),
    ).toBe(true);
  });

  it('splits command chain by && into segments', () => {
    const segments = splitCommandChain(
      parseFFmpegCommand(
        '-i in.mp4 -c:v libx264 out.mp4 && ffmpeg -i out.mp4 -vf scale=320:240 thumb.jpg',
      ),
    );

    expect(segments).toEqual([
      ['-i', 'in.mp4', '-c:v', 'libx264', 'out.mp4'],
      ['ffmpeg', '-i', 'out.mp4', '-vf', 'scale=320:240', 'thumb.jpg'],
    ]);
  });

  it('splits chain and strips empty segments', () => {
    const segments = splitCommandChain(
      parseFFmpegCommand('-i a.mp4 out.mp4 && && ffmpeg -i b.mp4 out2.mp4'),
    );
    expect(segments).toEqual([
      ['-i', 'a.mp4', 'out.mp4'],
      ['ffmpeg', '-i', 'b.mp4', 'out2.mp4'],
    ]);
  });

  it('returns single segment when no && present', () => {
    const segments = splitCommandChain(
      parseFFmpegCommand('-i a.mp4 -c:v libx264 out.mp4'),
    );
    expect(segments).toEqual([['-i', 'a.mp4', '-c:v', 'libx264', 'out.mp4']]);
  });

  // ── P1-5: OPTIONS_WITH_VALUES 补全与 flag 移除 ──────────────────────

  it('does not mistake -vframes value for output file', async () => {
    // -vframes 带值，其后的 `1` 是选项值，不是输出文件
    expect(
      await extractOutputFile(
        parseFFmpegCommand('-i input.mp4 -vframes 1'),
        OPTS,
      ),
    ).toBeUndefined();
  });

  it('does not mistake -vol value for output file', async () => {
    // 复现：-vol 256 无输出文件，旧逻辑误判 `256` 为输出文件
    expect(
      await extractOutputFile(
        parseFFmpegCommand('-i input.mp3 -vol 256'),
        OPTS,
      ),
    ).toBeUndefined();
  });

  it('detects output after -an flag (Remove Audio template)', async () => {
    // -an 是不带值的 flag，移出 OPTIONS_WITH_VALUES 后不再吞掉其后的输出文件
    const args = parseFFmpegCommand(
      '-i input.mp4 -c:v copy -an output_no_audio.mp4',
    );
    expect(await extractOutputFile(args, OPTS)).toBe('output_no_audio.mp4');
  });

  it('does not mistake dynamic-table option value for output file', async () => {
    // -x264-params / -hls_time 不在旧硬编码表里；动态表应识别为带值选项
    const args = parseFFmpegCommand(
      '-i input.mp4 -c:v libx264 -x264-params "keyint=250:min-keyint=25" out.mp4',
    );
    expect(await extractOutputFile(args, OPTS)).toBe('out.mp4');
  });

  it('does not mistake -hls_time value for output file (HLS template)', async () => {
    const args = parseFFmpegCommand(
      '-i input.mp4 -hls_time 10 -hls_list_size 0 -f hls playlist.m3u8',
    );
    expect(await extractOutputFile(args, OPTS)).toBe('playlist.m3u8');
  });
});
