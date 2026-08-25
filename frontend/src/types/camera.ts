/**
 * Camera Viewport & Cinematic Preset Types
 */

export type CameraPreset = 'cinematic' | 'operational' | 'geospatial' | 'subsurface' | 'platform' | 'iso' | 'top' | 'front' | 'side' | 'reset';

export interface CameraState {
  preset: CameraPreset;
  azimuth: number;
  elevation: number;
  zoom: number;
  isTransitioning: boolean;
}
