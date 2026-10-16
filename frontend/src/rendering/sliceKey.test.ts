import { describe, expect, it } from 'vitest';
import { sliceRequestKey } from './sliceKey';

describe('sliceRequestKey', () => {
  const params = { variable: 'temperature', date: '2019-01-29', depth: 0, palette: 'turbo', customRange: null, scaleType: 'linear' };

  it('changes when the data-source mode changes, so the field re-fetches', () => {
    expect(sliceRequestKey(params, 'server')).not.toBe(sliceRequestKey(params, 'ipfs'));
  });

  it('is stable for identical params and mode', () => {
    expect(sliceRequestKey({ ...params }, 'auto')).toBe(sliceRequestKey(params, 'auto'));
  });
});
