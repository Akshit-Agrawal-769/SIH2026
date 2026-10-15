import { beforeEach, describe, expect, it, vi } from 'vitest';

// The tile loader's source chain, with the IPFS layer mocked and global fetch stubbed per URL.
const ipfs = vi.hoisted(() => ({
  mode: 'auto' as 'auto' | 'ipfs' | 'server',
  autoEnabled: true,
  fetchFromIpfs: vi.fn(),
  loadIpfsManifest: vi.fn(),
  reportTileSource: vi.fn(),
  modeListeners: [] as Array<(m: string) => void>,
}));

vi.mock('./ipfsSource', async (importActual) => {
  const actual = await importActual<typeof import('./ipfsSource')>();
  return {
    tileManifestPath: actual.tileManifestPath,
    getDataSourceMode: () => ipfs.mode,
    ipfsInAutoEnabled: () => ipfs.autoEnabled,
    fetchFromIpfs: ipfs.fetchFromIpfs,
    loadIpfsManifest: ipfs.loadIpfsManifest,
    reportTileSource: ipfs.reportTileSource,
    onModeChange: (l: (m: string) => void) => { ipfs.modeListeners.push(l); return () => {}; },
  };
});

const PATH = 'tiles/temperature/2019-01-29/0.0.bin';

/** A valid 2x1 tile: 32-byte INCO header + 2 float32 values. */
function tileBuffer(varCode = 1): ArrayBuffer {
  const buf = new ArrayBuffer(32 + 8);
  const v = new DataView(buf);
  'INCO'.split('').forEach((c, i) => v.setUint8(i, c.charCodeAt(0)));
  v.setUint16(4, 1, true);
  v.setUint16(6, varCode, true);
  v.setUint16(8, 2, true);
  v.setUint16(10, 1, true);
  v.setUint16(12, 1, true);
  v.setUint16(14, 1, true);
  v.setFloat32(16, 20, true);
  v.setFloat32(20, 30, true);
  v.setFloat32(32, 20, true);
  v.setFloat32(36, 30, true);
  return buf;
}

const binary = (buf: ArrayBuffer) =>
  new Response(buf, { status: 200, headers: { 'content-type': 'application/octet-stream' } });

