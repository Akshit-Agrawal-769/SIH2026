// Small descriptive statistics for the retrieval benchmark.

/** n, median, nearest-rank p95, min, max of `samples` (NaNs when empty). */
export function summarize(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return { n: 0, median: NaN, p95: NaN, min: NaN, max: NaN };
  const mid = Math.floor(n / 2);
  const median = n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const p95 = s[Math.min(n, Math.ceil(0.95 * n)) - 1];
  return { n, median, p95, min: s[0], max: s[n - 1] };
}
