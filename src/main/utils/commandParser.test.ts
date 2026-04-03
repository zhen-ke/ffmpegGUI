import {
  containsUnsupportedShellOperators,
  deriveWorkingDirectory,
  extractOutputFile,
  parseFFmpegCommand,
} from './commandParser';

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

  it('extracts output file from parsed args', () => {
    const args = parseFFmpegCommand('-i in.mp4 -c:v libx264 "out file.mp4"');
    expect(extractOutputFile(args)).toBe('out file.mp4');
  });

  it('does not treat stdout marker as output file', () => {
    const args = parseFFmpegCommand('-i in.mp4 -f null -');
    expect(extractOutputFile(args)).toBeUndefined();
  });

  it('prefers absolute output path when deriving working directory', () => {
    const args = parseFFmpegCommand(
      '-i "/tmp/input file.mp4" -c:v libx264 "/tmp/out/output file.mp4"',
    );

    expect(deriveWorkingDirectory(args)).toBe('/tmp/out');
  });

  it('falls back to first absolute input path when output is relative', () => {
    const args = parseFFmpegCommand(
      '-i "/tmp/input file.mp4" -i subtitles.srt -c copy output.mp4',
    );

    expect(deriveWorkingDirectory(args)).toBe('/tmp');
  });

  it('detects unsupported shell control operators', () => {
    const args = parseFFmpegCommand('-i in.mp4 out.mp4 && ffmpeg -version');
    expect(containsUnsupportedShellOperators(args)).toBe(true);
  });
});
