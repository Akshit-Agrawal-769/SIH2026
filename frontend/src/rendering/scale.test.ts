import { describe, expect, it } from 'vitest';
import { formatTick, scalePosition, scaleTicks } from './scale';

describe('colour scale geometry', () => {
  it('linear positions', () => {
    expect(scalePosition(25, 20, 30, false)).toBeCloseTo(0.5);
    expect(scalePosition(10, 20, 30, false)).toBe(0);
    expect(scalePosition(NaN, 20, 30, false)).toBeNull();
  });

  it('log positions put a decade midpoint at the geometric mean', () => {
    // 0.1 .. 10 mg/m3: 1.0 is the middle of the log scale (a linear scale would put it at 9 %)
    expect(scalePosition(1, 0.1, 10, true)).toBeCloseTo(0.5);
    expect(scalePosition(1, 0.1, 10, false)).toBeCloseTo(0.0909, 3);
  });

  it('log ticks are geometric', () => {
    const t = scaleTicks(0.01, 100, true, 5);
    t.forEach((v, i) => expect(v).toBeCloseTo([0.01, 0.1, 1, 10, 100][i], 6));
    expect(scaleTicks(20, 30, false, 3)).toEqual([20, 25, 30]);
  });

  it('formats small values with significant digits', () => {
    expect(formatTick(0.0123)).toBe('0.012');
    expect(formatTick(28.123)).toBe('28.1');
    expect(formatTick(3.14159)).toBe('3.14');
  });
});
