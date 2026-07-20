import {
  deriveSetupReadiness,
  getSetupBlockerMessageKey,
} from './setupReadiness';

describe('deriveSetupReadiness', () => {
  const complete = {
    command: '-i input.mp4 -c:v libx264 output.mp4',
    inputFiles: ['/tmp/input.mp4'],
    outputFolder: '/tmp/out',
    outputFileName: 'output.mp4',
  };

  it('returns complete when all fields are set', () => {
    const result = deriveSetupReadiness(complete);
    expect(result.isSetupComplete).toBe(true);
    expect(result.blocker).toBeNull();
  });

  it('reports missing command first', () => {
    const result = deriveSetupReadiness({ ...complete, command: '  ' });
    expect(result.isSetupComplete).toBe(false);
    expect(result.blocker).toBe('command');
  });

  it('reports missing input', () => {
    const result = deriveSetupReadiness({ ...complete, inputFiles: [] });
    expect(result.blocker).toBe('input');
  });

  it('reports missing output folder', () => {
    const result = deriveSetupReadiness({ ...complete, outputFolder: '' });
    expect(result.blocker).toBe('outputFolder');
  });

  it('reports missing output name', () => {
    const result = deriveSetupReadiness({ ...complete, outputFileName: '' });
    expect(result.blocker).toBe('outputName');
  });
});

describe('getSetupBlockerMessageKey', () => {
  it('returns null when there is no blocker', () => {
    expect(getSetupBlockerMessageKey(null)).toBeNull();
  });

  it('returns a message key for each blocker', () => {
    expect(getSetupBlockerMessageKey('input')).toBe(
      'Select an input file to continue.',
    );
  });
});
