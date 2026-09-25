/**
 * Colour-scale geometry shared by the rendered tiles and the colourbars, so that tick
 * labels and the hover needle sit where the colour actually is (linear or log10).
 */
const LOG_FLOOR = 1e-4;

/** Position of `value` along the colour scale in [0, 1] (clamped), or null for non-finite values. */
export function scalePosition(value: number, min: number, max: number, log: boolean): number | null {
  if (!Number.isFinite(value)) return null;
  let t: number;
  if (log) {
    const lo = Math.log10(Math.max(LOG_FLOOR, min));
    const hi = Math.log10(Math.max(LOG_FLOOR, max));
    const span = hi - lo > 1e-9 ? hi - lo : 1;
    t = (Math.log10(Math.max(LOG_FLOOR, value)) - lo) / span;
  } else {
    const span = max - min > 1e-9 ? max - min : 1;
    t = (value - min) / span;
  }
  return Math.max(0, Math.min(1, t));
}

/** `n` tick values evenly spaced in scale space (geometric for log scales). */
export function scaleTicks(min: number, max: number, log: boolean, n = 5): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    if (log) {
      const lo = Math.log10(Math.max(LOG_FLOOR, min));
      const hi = Math.log10(Math.max(LOG_FLOOR, max));
      out.push(10 ** (lo + f * (hi - lo)));
    } else {
      out.push(min + f * (max - min));
    }
  }
  return out;
}

/** Tick label with precision appropriate to the magnitude. */
export function formatTick(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && a < 0.1) return v.toPrecision(2);
  if (a < 10) return v.toFixed(2);
  if (a < 100) return v.toFixed(1);
  return v.toFixed(0);
}
