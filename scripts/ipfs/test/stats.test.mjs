import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../lib/stats.mjs';

test('summarize: odd sample count, nearest-rank p95', () => {
  assert.deepEqual(summarize([5, 1, 3]), { n: 3, median: 3, p95: 5, min: 1, max: 5 });
});

test('summarize: even count takes the mean of the middle two', () => {
  assert.equal(summarize([1, 2, 3, 4]).median, 2.5);
});

test('summarize: p95 of 1..20 is 19 (nearest rank ceil(0.95*20))', () => {
  assert.equal(summarize(Array.from({ length: 20 }, (_, i) => i + 1)).p95, 19);
});

test('summarize: empty input', () => {
  const s = summarize([]);
  assert.equal(s.n, 0);
  assert.ok(Number.isNaN(s.median) && Number.isNaN(s.p95) && Number.isNaN(s.min) && Number.isNaN(s.max));
});
