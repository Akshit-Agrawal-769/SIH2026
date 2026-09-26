import { API_BASE, STATIC_TILE_BASE, dateKey, depthKey, getJsonWithFallback, isHtmlResponse, liveApiAvailable, noteApiResponse } from './config';

export interface InstrumentFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: string;
    external_id: string;
    platform_type: 'argo';
    last_report: string;
    metadata: {
      wmo?: string;
      institution?: string;
      data_centre?: string;
      project_name?: string;
      pi_name?: string;
      latest_cycle?: number;
      profile_count_local?: number;
      has_oxygen?: boolean;
      has_chlorophyll?: boolean;
      qc_policy?: string;
      [key: string]: any;
    };
  };
}

export interface InstrumentFeatureCollection {
  type: 'FeatureCollection';
  features: InstrumentFeature[];
}

export interface DepthMeasurement {
  depth: number;
  pressure?: number | null;
  temperature?: number | null;
  salinity?: number | null;
  chlorophyll?: number | null;
  oxygen?: number | null;
}

export interface ProfileAnalysis {
  method: string;
  levels_used: number;
  mld_meters: number | null;
  thermocline_depth_meters: number | null;
  thermocline_gradient_c_per_m: number | null;
  reference_temperature: number | null;
  reason?: string;
}

export interface InstrumentProfileResponse {
  instrument_id: string;
  external_id: string;
  platform_type: string;
  profile_id: string;
  cycle_number?: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  metadata?: Record<string, any>;
  measurements: DepthMeasurement[];
  analysis?: ProfileAnalysis;
}

export interface VariableCatalogEntry {
  var_code: number;
  units: string;
  long_name: string;
  standard_name: string;
  source_id: string;
  source_variable: string;
  depths: number[];
  vertical_coverage?: string;
  timesteps: string[];
  value_range: [number, number];
  display_range: [number, number];
  vectors?: string;
}

export interface SourceCatalogEntry {
  title: string;
  type: string;
  institution?: string;
  doi?: string;
  doi_url?: string;
  product_id?: string;
  time_coverage?: [string, string];
  vertical_levels?: string;
  note?: string;
  [key: string]: any;
}

export interface DataCatalog {
  schema: string;
  generated_at: string;
  grid: {
    width: number;
    height: number;
    lon0: number;
    lat0: number;
    dlon: number;
    dlat: number;
    bbox: [number, number, number, number];
    registration: string;
    row_order: string;
  };
  variables: Record<string, VariableCatalogEntry>;
  sources: Record<string, SourceCatalogEntry>;
  instruments: string[];
}

/** Legacy ids (INCOIS_ARGO_1902594, 1902594) map to the catalog id ARGO_1902594. */
export function canonicalInstrumentId(id: string): string {
  const m = /(\d{7})/.exec(id);
  return m ? `ARGO_${m[1]}` : id;
}

let catalogPromise: Promise<DataCatalog> | null = null;

