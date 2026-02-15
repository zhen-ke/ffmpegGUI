import {
  countInputArguments,
  parseOutputFileName,
  updateCommandPaths,
} from './commandUtils';

describe('commandUtils', () => {
  describe('countInputArguments', () => {
    it('counts all -i arguments', () => {
      const command = '-i input1.mp4 -i input2.mp4 -c copy output.mp4';
      expect(countInputArguments(command)).toBe(2);
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

    it('prefers replacing placeholder input', () => {
      const command = '-i "already-set.mp4" -i input2.mp4 output.mp4';
      const updated = updateCommandPaths(command, '/tmp/new-input.mp4');

      expect(updated).toBe(
        '-i "already-set.mp4" -i "/tmp/new-input.mp4" output.mp4',
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
});
