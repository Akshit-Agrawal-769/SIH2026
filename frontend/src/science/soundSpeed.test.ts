import { describe, expect, it } from 'vitest';
import { mackenzieInRange, mackenzieSoundSpeed } from './soundSpeed';

describe('Mackenzie (1981) sound speed', () => {
  it('reproduces the published check value', () => {
    expect(mackenzieSoundSpeed(25, 35, 1000)).toBeCloseTo(1550.744, 3);
  });

  it('includes the cubic temperature term (truncated formula is ~5 m/s off at 28 °C)', () => {
    const truncated = 1448.96 + 4.591 * 28 - 0.05304 * 28 * 28 + 1.34 * (35 - 35) + 0.0163 * 5;
    expect(mackenzieSoundSpeed(28, 35, 5) - truncated).toBeGreaterThan(5);
  });

  it('reports validity range', () => {
    expect(mackenzieInRange(28, 35, 5)).toBe(true);
    expect(mackenzieInRange(1, 35, 5)).toBe(false);
  });
});
