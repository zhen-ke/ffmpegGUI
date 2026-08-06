import { hasUpdate, parseVersion } from './version';

describe('parseVersion', () => {
  it('parses numeric version from messy strings', () => {
    expect(parseVersion('7.1.1 (OSXExperts)')).toEqual([7, 1, 1]);
    expect(parseVersion('6.1.1-full_build-www.gyan.dev')).toEqual([6, 1, 1]);
    expect(parseVersion('7.1')).toEqual([7, 1]);
  });

  it('returns null for unparseable input', () => {
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('')).toBeNull();
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });
});

describe('hasUpdate', () => {
  it('detects newer / equal / older', () => {
    expect(hasUpdate('7.1.1', '7.0.1')).toBe(true);
    expect(hasUpdate('7.1.1', '7.1.1')).toBe(false);
    expect(hasUpdate('6.1.1', '7.0.1')).toBe(false);
    expect(hasUpdate('7.1', '7.0.1')).toBe(true); // 缺位视为 0
    expect(hasUpdate('7.1', '7.1.1')).toBe(false);
  });

  it('conservatively reports update when a version is unparseable', () => {
    expect(hasUpdate('latest', '7.0.1')).toBe(true);
    expect(hasUpdate('7.1.1', null)).toBe(true);
    expect(hasUpdate(null, '7.0.1')).toBe(true);
    expect(hasUpdate('latest', null)).toBe(true);
  });
});
