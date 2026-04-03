import {
  countInputArguments,
  parseInputArguments,
  parseOutputFileName,
  updateInputArgument,
  updateCommandPaths,
} from './commandUtils';

describe('commandUtils', () => {
  describe('countInputArguments', () => {
    it('counts all -i arguments', () => {
      const command = '-i input1.mp4 -i input2.mp4 -c copy output.mp4';
      expect(countInputArguments(command)).toBe(2);
    });
  });

  describe('parseInputArguments', () => {
    it('returns all input arguments in order', () => {
      const command = '-i "main clip.mp4" -i overlay.mov -c copy output.mp4';

      expect(parseInputArguments(command)).toEqual([
        'main clip.mp4',
        'overlay.mov',
      ]);
    });
  });

  describe('parseOutputFileName', () => {
    it('falls back to default when command ends with input path', () => {
      expect(parseOutputFileName('-i input.mp4')).toBe('output.mp4');
    });

    it('parses output filename from the last token', () => {
      expect(parseOutputFileName('-i input.mp4 -c copy result.mkv')).toBe(
        'result.mkv',
      );
    });
  });

  describe('updateCommandPaths', () => {
    it('replaces only one input path when command has multiple -i', () => {
      const command = '-i input1.mp4 -i second.mp4 -c copy output.mp4';
      const updated = updateCommandPaths(
        command,
        '/tmp/new-input.mp4',
        '/tmp/output',
      );

      expect(updated).toBe(
        '-i "/tmp/new-input.mp4" -i second.mp4 -c copy "/tmp/output/output.mp4"',
      );
    });

    it('replaces multiple input paths by index', () => {
      const command =
        '-i main.mp4 -i overlay.mp4 -filter_complex overlay out.mp4';
      const updated = updateCommandPaths(command, [
        '/tmp/main.mp4',
        '/tmp/overlay.mov',
      ]);

      expect(updated).toBe(
        '-i "/tmp/main.mp4" -i "/tmp/overlay.mov" -filter_complex overlay out.mp4',
      );
    });

    it('appends output path when output is missing', () => {
      const command = '-i input.mp4';
      const updated = updateCommandPaths(command, undefined, '/tmp/output');

      expect(updated).toBe('-i input.mp4 "/tmp/output/output.mp4"');
    });

    it('does not overwrite trailing option values when output is missing', () => {
      const command = '-i input.mp4 -map 0:v';
      const updated = updateCommandPaths(command, undefined, '/tmp/output');

      expect(updated).toBe('-i input.mp4 -map 0:v "/tmp/output/output.mp4"');
    });
  });

  describe('updateInputArgument', () => {
    it('updates a specific input argument', () => {
      const command = '-i main.mp4 -i overlay.mp4 -c copy output.mp4';

      expect(updateInputArgument(command, 1, '/tmp/overlay.mov')).toBe(
        '-i main.mp4 -i "/tmp/overlay.mov" -c copy output.mp4',
      );
    });

    it('restores a placeholder when clearing an input argument', () => {
      const command = '-i "/tmp/main.mp4" -i "/tmp/subtitles.srt" output.mp4';

      expect(updateInputArgument(command, 1)).toBe(
        '-i "/tmp/main.mp4" -i input2.srt output.mp4',
      );
    });
  });
});