type Route = (url: string) => Response | Promise<Response>;
function stubFetch(live: Route, statik: Route = () => binary(tileBuffer())) {
  const f = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/tiles/')) return live(url);
    if (url.startsWith('/tiles/')) return statik(url);
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const liveCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter(([u]) => String(u).includes('/api/tiles/')).length;

async function freshClient() {
  vi.resetModules(); // fresh config.ts state (liveApiAvailable) and tile cache per test
  return import('./client');
}

beforeEach(() => {
  ipfs.mode = 'auto';
  ipfs.autoEnabled = true;
  ipfs.fetchFromIpfs.mockReset();
  ipfs.reportTileSource.mockReset();
  ipfs.loadIpfsManifest.mockReset().mockResolvedValue({ files: { [PATH]: { cid: 'bafyT', size: 40, sha256: 'x' } } });
  ipfs.modeListeners = [];
  vi.unstubAllGlobals();
});

describe('tile source chain', () => {
  it('server: never calls fetchFromIpfs', async () => {
    ipfs.mode = 'server';
    stubFetch(() => binary(tileBuffer()));
    const { fetchOceanTile } = await freshClient();
    const tile = await fetchOceanTile('temperature', '2019-01-29', 0);
    expect(tile.source).toBe('api');
    expect(ipfs.fetchFromIpfs).not.toHaveBeenCalled();
  });

  it('auto: live down → ipfs, without the live retry wait', async () => {
    const f = stubFetch(() => { throw new TypeError('network down'); });
    ipfs.fetchFromIpfs.mockResolvedValue({ buffer: tileBuffer(), cid: 'bafyT' });
    const { fetchOceanTile } = await freshClient();
    const tile = await fetchOceanTile('temperature', '2019-01-29', 0);
    expect(tile.source).toBe('ipfs');
    expect(tile.cid).toBe('bafyT');
    expect(liveCalls(f)).toBe(1);
    expect(ipfs.fetchFromIpfs).toHaveBeenCalledWith(PATH);
    expect(ipfs.reportTileSource).toHaveBeenCalledWith({ source: 'ipfs', cid: 'bafyT' });
  });

  it('auto: tile missing from manifest falls to static', async () => {
    stubFetch(() => new Response('<html></html>', { status: 404, headers: { 'content-type': 'text/html' } }));
    ipfs.fetchFromIpfs.mockResolvedValue(null);
    const { fetchOceanTile } = await freshClient();
    expect((await fetchOceanTile('temperature', '2019-01-29', 0)).source).toBe('static');
  });

  it('ipfs failure falls back to static', async () => {
    ipfs.mode = 'ipfs';
    stubFetch(() => { throw new Error('live must not be called'); });
    ipfs.fetchFromIpfs.mockRejectedValue(new Error('IPFS fetch timed out after 8000 ms'));
    const { fetchOceanTile } = await freshClient();
    const tile = await fetchOceanTile('temperature', '2019-01-29', 0);
    expect(tile.source).toBe('static');
    expect(ipfs.reportTileSource).toHaveBeenCalledWith({ source: 'static' });
  });

  it('corrupt ipfs bytes fall back to static', async () => {
    ipfs.mode = 'ipfs';
    stubFetch(() => { throw new Error('live must not be called'); });
    ipfs.fetchFromIpfs.mockResolvedValue({ buffer: tileBuffer(2), cid: 'bafyWrong' }); // salinity code
    const { fetchOceanTile } = await freshClient();
    expect((await fetchOceanTile('temperature', '2019-01-29', 0)).source).toBe('static');
  });

  it('auto: live no-data stays NoDataError', async () => {
    stubFetch(() => new Response('{"detail":"no data"}', { status: 404, headers: { 'content-type': 'application/json' } }));
    const { fetchOceanTile, NoDataError } = await freshClient();
    await expect(fetchOceanTile('temperature', '2019-01-29', 0)).rejects.toBeInstanceOf(NoDataError);
    expect(ipfs.fetchFromIpfs).not.toHaveBeenCalled();
  });

  it('ipfs mode skips the live API', async () => {
    ipfs.mode = 'ipfs';
    const f = stubFetch(() => binary(tileBuffer()));
    ipfs.fetchFromIpfs.mockResolvedValue({ buffer: tileBuffer(), cid: 'bafyT' });
    const { fetchOceanTile } = await freshClient();
    expect((await fetchOceanTile('temperature', '2019-01-29', 0)).source).toBe('ipfs');
    expect(liveCalls(f)).toBe(0);
  });

  it('auto: after an IPFS failure, later tiles skip IPFS for the session', async () => {
    stubFetch(() => new Response('<html></html>', { status: 404, headers: { 'content-type': 'text/html' } }));
    ipfs.fetchFromIpfs.mockRejectedValue(new Error('gateway unreachable'));
    const { fetchOceanTile } = await freshClient();
    await fetchOceanTile('temperature', '2019-01-29', 0);
    await fetchOceanTile('temperature', '2019-02-28', 0);
    expect(ipfs.fetchFromIpfs).toHaveBeenCalledTimes(1);
  });

  it('auto: live 5xx on an unpublished month keeps the "try again" error', async () => {
    vi.useFakeTimers();
    stubFetch(
      () => new Response('{"detail":"boom"}', { status: 503, headers: { 'content-type': 'application/json' } }),
      () => new Response('<html></html>', { status: 404, headers: { 'content-type': 'text/html' } })
    );
    ipfs.loadIpfsManifest.mockResolvedValue({ files: {} });
    ipfs.fetchFromIpfs.mockResolvedValue(null);
    const { fetchOceanTile } = await freshClient();
    const p = fetchOceanTile('temperature', '2024-06-15', 0);
    const assertion = expect(p).rejects.toThrow(/could not build temperature/);
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
    vi.useRealTimers();
  });

  it('auto: production build without configured gateways never tries IPFS', async () => {
    ipfs.autoEnabled = false;
    const f = stubFetch(() => { throw new TypeError('network down'); });
    const { fetchOceanTile } = await freshClient();
    vi.useFakeTimers();
    const p = fetchOceanTile('temperature', '2019-01-29', 0);
    await vi.advanceTimersByTimeAsync(120_000); // live retries run as on main
    expect((await p).source).toBe('static');
    vi.useRealTimers();
    expect(ipfs.fetchFromIpfs).not.toHaveBeenCalled();
    expect(liveCalls(f)).toBe(6);
  });

  it('a request still in flight across a mode change cannot overwrite the new mode', async () => {
    ipfs.mode = 'server';
    let releaseLive!: () => void;
    const liveGate = new Promise<void>((r) => { releaseLive = r; });
    stubFetch(async () => { await liveGate; return binary(tileBuffer()); });
    const { fetchOceanTile } = await freshClient();
    const a = fetchOceanTile('temperature', '2019-01-29', 0);       // server-mode request, stalled
    await Promise.resolve();
    ipfs.mode = 'ipfs';
    ipfs.modeListeners.forEach((l) => l('ipfs'));
    ipfs.fetchFromIpfs.mockResolvedValue({ buffer: tileBuffer(), cid: 'bafyT' });
    const b = await fetchOceanTile('temperature', '2019-01-29', 0); // new-mode request
    expect(b.source).toBe('ipfs');
    releaseLive();
    expect((await a).source).toBe('api');                            // caller A still gets its tile
    ipfs.reportTileSource.mockClear();
    const c = await fetchOceanTile('temperature', '2019-01-29', 0); // cache must hold B, not A
    expect(c.source).toBe('ipfs');
    expect(ipfs.reportTileSource).toHaveBeenLastCalledWith({ source: 'ipfs', cid: 'bafyT' });
  });

  it('mode change clears cache', async () => {
    ipfs.mode = 'server';
    const f = stubFetch(() => binary(tileBuffer()));
    const { fetchOceanTile } = await freshClient();
    await fetchOceanTile('temperature', '2019-01-29', 0);
    await fetchOceanTile('temperature', '2019-01-29', 0);
    expect(liveCalls(f)).toBe(1); // cached
    ipfs.modeListeners.forEach((l) => l('server'));
    await fetchOceanTile('temperature', '2019-01-29', 0);
    expect(liveCalls(f)).toBe(2);
  });
});
