import { parseHardwareEncoders } from './HardwareEncoderService';

// 模拟 ffmpeg -encoders 输出（截取自真实输出）
const SAMPLE_ENCODERS = `
Encoders:
 V..... = Video
 A..... = Audio
 S..... = Subtitle
 .F.... = Frame-level multithreading
 ..S... = Slice-level multithreading
 ...X.. = Codec is experimental
 ....B. = Supports draw_horiz_band
 .....D = Supports direct rendering method 1
 ------
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
 V....D libx265              libx265 H.265 / HEVC (codec hevc)
 V....D libvpx-vp9           libvpx VP9 (codec vp9)
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder (codec h264)
 V....D hevc_videotoolbox    VideoToolbox H.265 Encoder (codec hevc)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V....D hevc_nvenc           NVIDIA NVENC HEVC encoder (codec hevc)
 V....D h264_qsv             H.264 / AVC (Intel Quick Sync Video acceleration) (codec h264)
 V....D hevc_amf             AMD AMF HEVC encoder (codec hevc)
 A....D aac                  AAC (Advanced Audio Coding)
 A....D libmp3lame           MP3 (MPEG audio layer 3) (codec mp3)
 V....D vp9_vaapi            VP9 VAAPI encoder (codec vp9)
`;

describe('HardwareEncoderService', () => {
  it('extracts hardware encoders and skips software ones', () => {
    const encoders = parseHardwareEncoders(SAMPLE_ENCODERS);
    expect(encoders.has('h264_videotoolbox')).toBe(true);
    expect(encoders.has('hevc_videotoolbox')).toBe(true);
    expect(encoders.has('h264_nvenc')).toBe(true);
    expect(encoders.has('hevc_nvenc')).toBe(true);
    expect(encoders.has('h264_qsv')).toBe(true);
    expect(encoders.has('hevc_amf')).toBe(true);
    expect(encoders.has('vp9_vaapi')).toBe(true);
  });

  it('does not treat software encoders as hardware', () => {
    const encoders = parseHardwareEncoders(SAMPLE_ENCODERS);
    expect(encoders.has('libx264')).toBe(false);
    expect(encoders.has('libx264rgb')).toBe(false);
    expect(encoders.has('libx265')).toBe(false);
    expect(encoders.has('libvpx-vp9')).toBe(false);
    expect(encoders.has('aac')).toBe(false);
    expect(encoders.has('libmp3lame')).toBe(false);
  });

  it('ignores header lines and empty output', () => {
    expect(
      parseHardwareEncoders('Encoders:\n V..... = Video\n ------\n').size,
    ).toBe(0);
    expect(parseHardwareEncoders('').size).toBe(0);
  });
});
