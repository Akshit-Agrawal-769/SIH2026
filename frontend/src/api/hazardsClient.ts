/**
 * Disaster Early Warning API (data-service /api/hazards/*).
 *
 * Tiles fall back to static copies (frontend/public/tiles/<layer>/...) like every other layer:
 * the IBR build year for monthly layers, and the latest days of the daily / near-real-time layers.
 * Tracks, drift skill, validation and the external-layer catalog also have static copies. Summaries,
 * advisories and drift runs need the live service; on static hosting they return an explicit
 * `available: false` instead of anything computed in the browser.
 */
import {
  API_BASE, STATIC_TILE_BASE, dateKey, getJsonWithFallback, isHtmlResponse, liveApiAvailable, noteApiResponse
} from './config';
import { NoDataError, OceanTileData, parseOceanTileBuffer } from './client';

/** Monthly layers derived from the INCOIS Bio-ROMS record (date = IBR month). */
export type MonthlyLayerId = 'mhw_intensity' | 'mhw_detrended' | 'chl_bloom' | 'eddy_convergence';
/** Daily / near-real-time layers from external datasets (each has its own dates). */
export type ExtLayerId = 'mhw_daily' | 'dhw' | 'tchp' | 'gpi' | 'eddy_convergence_nrt';
export type DisasterLayerId = MonthlyLayerId | ExtLayerId;
export type DriftMode = 'forward' | 'reverse';
export type WindagePreset = 'none' | 'low' | 'oil';

export const MONTHLY_LAYERS: MonthlyLayerId[] = ['mhw_intensity', 'mhw_detrended', 'chl_bloom', 'eddy_convergence'];
export const EXT_LAYERS: ExtLayerId[] = ['mhw_daily', 'dhw', 'tchp', 'gpi', 'eddy_convergence_nrt'];
export const isExtLayer = (id: DisasterLayerId): id is ExtLayerId => (EXT_LAYERS as string[]).includes(id);

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
  layer: string;
  date: string;
  method: string;
  baseline?: [number, number];
  ocean_cells: number;
  mhw_cells: number;
  mhw_fraction: number;
  categories: { category: number; label: string; cells: number; area_km2: number }[];
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

/** Summary of an external layer (fields vary by layer; all carry available/date/caveat). */
export interface ExtSummary {
  available: true;
  layer: string;
  date: string;
  caveat: string;
  units?: string;
  mhw_fraction?: number;
  max_ratio?: number | null;
  max_dhw?: number | null;
  max?: number | null;
  fraction_above_threshold?: number;
  threshold_kj_cm2?: number;
  anomaly_ratio_domain?: number | null;
  basins?: Record<string, { mean: number | null; clim_mean: number | null }>;
  bands?: { range: string; cells: number; area_km2: number }[];
  regions?: HazardRegion[];
  [k: string]: unknown;
}

export interface ExtLayerMeta {
  units: string;
  long_name: string;
  source: string;
  caveat: string;
  cadence: string;
  var_code: number;
  available: boolean;
  dates: string[];
  reason?: string;
}

export interface DriftPoint {
  lat: number;
  lon: number;
  t_hours: number;
  speed_ms?: number;
}

export interface DriftConeStep {
  t_hours: number;
  ellipse: [number, number][];
  radius_km_p50: number | null;
  radius_km_p90: number | null;
}

export interface DriftResult {
  available: true;
  engine?: 'ensemble' | 'geostrophic';
  mode: DriftMode;
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
  hours_requested: number;
  hours_simulated: number;
  stopped_early: string | null;
  path_length_km: number;
  currents_date?: string;
  start_time?: string;
  end_time?: string;
  method: string;
  path: DriftPoint[];
  cone?: DriftConeStep[];
  members_end?: [number, number][];
  stranded_fraction?: number;
  forcing?: { currents: string; wind: string; window: [string, string] };
  assumptions?: {
    windage: { preset: WindagePreset; coefficient: number; note: string };
    diffusivity_m2s: number;
    position_sigma_km: number;
    members: number;
    label: string;
  };
  caveats: string[];
}

export interface DriftWindow {
  available: true;
  start: string;
  end: string;
  currents: string;
  wind: string;
  windage_presets: Record<WindagePreset, { coefficient: number; note: string }>;
  default_diffusivity_m2s: number;
  default_position_sigma_km: number;
}

export interface DriftOptions {
  engine: 'ensemble' | 'geostrophic';
  windage: WindagePreset;
  members: number;
  diffusivity: number | null;
  start: string | null;
}

export interface Advisory {
  type: string;
  level: string;
  severity?: number;
  date: string;
  source?: string;
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
  exports?: { geojson: string; cap: string };
}

