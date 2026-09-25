/**
 * Timeline engine: pure functions over the list of timestamps that actually exist in a
 * dataset. Nothing here creates a timestamp that is not in `times`.
 *
 *  - TIME STEP moves the *requested* time; the result is resolved to a real timestamp.
 *  - PLAYBACK SPEED only changes how often a step is taken (see playbackIntervalMs).
 */

export type StepUnit = 'hours' | 'days' | 'weeks' | 'months';

export interface TimeStep {
  value: number;
  unit: StepUnit;
}

export interface StepResult {
  /** Time requested by current + step (may not exist in the dataset). */
  requested: string;
  /** Real dataset timestamp the request resolved to, or null when the range is exhausted. */
  resolved: string | null;
  /** True when the requested time existed exactly. */
  exact: boolean;
}

const HOUR = 3_600_000;

export function toMs(iso: string): number {
  const ms = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp '${iso}'`);
  return ms;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

/** Normalise dataset dates ('YYYY-MM-DD' or ISO) to sorted, unique ISO UTC strings. */
export function normalizeTimes(times: string[]): string[] {
  return Array.from(new Set(times.map((t) => toIso(toMs(t))))).sort((a, b) => toMs(a) - toMs(b));
}

export function addStep(iso: string, step: TimeStep, direction: 1 | -1 = 1): string {
  if (!(step.value > 0) || !Number.isFinite(step.value)) throw new Error('Time step must be a positive number');
  const ms = toMs(iso);
  const n = step.value * direction;
  switch (step.unit) {
    case 'hours':
      return toIso(ms + n * HOUR);
    case 'days':
      return toIso(ms + n * 24 * HOUR);
    case 'weeks':
      return toIso(ms + n * 7 * 24 * HOUR);
    case 'months': {
      const d = new Date(ms);
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, d.getUTCHours(), d.getUTCMinutes()));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
      return toIso(target.getTime());
    }
  }
}

/** Real timestamps inside [start, end] (inclusive). */
export function timesInRange(times: string[], start: string, end: string): string[] {
  const s = toMs(start);
  const e = toMs(end);
  return times.filter((t) => {
    const ms = toMs(t);
    return ms >= s && ms <= e;
  });
}

/**
 * Pick, among real timestamps strictly after `current` (or before, when stepping back) and
 * inside the range, the one closest to the requested time. Ties go to the earlier timestamp.
 * This never invents a time, never repeats or reverses, and does not skip real timesteps
 * when the dataset cadence (e.g. 30-day model output) differs slightly from calendar steps.
 */
function resolveNearestBeyond(times: string[], current: string, requested: string, lo: number, hi: number, forward: boolean): string | null {
  const cur = toMs(current);
  const req = toMs(requested);
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const t of times) {
    const ms = toMs(t);
    if (ms < lo || ms > hi) continue;
    if (forward ? ms <= cur : ms >= cur) continue;
    const diff = Math.abs(ms - req);
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best;
}

/** Advance from `current` by `step`, resolved to a real timestamp in (current, end]. */
export function stepForward(times: string[], current: string, step: TimeStep, end: string): StepResult {
  const requested = addStep(current, step, 1);
  // Stops only when no real timestep remains in (current, end].
  const resolved = resolveNearestBeyond(times, current, requested, -Infinity, toMs(end), true);
  return { requested, resolved, exact: resolved !== null && toMs(resolved) === toMs(requested) };
}

/** Step backwards, resolved to a real timestamp in [start, current). */
export function stepBackward(times: string[], current: string, step: TimeStep, start: string): StepResult {
  const requested = addStep(current, step, -1);
  const resolved = resolveNearestBeyond(times, current, requested, toMs(start), Infinity, false);
  return { requested, resolved, exact: resolved !== null && toMs(resolved) === toMs(requested) };
}

/** Neighbouring real timestamp (for previous / next buttons and arrow keys). */
export function adjacentTime(times: string[], current: string, direction: 1 | -1): string | null {
  const cur = toMs(current);
  if (direction === 1) return times.find((t) => toMs(t) > cur) ?? null;
  for (let i = times.length - 1; i >= 0; i--) {
    if (toMs(times[i]) < cur) return times[i];
  }
  return null;
}

/** Nearest real timestamp to an arbitrary instant (scrubbing). Ties resolve to the earlier one. */
export function nearestTime(times: string[], targetMs: number): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const t of times) {
    const diff = Math.abs(toMs(t) - targetMs);
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best;
}

/** Wall-clock milliseconds between playback steps. Speed never changes the data step. */
export function playbackIntervalMs(speed: number, baseMs = 1500): number {
  if (!(speed > 0)) throw new Error('Playback speed must be positive');
  return baseMs / speed;
}

/** Parse a `datetime-local` input value as UTC (the UI labels these inputs as UTC). */
export function fromUtcInput(value: string): string | null {
  if (!value) return null;
  const ms = Date.parse(`${value.length === 16 ? `${value}:00` : value}Z`);
  return Number.isNaN(ms) ? null : toIso(ms);
}

/** Format an ISO timestamp for a `datetime-local` input, in UTC. */
export function toUtcInput(iso: string): string {
  return toIso(toMs(iso)).slice(0, 16);
}
