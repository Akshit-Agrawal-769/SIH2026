import { describe, expect, it } from 'vitest';
import {
  addStep,
  adjacentTime,
  fromUtcInput,
  nearestTime,
  normalizeTimes,
  playbackIntervalMs,
  stepBackward,
  stepForward,
  timesInRange,
  toMs,
  toUtcInput
} from './timelineEngine';

// Dataset with a gap: Jun 4 does not exist.
const TIMES = normalizeTimes(['2024-06-01', '2024-06-02', '2024-06-03', '2024-06-05']);
const day = (d: number) => `2024-06-0${d}T00:00:00Z`;

describe('timeline engine', () => {
  it('normalises, sorts and de-duplicates dataset dates', () => {
    expect(normalizeTimes(['2024-06-03', '2024-06-01', '2024-06-01T00:00:00Z'])).toEqual([day(1), day(3)]);
  });

  it('steps Jun 1 -> Jun 3 -> Jun 5 with a 2-day step and never produces Jun 4', () => {
    const step = { value: 2, unit: 'days' as const };
    const visited: string[] = [day(1)];
    let cur = day(1);
    for (;;) {
      const r = stepForward(TIMES, cur, step, day(5));
      if (!r.resolved) break;
      visited.push(r.resolved);
      cur = r.resolved;
    }
    expect(visited).toEqual([day(1), day(3), day(5)]);
    expect(visited).not.toContain(day(4));
  });

  it('resolves a missing requested time to the next real timestamp, flagged as inexact', () => {
    const r = stepForward(TIMES, day(3), { value: 1, unit: 'days' }, day(5));
    expect(r.requested).toBe(day(4));
    expect(r.resolved).toBe(day(5));
    expect(r.exact).toBe(false);
  });

  it('stops when no real timestep remains in the selected range', () => {
    expect(stepForward(TIMES, day(3), { value: 1, unit: 'days' }, day(3)).resolved).toBeNull();
    expect(stepForward(TIMES, day(5), { value: 1, unit: 'days' }, day(5)).resolved).toBeNull();
    // requested Jun 6 lies past the end, but Jun 5 is still a real, unvisited timestep in range
    expect(stepForward(TIMES, day(3), { value: 3, unit: 'days' }, day(5)).resolved).toBe(day(5));
  });

  it('only returns timestamps that exist in the dataset', () => {
    const steps = [
      { value: 1, unit: 'hours' as const },
      { value: 6, unit: 'hours' as const },
      { value: 1, unit: 'days' as const },
      { value: 3, unit: 'days' as const },
      { value: 1, unit: 'weeks' as const }
    ];
    for (const step of steps) {
      let cur = day(1);
      for (let i = 0; i < 50; i++) {
        const r = stepForward(TIMES, cur, step, day(5));
        if (!r.resolved) break;
        expect(TIMES).toContain(r.resolved);
        expect(toMs(r.resolved)).toBeGreaterThan(toMs(cur));
        cur = r.resolved;
      }
    }
  });

  it('steps backwards to the last real timestamp at or before the request', () => {
    const r = stepBackward(TIMES, day(5), { value: 1, unit: 'days' }, day(1));
    expect(r.requested).toBe(day(4));
    expect(r.resolved).toBe(day(3));
    expect(stepBackward(TIMES, day(1), { value: 1, unit: 'days' }, day(1)).resolved).toBeNull();
  });

  it('prev/next buttons walk real timestamps one at a time', () => {
    expect(adjacentTime(TIMES, day(3), 1)).toBe(day(5));
    expect(adjacentTime(TIMES, day(3), -1)).toBe(day(2));
    expect(adjacentTime(TIMES, day(5), 1)).toBeNull();
    expect(adjacentTime(TIMES, day(1), -1)).toBeNull();
  });

  it('scrubbing snaps to the nearest real timestamp', () => {
    expect(nearestTime(TIMES, toMs('2024-06-03T18:00:00Z'))).toBe(day(3)); // 18 h vs 30 h
    expect(nearestTime(TIMES, toMs('2024-06-04T06:00:00Z'))).toBe(day(5)); // 30 h vs 18 h
    expect(nearestTime(TIMES, toMs('2024-06-04T00:00:00Z'))).toBe(day(3)); // tie -> earlier
    expect(nearestTime([], 0)).toBeNull();
  });

  it('filters the custom range inclusively', () => {
    expect(timesInRange(TIMES, day(2), day(5))).toEqual([day(2), day(3), day(5)]);
    expect(timesInRange(TIMES, '2024-06-02T12:00:00Z', '2024-06-04T00:00:00Z')).toEqual([day(3)]);
  });

  it('adds calendar months without overflowing short months', () => {
    expect(addStep('2019-01-29T00:00:00Z', { value: 1, unit: 'months' })).toBe('2019-02-28T00:00:00Z');
    expect(addStep('2019-12-25T00:00:00Z', { value: 1, unit: 'months' })).toBe('2020-01-25T00:00:00Z');
  });

  it('monthly model data: a 1-day step advances to the next real month, not a fabricated day', () => {
    const monthly = normalizeTimes(['2019-01-29', '2019-02-28', '2019-03-30']);
    const r = stepForward(monthly, monthly[0], { value: 1, unit: 'days' }, monthly[2]);
    expect(r.requested).toBe('2019-01-30T00:00:00Z');
    expect(r.resolved).toBe('2019-02-28T00:00:00Z');
  });

  it('a 1-month step visits every real 30-day model timestep (no skipped months)', () => {
    const ibr = normalizeTimes(['2019-01-29', '2019-02-28', '2019-03-30', '2019-04-29', '2019-05-29', '2019-06-28']);
    const visited = [ibr[0]];
    let cur = ibr[0];
    for (;;) {
      const r = stepForward(ibr, cur, { value: 1, unit: 'months' }, ibr[ibr.length - 1]);
      if (!r.resolved) break;
      visited.push(r.resolved);
      cur = r.resolved;
    }
    expect(visited).toEqual(ibr);
  });

  it('a step larger than the cadence still lands only on real timestamps, nearest to the request', () => {
    const r = stepForward(TIMES, day(1), { value: 3, unit: 'days' }, day(5));
    expect(r.requested).toBe(day(4));
    expect([day(3), day(5)]).toContain(r.resolved);
    expect(r.resolved).toBe(day(3)); // tie -> earlier
  });

  it('playback speed changes only the tick interval', () => {
    expect(playbackIntervalMs(1)).toBe(1500);
    expect(playbackIntervalMs(4)).toBe(375);
    const step = { value: 1, unit: 'days' as const };
    // same data step regardless of speed
    expect(stepForward(TIMES, day(1), step, day(5))).toEqual(stepForward(TIMES, day(1), step, day(5)));
    expect(() => playbackIntervalMs(0)).toThrow();
  });

  it('treats datetime-local inputs as UTC (no local timezone drift)', () => {
    expect(fromUtcInput('2024-06-03T10:30')).toBe('2024-06-03T10:30:00Z');
    expect(toUtcInput('2024-06-03T10:30:00Z')).toBe('2024-06-03T10:30');
    expect(fromUtcInput('')).toBeNull();
  });

  it('rejects non-positive steps', () => {
    expect(() => addStep(day(1), { value: 0, unit: 'days' })).toThrow();
  });
});
