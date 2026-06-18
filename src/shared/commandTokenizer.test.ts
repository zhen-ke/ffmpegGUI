import { stripSurroundingQuotes, tokenize } from './commandTokenizer';

describe('commandTokenizer', () => {
  describe('tokenize (strip mode, default)', () => {
    it('splits on whitespace', () => {
      expect(tokenize('-i input.mp4 -c copy out.mp4').tokens).toEqual([
        '-i',
        'input.mp4',
        '-c',
        'copy',
        'out.mp4',
      ]);
    });

    it('keeps quoted spaces as a single token and strips the quotes', () => {
      const { tokens } = tokenize('-i "/tmp/input file.mp4" out.mp4');
      expect(tokens).toEqual(['-i', '/tmp/input file.mp4', 'out.mp4']);
    });

    it('handles single-quoted tokens', () => {
      const { tokens } = tokenize("-i '/tmp/input file.mp4' out.mp4");
      expect(tokens).toEqual(['-i', '/tmp/input file.mp4', 'out.mp4']);
    });

    it('unescapes escaped double quotes inside double-quoted regions', () => {
      // \" → literal "; \\ preserved as backslash
      const { tokens } = tokenize('-i "C:\\Videos\\" fancy\\".mp4" out.mp4');
      expect(tokens).toEqual(['-i', 'C:\\Videos" fancy".mp4', 'out.mp4']);
    });

    it('keeps backslashes literal inside double quotes when not escaping', () => {
      // Note: tokenize does NOT strip a leading "ffmpeg"; that is parseFFmpegCommand's job.
      const { tokens } = tokenize(
        'ffmpeg -i "C:\\Videos\\input file.mp4" "C:\\Videos\\output file.mp4"',
      );
      expect(tokens).toEqual([
        'ffmpeg',
        '-i',
        'C:\\Videos\\input file.mp4',
        'C:\\Videos\\output file.mp4',
      ]);
    });

    it('keeps backslashes literal inside single quotes', () => {
      const { tokens } = tokenize("-i 'C:\\path\\file.mp4' out.mp4");
      expect(tokens).toEqual(['-i', 'C:\\path\\file.mp4', 'out.mp4']);
    });

    it('ignores empty tokens (consecutive spaces)', () => {
      expect(tokenize('  -i    input.mp4  ').tokens).toEqual([
        '-i',
        'input.mp4',
      ]);
    });

    it('reports unmatched double quote', () => {
      expect(tokenize('-i "in.mp4 out.mp4').unmatchedQuote).toBe(true);
    });

    it('reports unmatched single quote', () => {
      expect(tokenize("-i 'in.mp4 out.mp4").unmatchedQuote).toBe(true);
    });

    it('reports matched quotes as not unmatched', () => {
      expect(tokenize('-i "in.mp4" out.mp4').unmatchedQuote).toBe(false);
    });
  });

  describe('tokenize (preserveQuotes mode)', () => {
    it('preserves the surrounding quotes on each quoted token', () => {
      const { tokens } = tokenize('-i "/tmp/input file.mp4" out.mp4', {
        preserveQuotes: true,
      });
      expect(tokens).toEqual(['-i', '"/tmp/input file.mp4"', 'out.mp4']);
    });

    it('preserves single quotes too', () => {
      const { tokens } = tokenize("-i '/tmp/input file.mp4' out.mp4", {
        preserveQuotes: true,
      });
      expect(tokens).toEqual(['-i', "'/tmp/input file.mp4'", 'out.mp4']);
    });

    it('leaves unquoted tokens untouched', () => {
      const { tokens } = tokenize('-i input.mp4 -c copy out.mp4', {
        preserveQuotes: true,
      });
      expect(tokens).toEqual(['-i', 'input.mp4', '-c', 'copy', 'out.mp4']);
    });

    it('still reports unmatched quotes in preserve mode', () => {
      expect(
        tokenize('-i "in.mp4 out.mp4', { preserveQuotes: true }).unmatchedQuote,
      ).toBe(true);
    });

    it('correctly tokenizes escaped quotes where the old regex failed', () => {
      // The previous regex tokenizer ("[^"]*") would truncate at the first \"
      // The character-level parser handles this correctly.
      const { tokens } = tokenize('-i "say \\"hello\\".mp4" out.mp4', {
        preserveQuotes: true,
      });
      // The escaped inner quotes are preserved in raw form (with backslashes)
      expect(tokens).toEqual(['-i', '"say \\"hello\\".mp4"', 'out.mp4']);
    });
  });

  describe('stripSurroundingQuotes', () => {
    it('strips a matching pair of double quotes', () => {
      expect(stripSurroundingQuotes('"hello"')).toBe('hello');
    });

    it('strips a matching pair of single quotes', () => {
      expect(stripSurroundingQuotes("'hello'")).toBe('hello');
    });

    it('returns unchanged when quotes do not match', () => {
      expect(stripSurroundingQuotes('"hello\'')).toBe('"hello\'');
    });

    it('returns unchanged when too short to be quoted', () => {
      expect(stripSurroundingQuotes('"')).toBe('"');
      expect(stripSurroundingQuotes('')).toBe('');
    });
  });
});
