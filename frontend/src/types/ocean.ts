export type OceanVariable = 'temp' | 'salt' | 'u' | 'v' | 'w' | 'chl';

export interface DatasetHealth {
  status: 'healthy' | 'REAL DATASET REQUIRED';
  available_datasets: string[];
  missing_datasets: string[];
  data_policy: string;
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
  metrics: {
    bias: number;
    mae: number;
    rmse: number;
    pearson_r: number;
    sample_count: number;
  };
}
