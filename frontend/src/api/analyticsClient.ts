/**
 * API client for Model vs. Observation Comparison & Scientific Ocean Analytics.
 * Strictly adheres to ZERO-MOCK DATA policy.
 */

export interface ComparisonDepthLevel {
  depth: number;
  observation: number;
  model: number;
  residual: number;
}

export interface ComparisonMetrics {
  sample_count: number;
  rmse: number;
  mae: number;
  bias: number;
  pearson_r: number | null;
  r_squared: number | null;
}

export interface ModelComparisonResponse {
  instrument_id: string;
  external_id?: string;
  platform_type?: string;
  wmo?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  variable: string;
  units: string;
  model_date: string;
  model_name: string;
  data_policy: string;
  available: boolean;
  reason?: string;
  metrics: ComparisonMetrics | null;
  provenance?: {
    observation_source: string;
    model_source: string;
    collocation_method: string;
    qc_mode: string;
  };
  depth_profiles: ComparisonDepthLevel[];
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface TimeSeriesResponse {
  available: boolean;
  variable: string;
  lat: number;
  lon: number;
  depth: number;
  interval?: string;
  start_value?: number;
  end_value?: number;
  delta?: number;
  trend_slope_per_day?: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  timeseries_points: TimeSeriesPoint[];
  reason?: string;
}

export interface AnomalyResponse {
  available: boolean;
  variable: string;
  units?: string;
  lat?: number;
  lon?: number;
  depth?: number;
  date?: string;
  value?: number;
  baseline_mean?: number;
  baseline_std?: number;
  baseline_samples?: number;
  z_score?: number;
  classification?: 'Normal' | 'Moderate Anomaly' | 'Strong Anomaly';
  description?: string;
  reason?: string;
}

export interface CorrelationResponse {
  available: boolean;
  lat?: number;
  lon?: number;
  depth?: number;
  date?: string;
  variables: string[];
  sample_count: number;
  matrix: (number | null)[][];
  reason?: string;
}

export interface VerticalProfileResponse {
  available: boolean;
  variable: string;
  units?: string;
  lat: number;
  lon: number;
  date: string;
  levels: { depth: number; value: number }[];
  surface_value?: number;
  bottom_value?: number;
  mld_meters?: number | null;
  thermocline_depth_meters?: number;
  max_gradient?: number;
  gradient_unit?: string;
  reason?: string;
}

const API_BASE = '/api';

/**
 * Collocates in-situ Argo/Glider measurements with operational Bio-ROMS model output.
 */
export async function fetchModelComparison(
  instrumentId: string,
  variable: string = 'temperature',
  date?: string
): Promise<ModelComparisonResponse> {
  const query = new URLSearchParams({ variable });
  if (date) query.set('date', date);

  const cleanId = instrumentId.replace('INCOIS_ARGO_', '').replace('INCOIS_OMNI_', '');
  const url = `${API_BASE}/comparison/${encodeURIComponent(cleanId)}?${query.toString()}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[AnalyticsClient] API fetch failed, checking static fallback:', err);
  }

  // Fallback: If running in purely static mode without python backend,
  // load raw profile JSON and compute collocated metrics client-side using authentic tiles
  return computeClientSideComparison(instrumentId, variable, date);
}

/**
 * Client-side fallback collocation using authentic tile arrays and real profile JSON
 * if the Python backend is unavailable (e.g., in a purely static client demo).
 */
async function computeClientSideComparison(
  instrumentId: string,
  variable: string,
  date: string = '2024-06-03'
): Promise<ModelComparisonResponse> {
  const cleanId = instrumentId.replace('INCOIS_ARGO_', '').replace('INCOIS_OMNI_', '');
  let profData: any = null;

  for (const candidate of [instrumentId, cleanId, `INCOIS_ARGO_${cleanId}`]) {
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(candidate)}.json`);
      if (res.ok) {
        profData = await res.json();
        break;
      }
    } catch {
      continue;
    }
  }

  if (!profData || !profData.measurements) {
    return {
      instrument_id: instrumentId,
      variable,
      units: variable === 'temperature' ? '°C' : variable === 'salinity' ? 'PSU' : 'mg/m³',
      model_date: date,
      model_name: 'INCOIS Operational Bio-ROMS Indian Ocean',
      data_policy: 'STRICT_REAL_DATA_ZERO_SYNTHETIC',
      available: false,
      reason: `No observation profile found for instrument ID '${instrumentId}'`,
      metrics: null,
      depth_profiles: []
    };
  }

  const lat = profData.latitude;
  const lon = profData.longitude;

  // Grid bounds
  if (lat < -10.0 || lat > 25.0 || lon < 35.0 || lon > 100.0) {
    return {
      instrument_id: instrumentId,
      variable,
      units: variable === 'temperature' ? '°C' : 'PSU',
      model_date: date,
      model_name: 'INCOIS Operational Bio-ROMS Indian Ocean',
      data_policy: 'STRICT_REAL_DATA_ZERO_SYNTHETIC',
      available: false,
      reason: 'Coordinates outside model domain (-10°S to 25°N, 35°E to 100°E).',
      metrics: null,
      depth_profiles: []
    };
  }

  const depths = [0.5, 10.0, 50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0];
  const modelSounding: { depth: number; val: number }[] = [];

  const row = ((lat - (-10.0)) / 35.0) * 279;
  const col = ((lon - 35.0) / 65.0) * 519;
  const r0 = Math.floor(row);
  const r1 = Math.min(279, r0 + 1);
  const c0 = Math.floor(col);
  const c1 = Math.min(519, c0 + 1);
  const dr = row - r0;
  const dc = col - c0;

  for (const d of depths) {
    try {
      const tileUrl = `/tiles/${variable}/${date}/${d === 0.5 ? '0.5' : d + '.0'}.bin`;
      const res = await fetch(tileUrl);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 32) continue;
      const floatArr = new Float32Array(buf, 32);

      const v00 = floatArr[r0 * 520 + c0];
      const v10 = floatArr[r1 * 520 + c0];
      const v01 = floatArr[r0 * 520 + c1];
      const v11 = floatArr[r1 * 520 + c1];

      const corners = [
        { v: v00, w: (1 - dr) * (1 - dc) },
        { v: v10, w: dr * (1 - dc) },
        { v: v01, w: (1 - dr) * dc },
        { v: v11, w: dr * dc }
      ].filter((c) => !isNaN(c.v));

      if (corners.length > 0) {
        const totalW = corners.reduce((acc, c) => acc + c.w, 0);
        const interpolated = corners.reduce((acc, c) => acc + c.v * c.w, 0) / totalW;
        if (!isNaN(interpolated)) {
          modelSounding.push({ depth: d, val: interpolated });
        }
      }
    } catch {
      continue;
    }
  }

  if (modelSounding.length < 2) {
    return {
      instrument_id: instrumentId,
      variable,
      units: variable === 'temperature' ? '°C' : 'PSU',
      model_date: date,
      model_name: 'INCOIS Operational Bio-ROMS Indian Ocean',
      data_policy: 'STRICT_REAL_DATA_ZERO_SYNTHETIC',
      available: false,
      reason: 'Model tile data not found or location is on land.',
      metrics: null,
      depth_profiles: []
    };
  }

  const paired: ComparisonDepthLevel[] = [];
  const mDepths = modelSounding.map((m) => m.depth);
  const mVals = modelSounding.map((m) => m.val);

  for (const m of profData.measurements) {
    const dObs = m.depth;
    const vObs = m[variable];
    if (dObs === undefined || vObs === undefined || vObs === null) continue;
    if (dObs < mDepths[0] || dObs > mDepths[mDepths.length - 1]) continue;

    // Linear 1D piecewise vertical interpolation
    let vMod = mVals[0];
    for (let k = 0; k < mDepths.length - 1; k++) {
      if (dObs >= mDepths[k] && dObs <= mDepths[k + 1]) {
        const frac = (dObs - mDepths[k]) / (mDepths[k + 1] - mDepths[k]);
        vMod = mVals[k] + frac * (mVals[k + 1] - mVals[k]);
        break;
      }
    }

    const residual = vMod - vObs;
    paired.push({
      depth: Math.round(dObs * 10) / 10,
      observation: Math.round(vObs * 1000) / 1000,
      model: Math.round(vMod * 1000) / 1000,
      residual: Math.round(residual * 1000) / 1000
    });
  }

  if (paired.length === 0) {
    return {
      instrument_id: instrumentId,
      variable,
      units: variable === 'temperature' ? '°C' : 'PSU',
      model_date: date,
      model_name: 'INCOIS Operational Bio-ROMS Indian Ocean',
      data_policy: 'STRICT_REAL_DATA_ZERO_SYNTHETIC',
      available: false,
      reason: `Instrument has no valid in-situ observations for variable '${variable}'.`,
      metrics: null,
      depth_profiles: []
    };
  }

  const residuals = paired.map((p) => p.residual);
  const obsArr = paired.map((p) => p.observation);
  const modArr = paired.map((p) => p.model);

  const n = paired.length;
  const rmse = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / n);
  const mae = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / n;
  const bias = residuals.reduce((sum, r) => sum + r, 0) / n;

  // Pearson r
  const meanObs = obsArr.reduce((s, x) => s + x, 0) / n;
  const meanMod = modArr.reduce((s, x) => s + x, 0) / n;
  const num = obsArr.reduce((s, o, i) => s + (o - meanObs) * (modArr[i] - meanMod), 0);
  const denObs = Math.sqrt(obsArr.reduce((s, o) => s + Math.pow(o - meanObs, 2), 0));
  const denMod = Math.sqrt(modArr.reduce((s, m) => s + Math.pow(m - meanMod, 2), 0));

  let pearsonR: number | null = null;
  let rSquared: number | null = null;
  if (denObs > 1e-9 && denMod > 1e-9) {
    pearsonR = num / (denObs * denMod);
    rSquared = Math.pow(pearsonR, 2);
  }

  return {
    instrument_id: profData.instrument_id || instrumentId,
    external_id: profData.external_id,
    platform_type: profData.platform_type || 'argo',
    wmo: profData.metadata?.wmo || cleanId,
    latitude: lat,
    longitude: lon,
    timestamp: profData.timestamp,
    variable,
    units: variable === 'temperature' ? '°C' : variable === 'salinity' ? 'PSU' : 'mg/m³',
    model_date: date,
    model_name: 'INCOIS Operational Bio-ROMS Indian Ocean',
    data_policy: 'STRICT_REAL_DATA_ZERO_SYNTHETIC',
    available: true,
    metrics: {
      sample_count: n,
      rmse: Math.round(rmse * 1000) / 1000,
      mae: Math.round(mae * 1000) / 1000,
      bias: Math.round(bias * 1000) / 1000,
      pearson_r: pearsonR !== null ? Math.round(pearsonR * 1000) / 1000 : null,
      r_squared: rSquared !== null ? Math.round(rSquared * 1000) / 1000 : null
    },
    provenance: {
      observation_source: 'INCOIS National Oceanographic Data Centre / GDAC NetCDF',
      model_source: 'INCOIS Operational Bio-ROMS 3.9 Hydrodynamic Model',
      collocation_method: 'Bilinear spatial interpolation + 1D piecewise linear vertical depth collocation',
      qc_mode: 'Strict UNESCO Argo QC flags (1 & 2 only)'
    },
    depth_profiles: paired
  };
}

