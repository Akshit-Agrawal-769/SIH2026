/**
 * IPFS tile source.
 *
 * frontend/public/ipfs-manifest.json (written by scripts/ipfs/publish.mjs) maps each published
 * file to its CIDv1. Tiles are fetched by CID with @helia/verified-fetch, which hashes the bytes
 * in the browser and rejects anything that does not match the CID, so even an untrusted public
 * gateway cannot serve altered ocean data. Everything here degrades to "not available" (null)
 * rather than throwing, so the app behaves exactly as before when no manifest is deployed.
 */
import { IPFS_GATEWAYS, IPFS_TIMEOUT_MS, dateKey, depthKey, isHtmlResponse } from './config';

export type DataSourceMode = 'auto' | 'ipfs' | 'server';
export type TileSource = 'api' | 'ipfs' | 'static';

export interface IpfsManifest {
  schema: string;
  generated_at: string;
  generator: string;
  kubo_version: string;
  profile: string;
  git_commit: string;
  root: string;
  files: Record<string, { cid: string; size: number; sha256: string }>;
}

export interface TileSourceInfo {
  source: TileSource;
  cid?: string;
}

/** Fetches the bytes of `cid`; the default implementation verifies them against the CID. */
export type CidFetcher = (cid: string, signal: AbortSignal) => Promise<ArrayBuffer>;

const MANIFEST_SCHEMA = 'incois-ipfs-manifest/1';
const MANIFEST_URL = '/ipfs-manifest.json';
const MODE_KEY = 'wave.dataSource';
const MODES: readonly DataSourceMode[] = ['auto', 'ipfs', 'server'];

let manifestPromise: Promise<IpfsManifest | null> | null = null;
let loadedManifest: IpfsManifest | null = null;
let modeOverride: DataSourceMode | null = null;
let defaultFetcher: Promise<CidFetcher> | null = null;
const tileListeners = new Set<(info: TileSourceInfo) => void>();
const modeListeners = new Set<(mode: DataSourceMode) => void>();

/** Validates the manifest shape; anything unexpected is treated as "no manifest". */
export function parseIpfsManifest(json: unknown): IpfsManifest | null {
  if (!json || typeof json !== 'object') return null;
  const m = json as Partial<IpfsManifest>;
  if (m.schema !== MANIFEST_SCHEMA || typeof m.root !== 'string' || !m.files || typeof m.files !== 'object') {
    return null;
  }
  return m as IpfsManifest;
}

export function tileManifestPath(variable: string, date: string, depth: number): string {
  return `tiles/${variable}/${dateKey(date)}/${depthKey(depth)}.bin`;
}

/** Loads /ipfs-manifest.json once; resolves null when it is absent, HTML (SPA fallback) or invalid. */
export function loadIpfsManifest(fetchImpl: typeof fetch = fetch): Promise<IpfsManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetchImpl(MANIFEST_URL);
        if (!res.ok || isHtmlResponse(res)) return null;
        loadedManifest = parseIpfsManifest(await res.json());
        return loadedManifest;
      } catch {
        return null;
      }
    })();
  }
  return manifestPromise;
}

/** The manifest loaded so far (for UI details), or null. */
export function getLoadedManifest(): IpfsManifest | null {
  return loadedManifest;
}

function getDefaultFetcher(): Promise<CidFetcher> {
  if (!defaultFetcher) {
    defaultFetcher = (async () => {
      // Lazy chunk: the Helia stack is only downloaded when IPFS is actually used.
      const { createVerifiedFetch } = await import('@helia/verified-fetch');
      const local = IPFS_GATEWAYS.some((g) => g.startsWith('http://'));
      const verifiedFetch = await createVerifiedFetch({
        gateways: IPFS_GATEWAYS,
        allowInsecure: local,
        allowLocal: local,
      });
      return async (cid: string, signal: AbortSignal) => {
        const res = await verifiedFetch(`ipfs://${cid}`, { signal });
        if (!res.ok) throw new Error(`IPFS ${res.status} for ${cid}`);
        return res.arrayBuffer();
      };
    })();
    defaultFetcher.catch(() => { defaultFetcher = null; });
  }
  return defaultFetcher;
}

/**
 * Fetches a published file by its manifest CID. Resolves null when there is no manifest or the
 * path is not in it; rejects on fetch/verification failure or after IPFS_TIMEOUT_MS.
 */
export async function fetchFromIpfs(
  path: string,
  opts: { fetcher?: CidFetcher; manifest?: IpfsManifest | null } = {}
): Promise<{ buffer: ArrayBuffer; cid: string } | null> {
  const manifest = opts.manifest !== undefined ? opts.manifest : await loadIpfsManifest();
  const entry = manifest?.files[path];
  if (!entry) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`IPFS fetch timed out after ${IPFS_TIMEOUT_MS} ms (${entry.cid})`));
    }, IPFS_TIMEOUT_MS);
  });
  try {
    const fetcher = opts.fetcher ?? (await getDefaultFetcher());
    const buffer = await Promise.race([fetcher(entry.cid, controller.signal), timeout]);
    return { buffer, cid: entry.cid };
  } finally {
    clearTimeout(timer);
  }
}

function readStoredMode(): DataSourceMode {
  try {
    const v = globalThis.localStorage?.getItem(MODE_KEY);
    return MODES.includes(v as DataSourceMode) ? (v as DataSourceMode) : 'auto';
  } catch {
    return 'auto';
  }
}

export function getDataSourceMode(): DataSourceMode {
  return modeOverride ?? readStoredMode();
}

export function setDataSourceMode(mode: DataSourceMode): void {
  if (!MODES.includes(mode)) return;
  const previous = getDataSourceMode();
  modeOverride = mode;
  try {
    globalThis.localStorage?.setItem(MODE_KEY, mode);
  } catch {
    /* private mode / blocked storage: keep the in-memory choice */
  }
  if (mode !== previous) modeListeners.forEach((l) => l(mode));
}

export function onModeChange(listener: (mode: DataSourceMode) => void): () => void {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

export function reportTileSource(info: TileSourceInfo): void {
  tileListeners.forEach((l) => l(info));
}

export function onTileSource(listener: (info: TileSourceInfo) => void): () => void {
  tileListeners.add(listener);
  return () => tileListeners.delete(listener);
}

/** Test helper: forget the memoised manifest, mode override and listeners. */
export function __resetIpfsSourceForTests(): void {
  manifestPromise = null;
  loadedManifest = null;
  modeOverride = null;
  defaultFetcher = null;
  tileListeners.clear();
  modeListeners.clear();
}
