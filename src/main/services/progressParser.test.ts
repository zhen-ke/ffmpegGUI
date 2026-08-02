import { ProgressBlockParser } from './progressParser';

describe('ProgressBlockParser', () => {
  it('parses out_time_us (microseconds, most precise)', () => {
    const p = new ProgressBlockParser();
    p.push('frame=60');
    p.push('fps=0.00');
    p.push('out_time_us=2000000');
    p.push('out_time=00:00:02.000000');
    p.push('progress=end');
    const time = p.push(''); // 空行 = 块结束
    expect(time).toBeCloseTo(2.0, 6);
  });

  it('parses out_time when out_time_us is absent', () => {
    const p = new ProgressBlockParser();
    p.push('frame=30');
    p.push('out_time=00:01:23.500000');
    const time = p.push('');
    expect(time).toBeCloseTo(83.5, 6);
  });

  it('returns NaN when no progress keys present', () => {
    const p = new ProgressBlockParser();
    p.push('frame=0');
    p.push('bitrate=N/A');
    const time = p.push('');
    expect(Number.isNaN(time)).toBe(true);
  });

  it('flushes a trailing block without end blank line', () => {
    const p = new ProgressBlockParser();
    p.push('frame=10');
    p.push('out_time_us=500000');
    const time = p.flush();
    expect(time).toBeCloseTo(0.5, 6);
  });

  it('handles N/A bitrate and padded speed lines', () => {
    const p = new ProgressBlockParser();
    p.push('bitrate=N/A');
    p.push('speed= 564x');
    p.push('out_time_us=12345678');
    const time = p.push('');
    expect(time).toBeCloseTo(12.345678, 6);
  });

  it('returns NaN on flush with empty buffer', () => {
    const p = new ProgressBlockParser();
    expect(Number.isNaN(p.flush())).toBe(true);
  });

  it('resets buffer between blocks', () => {
    const p = new ProgressBlockParser();
    p.push('out_time_us=1000000');
    expect(p.push('')).toBeCloseTo(1.0, 6);
    // 下一块不残留旧行
    p.push('out_time_us=2000000');
    expect(p.push('')).toBeCloseTo(2.0, 6);
  });
});
