import { CameraState, DEFAULT_CAMERA_STATE } from '../globe/cameraUtils';
import type { OceanState } from './useOceanStore';

export interface SerializedAppState {
  camera: CameraState;
  layers: string[];
  depth: number;
  time: string;
  variable: string;
  mode: 'operational' | 'outreach';
}

/**
 * Parses URL search parameters into initial application state.
 */
export function parseUrlState(): Partial<SerializedAppState> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const result: Partial<SerializedAppState> = {};

  const lat = params.get('lat');
  const lon = params.get('lon');
  const h = params.get('h');
  const pitch = params.get('pitch');
  const heading = params.get('heading');

  if (lat && lon && h) {
    result.camera = {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      height: parseFloat(h),
      pitch: pitch ? parseFloat(pitch) : DEFAULT_CAMERA_STATE.pitch,
      heading: heading ? parseFloat(heading) : DEFAULT_CAMERA_STATE.heading
    };
  }

  const layers = params.get('layers');
  if (layers) {
    result.layers = layers.split(',').filter(Boolean);
  }

  const depth = params.get('depth');
  if (depth) {
    result.depth = parseFloat(depth);
  }

  const time = params.get('time');
  if (time) {
    result.time = time;
  }

  const variable = params.get('var');
  if (variable) {
    result.variable = variable;
  }

  const mode = params.get('mode');
  if (mode === 'operational' || mode === 'outreach') {
    result.mode = mode;
  }

  return result;
}

/**
 * Updates browser URL query string without triggering a page reload.
 */
export function syncStateToUrl(camera: CameraState | null, store: OceanState) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams();

  if (camera) {
    params.set('lat', camera.lat.toString());
    params.set('lon', camera.lon.toString());
    params.set('h', camera.height.toString());
    if (camera.pitch !== -90) params.set('pitch', camera.pitch.toString());
    if (camera.heading !== 0) params.set('heading', camera.heading.toString());
  }

  if (store.activeLayers.length > 0) {
    params.set('layers', store.activeLayers.join(','));
  }

  if (store.depthLevel !== 0.5) {
    params.set('depth', store.depthLevel.toString());
  }

  if (store.currentTime) {
    params.set('time', store.currentTime);
  }

  if (store.selectedVariable !== 'temperature') {
    params.set('var', store.selectedVariable);
  }

  if (store.mode !== 'operational') {
    params.set('mode', store.mode);
  }

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

/**
 * Generates an absolute permalink URL with current state.
 */
export function getShareableLink(): string {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}
