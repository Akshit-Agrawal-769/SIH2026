/**
 * Model-vs-observation and gridded analytics client.
 *
 * All statistics are computed by the Python engine (data-service/app/analytics_engine.py).
 * Comparisons also exist as static JSON produced by the same engine at build time, so a
 * static deployment still shows real metrics. Gridded analytics depend on arbitrary
 * coordinates and therefore require the live API; without it an explicit error is shown.
 */
import { API_BASE, dateKey, getJsonWithFallback, isHtmlResponse, liveApiAvailable } from './config';
import { canonicalInstrumentId } from './client';

export interface ComparisonPair {
  cycle: number;
  time: string;
  latitude: number;
  longitude: number;
  obs_depth: number;
  observation: number;
  model: number;
  residual: number;
  model_time: string;
  model_dt_days: number;
}

export interface ComparisonMetrics {
  sample_count: number;
  rmse: number | null;
  mae: number | null;
  bias: number | null;
  pearson_r: number | null;
  r_squared: number | null;
  obs_mean?: number | null;
  model_mean?: number | null;
  obs_std?: number | null;
  model_std?: number | null;
}

export interface ModelComparisonResponse {
  instrument_id: string;
  wmo?: string;
  platform_type?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  variable: string;
  units: string;
  model_name: string;
  model_source?: { title?: string; institution?: string; doi?: string; doi_url?: string; time_coverage?: [string, string]; vertical_levels?: string };
  model_date?: string;
  model_time_coverage?: [string, string];
  time_range?: [string, string];
  data_policy: string;
  available: boolean;
  reason?: string;
  metrics: ComparisonMetrics | null;
  method?: Record<string, string>;
  exclusions?: Record<string, number>;
  profiles_considered?: number;
  provenance?: {
    observation_source: string;
    observation_institution?: string;
    model_source: string;
    collocation_method: string;
    qc_mode: string;
  };
  pairs: ComparisonPair[];
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface TimeSeriesResponse {
  available: boolean;
  variable: string;
  units?: string;
  source_id?: string;
  lat: number;
  lon: number;
  depth: number;
  interval?: string;
  start_value?: number;
  end_value?: number;
  delta?: number;
  trend_slope_per_day?: number;
  trend_slope_per_30_days?: number;
  trend_method?: string;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  missing_dates?: string[];
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
  baseline_definition?: string;
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
  skipped?: Record<string, string>;
  note?: string;
  reason?: string;
}

export interface VerticalProfileResponse {
  available: boolean;
  variable: string;
  units?: string;
  lat: number;
  lon: number;
  date?: string;
  levels: { depth: number; value: number }[];
  model_depths?: number[];
  model_mld_meters?: number | null;
  model_mld_source?: string;
  surface_value?: number;
  bottom_value?: number;
  mld_meters?: number | null;
  thermocline_depth_meters?: number | null;
  max_gradient?: number | null;
  gradient_unit?: string;
  reason?: string;
}

export class AnalyticsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsUnavailableError';
  }
}

export async function fetchModelComparison(
  instrumentId: string,
  variable: string = 'temperature',
  signal?: AbortSignal
): Promise<ModelComparisonResponse> {
  const id = canonicalInstrumentId(instrumentId);
  const { data } = await getJsonWithFallback<ModelComparisonResponse>(
    `/comparison/${encodeURIComponent(id)}?variable=${encodeURIComponent(variable)}`,
    ['temperature', 'salinity'].includes(variable)
      ? `/comparison/${encodeURIComponent(id)}__${encodeURIComponent(variable)}.json`
      : null,
    signal
  ).catch((err) => {
    if (err?.name === 'AbortError') throw err;
    return {
      data: {
        instrument_id: id,
        variable,
        units: '',
        model_name: 'INCOIS Bio-ROMS (IBR)',
        data_policy: 'STRICT_REAL_DATA_ZERO_SYNTHETIC',
        available: false,
        reason: `No model counterpart for '${variable}' in this release (IBR surface matchups exist for temperature and salinity).`,
        metrics: null,
        pairs: []
      } as ModelComparisonResponse,
      source: 'static' as const
    };
  });
  return data;
}

async function liveAnalytics<T>(path: string, params: Record<string, string | number | undefined>, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') query.set(k, String(v));
  }
  if (liveApiAvailable() === false) {
    throw new AnalyticsUnavailableError(
      'Analytics API is not deployed on this host (static hosting). Configure VITE_API_BASE_URL to a running data-service.'
    );
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/analytics/${path}?${query.toString()}`, { signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new AnalyticsUnavailableError('Analytics API is unreachable.');
  }
  if (!res.ok || isHtmlResponse(res)) {
    throw new AnalyticsUnavailableError(
      res.status === 404
        ? 'Analytics API is not deployed on this host (static hosting). Configure VITE_API_BASE_URL to a running data-service.'
        : `Analytics API error (HTTP ${res.status}).`
    );
  }
  return res.json();
}

export function fetchTimeSeries(variable: string, lat: number, lon: number, depth: number, signal?: AbortSignal) {
  return liveAnalytics<TimeSeriesResponse>('timeseries', { variable, lat, lon, depth }, signal);
}

export function fetchAnomalies(variable: string, lat: number, lon: number, depth: number, date?: string, signal?: AbortSignal) {
  return liveAnalytics<AnomalyResponse>('anomalies', { variable, lat, lon, depth, date: date ? dateKey(date) : undefined }, signal);
}

export function fetchCorrelation(lat: number, lon: number, depth: number, date?: string, signal?: AbortSignal) {
  return liveAnalytics<CorrelationResponse>('correlation', { lat, lon, depth, date: date ? dateKey(date) : undefined }, signal);
}

export function fetchVerticalProfileAnalysis(lat: number, lon: number, variable: string, date?: string, signal?: AbortSignal) {
  return liveAnalytics<VerticalProfileResponse>('profile', { lat, lon, variable, date: date ? dateKey(date) : undefined }, signal);
}
