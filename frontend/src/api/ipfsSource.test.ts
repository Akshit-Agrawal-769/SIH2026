import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const helia = vi.hoisted(() => ({ createVerifiedFetch: vi.fn() }));
vi.mock('@helia/verified-fetch', () => ({ createVerifiedFetch: helia.createVerifiedFetch }));
import {
  __resetIpfsSourceForTests,
  cidInspectorUrl,
  fetchFromIpfs,
  ipfsInAutoEnabled,
  getDataSourceMode,
  loadIpfsManifest,
  onModeChange,
  onTileSource,
  parseIpfsManifest,
  reportTileSource,
  setDataSourceMode,
  tileManifestPath,
  type IpfsManifest,
} from './ipfsSource';

const MANIFEST: IpfsManifest = {
  schema: 'incois-ipfs-manifest/1',
  generated_at: '2026-10-15T00:00:00.000Z',
  generator: 'test',
  kubo_version: '0.43.1',
  profile: 'unixfs-v1-2025',
  git_commit: 'abc',
  root: 'bafyRoot',
  files: { 'tiles/temperature/2019-01-29/0.0.bin': { cid: 'bafyT', size: 8, sha256: 'ab' } },
};

function jsonResponse(body: unknown, contentType = 'application/json'): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

beforeEach(() => __resetIpfsSourceForTests());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('manifest parsing', () => {
  it('parses a valid manifest', () => {
    expect(parseIpfsManifest(MANIFEST)?.root).toBe('bafyRoot');
  });

  it('returns null for html / invalid manifest', async () => {
    expect(parseIpfsManifest({ ...MANIFEST, schema: 'other/1' })).toBeNull();
    expect(parseIpfsManifest({ ...MANIFEST, files: undefined })).toBeNull();
    expect(parseIpfsManifest({ ...MANIFEST, root: undefined })).toBeNull();
    expect(parseIpfsManifest('nope')).toBeNull();
    const html = vi.fn(async () => jsonResponse('<!doctype html><html></html>', 'text/html'));
    expect(await loadIpfsManifest(html as unknown as typeof fetch)).toBeNull();
    __resetIpfsSourceForTests();
    const broken = vi.fn(async () => jsonResponse('{not json'));
    expect(await loadIpfsManifest(broken as unknown as typeof fetch)).toBeNull();
    __resetIpfsSourceForTests();
    const missing = vi.fn(async () => new Response('', { status: 404 }));
    expect(await loadIpfsManifest(missing as unknown as typeof fetch)).toBeNull();
  });

  it('loads the manifest once and memoises it', async () => {
    const f = vi.fn(async () => jsonResponse(MANIFEST));
    expect((await loadIpfsManifest(f as unknown as typeof fetch))?.root).toBe('bafyRoot');
    await loadIpfsManifest(f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith('/ipfs-manifest.json');
  });
});

describe('tileManifestPath', () => {
  it('maps a tile to its manifest key', () => {
    expect(tileManifestPath('temperature', '2019-01-29T00:00:00Z', 0)).toBe('tiles/temperature/2019-01-29/0.0.bin');
  });
});

describe('fetchFromIpfs', () => {
  it('fetches the manifest CID through the fetcher', async () => {
    const buf = new Uint8Array([1, 2, 3]).buffer;
    const fetcher = vi.fn(async () => buf);
    const got = await fetchFromIpfs('tiles/temperature/2019-01-29/0.0.bin', { fetcher, manifest: MANIFEST });
    expect(got).toEqual({ buffer: buf, cid: 'bafyT' });
    expect(fetcher).toHaveBeenCalledWith('bafyT', expect.any(AbortSignal));
  });

  it('returns null when the path is not in the manifest or there is no manifest', async () => {
    const fetcher = vi.fn();
    expect(await fetchFromIpfs('tiles/x/2019-01-29/0.0.bin', { fetcher, manifest: MANIFEST })).toBeNull();
    expect(await fetchFromIpfs('tiles/temperature/2019-01-29/0.0.bin', { fetcher, manifest: null })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects with a timeout after 8000 ms', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(() => new Promise<ArrayBuffer>(() => {}));
    const p = fetchFromIpfs('tiles/temperature/2019-01-29/0.0.bin', { fetcher, manifest: MANIFEST });
    const assertion = expect(p).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
  });
});

describe('data source mode', () => {
  it('defaults to auto and persists the choice', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(getDataSourceMode()).toBe('auto');
    setDataSourceMode('server');
    expect(store.get('wave.dataSource')).toBe('server');
    __resetIpfsSourceForTests();
    expect(getDataSourceMode()).toBe('server');
  });

  it('mode survives throwing storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    expect(getDataSourceMode()).toBe('auto');
    expect(() => setDataSourceMode('ipfs')).not.toThrow();
    expect(getDataSourceMode()).toBe('ipfs');
  });

  it('notifies mode listeners only on change', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    const seen: string[] = [];
    onModeChange((m) => seen.push(m));
    setDataSourceMode('ipfs');
    setDataSourceMode('ipfs');
    expect(seen).toEqual(['ipfs']);
  });
});

