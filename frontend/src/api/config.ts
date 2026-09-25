/**
 * API endpoints.
 *
 * API_BASE      – live scientific API (gateway / data-service). Same origin by default;
 *                 set VITE_API_BASE_URL at build time to point at a separately hosted backend.
 * STATIC_BASE   – static copies of the same authentic artefacts shipped with the frontend
 *                 (frontend/public), produced by scripts/build_authentic_dataset.py. Used when
 *                 the live API is unreachable, so static hosting still shows real data.
 */
const origin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const API_BASE = `${origin}/api`;
export const STATIC_API_BASE = '/api';
export const STATIC_TILE_BASE = '/tiles';

/** Canonical depth key used in tile paths on both backend and static hosting ("0.0", "10.0"). */
export function depthKey(depth: number): string {
  return depth.toFixed(1);
}

/** Canonical date key ("YYYY-MM-DD") from a date or ISO datetime string. */
export function dateKey(value: string): string {
  return value.slice(0, 10);
}

export function isHtmlResponse(res: Response): boolean {
  return (res.headers.get('content-type') || '').includes('text/html');
}

/**
 * Whether the live API answered like an API. On static hosting the first probe returns
 * 404/HTML; after that the static artefacts are used directly instead of probing again.
 */
let apiAvailable: boolean | null = null;
export function liveApiAvailable(): boolean | null {
  return apiAvailable;
}
export function noteApiResponse(res: Response | null): void {
  if (!res) {
    apiAvailable = false;
    return;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json') || ct.includes('application/octet-stream') || ct.includes('xml') || ct.includes('image/')) {
    apiAvailable = true;
  } else if (res.status === 404 || isHtmlResponse(res)) {
    if (apiAvailable === null) apiAvailable = false;
  }
}

/**
 * GET JSON from the live API, falling back to the static artefact path when the API is
 * unreachable or not deployed. HTTP 4xx answers from a live API are returned as-is.
 */
export async function getJsonWithFallback<T>(
  livePath: string,
  staticPath: string | null,
  signal?: AbortSignal
): Promise<{ data: T; source: 'api' | 'static' }> {
  try {
    if (apiAvailable === false) throw new Error('live API not available on this host');
    const res = await fetch(`${API_BASE}${livePath}`, { signal });
    noteApiResponse(res);
    if (res.ok && !isHtmlResponse(res)) {
      return { data: (await res.json()) as T, source: 'api' };
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 404 && !isHtmlResponse(res)) {
      throw new Error(`API ${res.status} for ${livePath}`);
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    if (!staticPath) throw err;
  }
  if (!staticPath) throw new Error(`API unavailable for ${livePath}`);
  const res = await fetch(`${STATIC_API_BASE}${staticPath}`, { signal });
  if (!res.ok || isHtmlResponse(res)) {
    throw new Error(`No data at ${staticPath} (HTTP ${res.status})`);
  }
  return { data: (await res.json()) as T, source: 'static' };
}