/** Data catalog (variables, real timesteps, sources). The static copy is authoritative. */
export function fetchCatalog(): Promise<DataCatalog> {
  if (!catalogPromise) {
    catalogPromise = getJsonWithFallback<DataCatalog>('/catalog', '/catalog.json')
      .then((r) => r.data)
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

export async function fetchInstruments(params?: {
  bbox?: string;
  platform_type?: string;
}): Promise<InstrumentFeatureCollection> {
  const query = new URLSearchParams();
  if (params?.bbox) query.set('bbox', params.bbox);
  if (params?.platform_type) query.set('platform_type', params.platform_type);
  const qs = query.toString();
  const { data } = await getJsonWithFallback<InstrumentFeatureCollection>(
    `/instruments${qs ? `?${qs}` : ''}`,
    qs ? null : '/instruments.json'
  );
  return data;
}

export async function fetchInstrumentProfile(instrumentId: string, signal?: AbortSignal): Promise<InstrumentProfileResponse> {
  const id = canonicalInstrumentId(instrumentId);
  const { data } = await getJsonWithFallback<InstrumentProfileResponse>(
    `/instruments/${encodeURIComponent(id)}/profile`,
    `/profiles/${encodeURIComponent(id)}.json`,
    signal
  );
  return data;
}

export interface OceanTileHeader {
  magic: string;
  version: number;
  varCode: number;
  width: number;
  height: number;
  depthCount: number;
  dataType: number;
  minVal: number;
  maxVal: number;
}

export interface OceanTileData {
  header: OceanTileHeader;
  values: Float32Array;
  variable: string;
  depth: number;
  date: string;
}

/** Mirrors VAR_CODES in scripts/build_authentic_dataset.py (6+: derived hazard layers). */
export const VAR_CODES: Record<string, number> = {
  temperature: 1,
  salinity: 2,
  currents: 3,
  chlorophyll: 4,
  mld: 5,
  mhw_intensity: 6,
  current_u: 7,
  current_v: 8,
  vorticity: 9,
  eddy_convergence: 10,
  chl_bloom: 11,
  mhw_detrended: 12,
  mhw_daily: 13,
  dhw: 14,
  tchp: 15,
  gpi: 16,
  eddy_convergence_nrt: 17
};

/**
 * Parses a binary tile: 32-byte little-endian 'INCO' header + Float32 payload.
 * Rejects tiles whose variable code does not match the requested variable, so a
 * temperature tile can never be rendered as salinity (cache or routing mistakes).
 */
export function parseOceanTileBuffer(
  buffer: ArrayBuffer,
  variable: string,
  depth: number,
  date: string
): OceanTileData {
  if (buffer.byteLength < 32) {
    throw new Error(`Buffer too small for INCO header: ${buffer.byteLength} bytes`);
  }
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'INCO') {
    throw new Error(`Invalid magic header: expected 'INCO', got '${magic}'`);
  }
  const version = view.getUint16(4, true);
  const varCode = view.getUint16(6, true);
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  const depthCount = view.getUint16(12, true);
  const dataType = view.getUint16(14, true);
  const minVal = view.getFloat32(16, true);
  const maxVal = view.getFloat32(20, true);

  const expectedCode = VAR_CODES[variable];
  if (expectedCode !== undefined && varCode !== expectedCode) {
    throw new Error(`Tile variable code ${varCode} does not match '${variable}' (${expectedCode})`);
  }
  if (dataType !== 1) {
    throw new Error(`Unsupported tile data type ${dataType}`);
  }
  const expectedLength = width * height * depthCount;
  if (buffer.byteLength !== 32 + expectedLength * 4) {
    throw new Error(`Tile payload ${buffer.byteLength - 32} bytes, expected ${expectedLength * 4}`);
  }
  const values = new Float32Array(buffer, 32, expectedLength);
  return {
    header: { magic, version, varCode, width, height, depthCount, dataType, minVal, maxVal },
    values,
    variable,
    depth,
    date
  };
}

const TILE_CACHE_MAX = 48;
const tileCache = new Map<string, OceanTileData>();
const inflight = new Map<string, Promise<OceanTileData>>();

export function tileCacheKey(variable: string, date: string, depth: number): string {
  return `${variable}|${dateKey(date)}|${depthKey(depth)}`;
}

/** Error thrown when the requested tile does not exist (explicit "no data" state). */
export class NoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoDataError';
  }
}

async function loadTile(variable: string, date: string, depth: number): Promise<OceanTileData> {
  const d = dateKey(date);
  const live = `${API_BASE}/tiles/${encodeURIComponent(variable)}/${encodeURIComponent(d)}/${depthKey(depth)}`;
  let res: Response | null = null;
  if (liveApiAvailable() !== false) {
    try {
      res = await fetch(live);
      noteApiResponse(res);
    } catch {
      res = null;
    }
  }
  if (!res || !res.ok || isHtmlResponse(res)) {
    const liveSaidNoData = res && res.status === 404 && !isHtmlResponse(res) &&
      (res.headers.get('content-type') || '').includes('application/json');
    if (liveSaidNoData) {
      throw new NoDataError(`No ${variable} data at ${d}, depth ${depthKey(depth)} m`);
    }
    res = await fetch(`${STATIC_TILE_BASE}/${encodeURIComponent(variable)}/${encodeURIComponent(d)}/${depthKey(depth)}.bin`);
    if (!res.ok || isHtmlResponse(res)) {
      throw new NoDataError(`No ${variable} data at ${d}, depth ${depthKey(depth)} m`);
    }
  }
  return parseOceanTileBuffer(await res.arrayBuffer(), variable, depth, d);
}

/** Fetch a tile with a bounded LRU cache keyed by (variable, date, depth) and request de-duplication. */
export async function fetchOceanTile(variable: string, date: string, depth: number): Promise<OceanTileData> {
  const key = tileCacheKey(variable, date, depth);
  const hit = tileCache.get(key);
  if (hit) {
    tileCache.delete(key);
    tileCache.set(key, hit);
    return hit;
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = loadTile(variable, date, depth)
    .then((tile) => {
      tileCache.set(key, tile);
      if (tileCache.size > TILE_CACHE_MAX) {
        tileCache.delete(tileCache.keys().next().value as string);
      }
      return tile;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
