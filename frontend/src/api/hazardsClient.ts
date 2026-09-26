/**
 * Disaster Early Warning API (data-service /api/hazards/*).
 *
 * Tiles fall back to the static 2019 export (frontend/public/tiles/<layer>/...) like every
 * other layer. Summaries, advisories and drift need the live service; on static hosting they
 * return an explicit `available: false` instead of anything computed in the browser.
 */
import { API_BASE, STATIC_TILE_BASE, dateKey, isHtmlResponse, liveApiAvailable, noteApiResponse } from './config';
import { NoDataError, OceanTileData, parseOceanTileBuffer } from './client';

export type DisasterLayerId = 'mhw_intensity' | 'eddy_convergence';
export type DriftMode = 'forward' | 'reverse';

export interface Unavailable {
  available: false;
  reason: string;
  caveat?: string;
  caveats?: string[];
  geostrophic_caveats?: string[];
  date?: string | null;
}

export interface HazardRegion {
  cells: number;
  area_km2: number;
  centroid: { lat: number; lon: number };
  peak: { lat: number; lon: number; value: number };
  mean_value: number;
  bbox: [number, number, number, number];
}

export interface MhwSummary {
  available: true;
  date: string;
  method: string;
  ocean_cells: number;
  mhw_cells: number;
  mhw_fraction: number;
  categories: { category: number; label: string; ratio_range: [number, number | null]; cells: number; area_km2: number }[];
  max_ratio: number | null;
  regions: HazardRegion[];
  caveat: string;
}

export interface EddySummary {
  available: true;
  date: string;
  sst_date: string;
  currents_date: string;
  date_mismatch: string;
  method: string;
  cells_nonzero: number;
  cells_ge_50: number;
  regions: HazardRegion[];
  caveat: string;
  geostrophic_caveats: string[];
}

export interface DriftPoint {
  lat: number;
  lon: number;
  t_hours: number;
  speed_ms: number;
}

export interface DriftResult {
  available: true;
  mode: DriftMode;
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
  hours_requested: number;
  hours_simulated: number;
  stopped_early: string | null;
  path_length_km: number;
  currents_date: string;
  method: string;
  path: DriftPoint[];
  caveats: string[];
}

export interface Advisory {
  type: 'marine_heatwave' | 'eddy_convergence';
  level: string;
  date: string;
  title: string;
  detail: string;
  region: HazardRegion;
  caveat: string;
}

export interface AdvisoriesResponse {
  available: boolean;
  date: string | null;
  advisories: Advisory[];
  unavailable: Record<string, string>;
  note: string;
}

const STATIC_ONLY_REASON =
  'The live data-service is not reachable from this deployment; this analysis is computed server-side only.';

async function liveJson<T>(path: string, signal?: AbortSignal): Promise<T | Unavailable> {
  if (liveApiAvailable() === false) return { available: false, reason: STATIC_ONLY_REASON };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return { available: false, reason: STATIC_ONLY_REASON };
  }
  noteApiResponse(res);
  if (isHtmlResponse(res)) return { available: false, reason: STATIC_ONLY_REASON };
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`;
    return { available: false, reason: detail };
  }
  return body as T;
}

const q = (params: Record<string, string | number | undefined | null>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

export const fetchMhwSummary = (date: string | null, signal?: AbortSignal) =>
  liveJson<MhwSummary>(`/hazards/mhw?${q({ date: date && dateKey(date) })}`, signal);

export const fetchEddySummary = (date: string | null, signal?: AbortSignal) =>
  liveJson<EddySummary>(`/hazards/eddy-convergence?${q({ date: date && dateKey(date) })}`, signal);

export const fetchAdvisories = (date: string | null, signal?: AbortSignal) =>
  liveJson<AdvisoriesResponse>(`/hazards/advisories?${q({ date: date && dateKey(date) })}`, signal);

export const fetchDrift = (lat: number, lon: number, mode: DriftMode, hours: number, signal?: AbortSignal) =>
  liveJson<DriftResult>(`/hazards/drift?${q({ lat, lon, mode, hours })}`, signal);

const tileCache = new Map<string, OceanTileData>();

/** INCO tile of a derived layer: live (derived on demand) first, then the static export. */
export async function fetchHazardTile(layer: DisasterLayerId, date: string, signal?: AbortSignal): Promise<OceanTileData> {
  const d = dateKey(date);
  const key = `${layer}|${d}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  let res: Response | null = null;
  if (liveApiAvailable() !== false) {
    try {
      res = await fetch(`${API_BASE}/hazards/tiles/${layer}/${d}`, { signal });
      noteApiResponse(res);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      res = null;
    }
  }
  if (res && res.status === 404 && !isHtmlResponse(res)) {
    const body = await res.json().catch(() => null);
    throw new NoDataError(body?.detail ?? `No ${layer} data for ${d}`);
  }
  if (!res || !res.ok || isHtmlResponse(res)) {
    res = await fetch(`${STATIC_TILE_BASE}/${layer}/${d}/0.0.bin`, { signal });
    if (!res.ok || isHtmlResponse(res)) {
      throw new NoDataError(`No ${layer} tile for ${d} on this deployment (static export covers the build year only).`);
    }
  }
  const tile = parseOceanTileBuffer(await res.arrayBuffer(), layer, 0, d);
  tileCache.set(key, tile);
  if (tileCache.size > 24) tileCache.delete(tileCache.keys().next().value as string);
  return tile;
}
