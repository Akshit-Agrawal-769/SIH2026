/**
 * Layer Management Interfaces for Ocean Intelligence Platform
 */

export type LayerCategory = 'ocean' | 'currents' | 'thermal' | 'saline' | 'bathymetry' | 'sensors' | 'infrastructure' | 'weather';

export interface EnvironmentalLayer {
  id: string;
  name: string;
  category: LayerCategory;
  description: string;
  enabled: boolean;
  opacity: number;
  variable?: string;
  units?: string;
  colorScale?: string;
  is3DVolumetric?: boolean;
}

export interface LayerState {
  oceanSurface: boolean;
  currentVectors: boolean;
  volumeRaymarch: boolean;
  depthSlice: boolean;
  bathymetricFloor: boolean;
  argoSensors: boolean;
  marinePlatform: boolean;
  weatherOverlay: boolean;
}
