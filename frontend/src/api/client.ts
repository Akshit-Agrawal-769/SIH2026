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
    platform_type: 'argo' | 'glider' | 'ctd' | 'bgc';
    last_report: string;
    metadata: {
      wmo?: string;
      institution?: string;
      location_name?: string;
      glider_model?: string;
      mission_name?: string;
      data_mode?: string;
      battery_percent?: number;
      dive_speed_ms?: number;
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
  pressure?: number;
  temperature?: number;
  salinity?: number;
  chlorophyll?: number;
  oxygen?: number;
}

export interface InstrumentProfileResponse {
  instrument_id: string;
  external_id: string;
  platform_type: string;
  profile_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  metadata?: Record<string, any>;
  measurements: DepthMeasurement[];
}

const API_BASE = '/api';

/**
 * Fetch all observation platforms in bounding box or by type.
 */
export async function fetchInstruments(params?: {
  bbox?: string;
  platform_type?: string;
}): Promise<InstrumentFeatureCollection> {
  const query = new URLSearchParams();
  if (params?.bbox) query.set('bbox', params.bbox);
  if (params?.platform_type) query.set('platform_type', params.platform_type);

  const url = `${API_BASE}/instruments${query.toString() ? `?${query.toString()}` : ''}`;
  let res = await fetch(url);
  if (!res.ok || (res.headers.get('content-type')?.includes('text/html'))) {
    res = await fetch('/api/instruments.json');
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch instruments: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch depth-resolved CTD profile data for a specific instrument.
 */
export async function fetchInstrumentProfile(
  instrumentId: string
): Promise<InstrumentProfileResponse> {
  const url = `${API_BASE}/instruments/${encodeURIComponent(instrumentId)}/profile`;
  let res = await fetch(url);
  if (!res.ok || (res.headers.get('content-type')?.includes('text/html'))) {
    const cleanId = instrumentId.replace('INCOIS_ARGO_', '');
    res = await fetch(`/api/profiles/${encodeURIComponent(instrumentId)}.json`);
    if (!res.ok) {
      res = await fetch(`/api/profiles/${encodeURIComponent(cleanId)}.json`);
    }
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch instrument profile: ${res.statusText}`);
  }
  return res.json();
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

/**
 * Parses binary ocean voxel tile: 32-byte header + Float32Array payload.
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
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );

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

  const expectedLength = width * height * depthCount;
  // Offset 32 bytes to start of Float32Array
  const values = new Float32Array(buffer, 32, expectedLength);

  return {
    header: {
      magic,
      version,
      varCode,
      width,
      height,
      depthCount,
      dataType,
      minVal,
      maxVal
    },
    values,
    variable,
    depth,
    date
  };
}

const tileCache = new Map<string, OceanTileData>();

/**
 * Fetches a packed binary depth slice tile with in-memory caching for instant 60fps depth scrubbing.
 */
export async function fetchOceanTile(
  variable: string,
  date: string,
  depth: number
): Promise<OceanTileData> {
  const cacheKey = `${variable}_${date}_${depth}`;
  if (tileCache.has(cacheKey)) {
    return tileCache.get(cacheKey)!;
  }

  const url = `${API_BASE}/tiles/${encodeURIComponent(variable)}/${encodeURIComponent(date)}/${depth}`;
  let res = await fetch(url);
  if (!res.ok || (res.headers.get('content-type')?.includes('text/html'))) {
    // Try static direct tile path
    const fallbackUrl = `/tiles/${encodeURIComponent(variable)}/${encodeURIComponent(date)}/${depth}.bin`;
    res = await fetch(fallbackUrl);
    if (!res.ok) {
      const altKey = depth === 0 ? '0.5' : String(Math.round(depth));
      const altUrl = `/tiles/${encodeURIComponent(variable)}/${encodeURIComponent(date)}/${altKey}.bin`;
      res = await fetch(altUrl);
    }
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch ocean tile: ${res.statusText}`);
  }

  const buffer = await res.arrayBuffer();
  const parsed = parseOceanTileBuffer(buffer, variable, depth, date);
  tileCache.set(cacheKey, parsed);
  if (typeof window !== 'undefined') {
    (window as any).__OCEAN_VERIFICATION__ = (window as any).__OCEAN_VERIFICATION__ || {};
    (window as any).__OCEAN_VERIFICATION__.lastFetchedTile = parsed;
  }
  return parsed;
}

if (typeof window !== 'undefined') {
  (window as any).__OCEAN_VERIFICATION__ = (window as any).__OCEAN_VERIFICATION__ || {};
  (window as any).__OCEAN_VERIFICATION__.fetchOceanTile = fetchOceanTile;
  (window as any).__OCEAN_VERIFICATION__.parseOceanTileBuffer = parseOceanTileBuffer;
}

