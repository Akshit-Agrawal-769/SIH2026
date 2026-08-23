export type OceanVariable = 'temp' | 'salt' | 'u' | 'v' | 'chl';
export type ColormapType = 'turbo' | 'viridis' | 'thermal' | 'jet';
export type RenderMode = 'volume' | 'slice' | 'iso';

export interface DatasetHealth {
  status: 'healthy' | 'REAL DATASET REQUIRED';
  available_datasets: string[];
  missing_datasets: string[];
  data_policy: string;
}

export interface DatasetMetadata {
  filename: string;
  title: string;
  source: string;
  bounds: {
    min_lon: number;
    max_lon: number;
    min_lat: number;
    max_lat: number;
  };
  depth_levels: number[];
  time_range: string[];
  variables: string[];
  variable_info: Record<string, {
    long_name: string;
    units: string;
    shape: number[];
  }>;
  dimensions: Record<string, number>;
}

export interface VolumeMetadata {
  minVal: number;
  maxVal: number;
  dimX: number;
  dimY: number;
  dimZ: number;
  variable: string;
  units: string;
}

export interface ArgoTrajectoryPoint {
  cycle_number: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  depth_max: number;
}

export interface ArgoFloatSummary {
  platform_number: string;
  filename: string;
  profiles_count: number;
  latest_position: {
    latitude: number;
    longitude: number;
  };
  cycles: number[];
  trajectory: ArgoTrajectoryPoint[];
}

export interface ArgoProfile {
  platform_number: string;
  cycle_number: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  depths: number[];
  temperature: number[];
  salinity?: number[];
  qc_flags: number[];
}

export interface ComparisonMetrics {
  bias: number;
  mae: number;
  rmse: number;
  pearson_r: number;
  sample_count: number;
}

export interface ModelVsObsComparison {
  platform_number: string;
  cycle_number: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  depths: number[];
  obs_values: number[];
  model_interpolated_values: number[];
  residuals: number[];
  variable: string;
  metrics: ComparisonMetrics;
}
