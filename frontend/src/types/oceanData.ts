/**
 * Ocean Intelligence Data Interfaces & Domain Contracts
 * Standardized CF-compliant oceanographic state variables, NetCDF metadata,
 * Argo profiling trajectories, and 4D spatio-temporal validation metrics.
 */

export type OceanVariable = 'temp' | 'salt' | 'u' | 'v' | 'chl' | 'wave' | 'wind' | 'bathy';

export interface SpatialBounds {
  min_lon: number;
  max_lon: number;
  min_lat: number;
  max_lat: number;
  min_depth?: number;
  max_depth?: number;
}

export interface VolumeMetadata {
  minVal: number;
  maxVal: number;
  dimX: number;
  dimY: number;
  dimZ: number;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  minDepth: number;
  maxDepth: number;
  hasNan: boolean;
  nanValue: number;
  variable: OceanVariable | string;
  units: string;
}

export interface ArgoPosition {
  latitude: number;
  longitude: number;
}

export interface ArgoProfile {
  platform_number: string | number;
  cycle_number: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  depths: number[];
  values: (number | null)[];
  qc_flags?: number[];
}

export interface ArgoFloatSummary {
  platform_number: string | number;
  dac: string;
  latest_position: ArgoPosition;
  profiles_count: number;
  cycles: number[];
  variables: string[];
}

export interface ValidationMetrics {
  rmse: number;
  mae: number;
  bias: number;
  pearson_r: number | null;
  sample_count: number;
}

export interface ComparisonProfileData {
  platform_number: string | number;
  cycle_number: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  variable: OceanVariable | string;
  depths: number[];
  obs_values: (number | null)[];
  model_interpolated_values: (number | null)[];
  residuals: (number | null)[];
  metrics: ValidationMetrics;
}