export interface CycloneTrackStorm {
  sid: string;
  name: string;
  season: number;
  basin: string;
  subbasin: string;
  max_wind_kt: number | null;
  start: string;
  end: string;
  genesis: { t: string; lat: number; lon: number };
  landfall: { t: string; lat: number; lon: number } | null;
  /** [time, lat, lon, wind_kt, imd_grade] */
  points: [string, number, number, number | null, string | null][];
}

export interface CycloneTracksDoc {
  source: string;
  wind_note: string;
  storms: CycloneTrackStorm[];
}

export interface SkillAgg {
  segments: number;
  median_sep_km_24h: number;
  median_sep_km_48h: number;
  median_sep_km_72h: number;
  mean_skill: number;
  median_skill: number;
}

export interface DriftSkillDoc {
  title: string;
  window: [string, string];
  drifters: string;
  metric: string;
  models: Record<string, string>;
  notes: string[];
  summary: Record<string, { label: string; all: SkillAgg | null; drogued: SkillAgg | null; undrogued: SkillAgg | null }>;
}

export interface ValidationDoc {
  storms_source: string;
  tests: ({ test: string; description: string; interpretation?: string } & Record<string, unknown>)[];
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

async function staticOrLive<T>(livePath: string, staticPath: string, signal?: AbortSignal): Promise<T | Unavailable> {
  try {
    const { data } = await getJsonWithFallback<T>(livePath, staticPath, signal);
    return data;
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return { available: false, reason: (err as Error).message };
  }
}

const q = (params: Record<string, string | number | undefined | null>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

export const fetchMhwSummary = (date: string | null, layer: MonthlyLayerId = 'mhw_intensity', signal?: AbortSignal) =>
  liveJson<MhwSummary>(`/hazards/mhw?${q({ date: date && dateKey(date), layer })}`, signal);

export const fetchEddySummary = (date: string | null, signal?: AbortSignal) =>
  liveJson<EddySummary>(`/hazards/eddy-convergence?${q({ date: date && dateKey(date) })}`, signal);

const EXT_SUMMARY_PATH: Record<ExtLayerId, string | null> = {
  mhw_daily: '/hazards/mhw-daily', dhw: '/hazards/dhw', tchp: '/hazards/tchp', gpi: '/hazards/gpi',
  eddy_convergence_nrt: null
};

export const fetchExtSummary = (layer: ExtLayerId, date: string | null, signal?: AbortSignal) => {
  const p = EXT_SUMMARY_PATH[layer];
  if (!p) return Promise.resolve<Unavailable>({ available: false, reason: 'No summary for this layer.' });
  return liveJson<ExtSummary>(`${p}?${q({ date: date && dateKey(date) })}`, signal);
};

export const fetchAdvisories = (date: string | null, signal?: AbortSignal) =>
  liveJson<AdvisoriesResponse>(`/hazards/advisories?${q({ date: date && dateKey(date) })}`, signal);

export const advisoryExportUrl = (kind: 'geojson' | 'cap') =>
  `${API_BASE}/hazards/${kind === 'geojson' ? 'advisories.geojson' : 'advisories.cap.xml'}`;

export const fetchDrift = (lat: number, lon: number, mode: DriftMode, hours: number, opts: DriftOptions,
                           signal?: AbortSignal) =>
  liveJson<DriftResult>(`/hazards/drift?${q({
    lat, lon, mode, hours, engine: opts.engine, windage: opts.windage, members: opts.members,
    diffusivity: opts.diffusivity, start: opts.start
  })}`, signal);

export const fetchDriftWindow = (signal?: AbortSignal) => liveJson<DriftWindow>('/hazards/drift/window', signal);

/** External-layer catalog (live: every product date; static: the dates exported with the frontend). */
export async function fetchExtCatalog(signal?: AbortSignal): Promise<Record<ExtLayerId, ExtLayerMeta> | null> {
  const r = await staticOrLive<{ ext_layers?: Record<ExtLayerId, ExtLayerMeta> }>('/hazards/layers', '/ext_catalog.json', signal);
  return 'ext_layers' in r && r.ext_layers ? r.ext_layers : null;
}

export const fetchCycloneTracks = (signal?: AbortSignal) =>
  staticOrLive<CycloneTracksDoc>('/hazards/cyclones/compact', '/cyclone_tracks.json', signal);

export const fetchDriftSkill = (signal?: AbortSignal) =>
  staticOrLive<DriftSkillDoc>('/hazards/drift/skill', '/drift_skill.json', signal);

export const fetchValidation = (signal?: AbortSignal) =>
  staticOrLive<ValidationDoc>('/hazards/validation', '/hazard_validation.json', signal);

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
      throw new NoDataError(`No ${layer} tile for ${d} on this deployment (static export covers selected dates only).`);
    }
  }
  const tile = parseOceanTileBuffer(await res.arrayBuffer(), layer, 0, d);
  tileCache.set(key, tile);
  if (tileCache.size > 32) tileCache.delete(tileCache.keys().next().value as string);
  return tile;
}