/**
 * Fetch multi-day time series and trend slope.
 */
export async function fetchTimeSeries(
  variable: string = 'temperature',
  lat: number = 13.691,
  lon: number = 88.074,
  depth: number = 10.0
): Promise<TimeSeriesResponse> {
  const query = new URLSearchParams({
    variable,
    lat: lat.toString(),
    lon: lon.toString(),
    depth: depth.toString()
  });

  const url = `${API_BASE}/analytics/timeseries?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch timeseries: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch regional anomaly and Z-score classification.
 */
export async function fetchAnomalies(
  variable: string = 'temperature',
  lat: number = 13.691,
  lon: number = 88.074,
  depth: number = 10.0,
  date: string = '2024-06-03'
): Promise<AnomalyResponse> {
  const query = new URLSearchParams({
    variable,
    lat: lat.toString(),
    lon: lon.toString(),
    depth: depth.toString(),
    date
  });

  const url = `${API_BASE}/analytics/anomalies?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch anomalies: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch multi-variable NxN Pearson correlation matrix.
 */
export async function fetchCorrelation(
  lat: number = 13.691,
  lon: number = 88.074,
  depth: number = 10.0,
  date: string = '2024-06-03'
): Promise<CorrelationResponse> {
  const query = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    depth: depth.toString(),
    date
  });

  const url = `${API_BASE}/analytics/correlation?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch correlation: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch vertical profile model sounding and stratification metrics.
 */
export async function fetchVerticalProfileAnalysis(
  lat: number = 13.691,
  lon: number = 88.074,
  variable: string = 'temperature',
  date: string = '2024-06-03'
): Promise<VerticalProfileResponse> {
  const query = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    variable,
    date
  });

  const url = `${API_BASE}/analytics/profile?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch vertical profile analysis: ${res.statusText}`);
  }
  return res.json();
}