describe('tile source events', () => {
  it('delivers reports until unsubscribed', () => {
    const seen: unknown[] = [];
    const off = onTileSource((info) => seen.push(info));
    reportTileSource({ source: 'ipfs', cid: 'bafyT' });
    off();
    reportTileSource({ source: 'static' });
    expect(seen).toEqual([{ source: 'ipfs', cid: 'bafyT' }]);
  });
});

describe('default verified fetcher', () => {
  it('uses only the configured gateways, with no delegated routers', async () => {
    const verifiedFetch = vi.fn(async () => new Response(new Uint8Array([9]), { status: 200 }));
    helia.createVerifiedFetch.mockResolvedValue(verifiedFetch);
    const got = await fetchFromIpfs('tiles/temperature/2019-01-29/0.0.bin', { manifest: MANIFEST });
    expect(new Uint8Array(got!.buffer)).toEqual(new Uint8Array([9]));
    expect(helia.createVerifiedFetch).toHaveBeenCalledWith(
      expect.objectContaining({ gateways: expect.any(Array), routers: [] })
    );
    expect(verifiedFetch).toHaveBeenCalledWith('ipfs://bafyT', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});

describe('auto-mode IPFS gate', () => {
  it('uses IPFS in auto only in dev or when gateways are configured explicitly', () => {
    expect(ipfsInAutoEnabled({ DEV: true })).toBe(true);
    expect(ipfsInAutoEnabled({ DEV: false, VITE_IPFS_GATEWAYS: 'https://example-gw.io' })).toBe(true);
    expect(ipfsInAutoEnabled({ DEV: false })).toBe(false);
    expect(ipfsInAutoEnabled({ DEV: false, VITE_IPFS_GATEWAYS: '  ' })).toBe(false);
  });
});

describe('badge link', () => {
  it('links a CID to the CID inspector, which works for any CID in any browser', () => {
    expect(cidInspectorUrl('bafkreiabc')).toBe('https://cid.ipfs.tech/#bafkreiabc');
  });
});

describe('slow verified-fetch setup', () => {
  it('does not count chunk/setup time against the fetch timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const verifiedFetch = vi.fn(async () => new Response(new Uint8Array([4]), { status: 200 }));
    helia.createVerifiedFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(verifiedFetch), 9000))
    );
    const setupCallsBefore = helia.createVerifiedFetch.mock.calls.length;
    const p = fetchFromIpfs('tiles/temperature/2019-01-29/0.0.bin', { manifest: MANIFEST });
    // Wait (on real ticks) until the lazy import has resolved and setup has started, then advance.
    while (helia.createVerifiedFetch.mock.calls.length === setupCallsBefore) await new Promise((r) => setImmediate(r));
    await vi.advanceTimersByTimeAsync(9000);
    const got = await p;
    expect(new Uint8Array(got!.buffer)).toEqual(new Uint8Array([4]));
  });
});
