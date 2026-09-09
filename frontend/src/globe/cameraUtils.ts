import * as Cesium from 'cesium';

export interface CameraState {
  lon: number;
  lat: number;
  height: number;
  pitch: number;
  heading: number;
}

export const DEFAULT_CAMERA_STATE: CameraState = {
  lon: 78.0,
  lat: 15.0,
  height: 24000000, // 24,000 km: frames entire globe
  pitch: -90.0,
  heading: 0.0
};

/**
 * Fly camera smoothly to geographic coordinates.
 */
export function flyToCoordinates(
  viewer: Cesium.Viewer,
  options: {
    lon: number;
    lat: number;
    height: number;
    pitch?: number;
    heading?: number;
    duration?: number;
  }
) {
  const {
    lon,
    lat,
    height,
    pitch = -90.0,
    heading = 0.0,
    duration = 2.0
  } = options;

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
    orientation: {
      heading: Cesium.Math.toRadians(heading),
      pitch: Cesium.Math.toRadians(pitch),
      roll: 0.0
    },
    duration
  });
}

/**
 * Extract current camera state in human-readable WGS84 coordinates.
 */
export function serializeCameraState(viewer: Cesium.Viewer): CameraState | null {
  const cartographic = viewer.camera.positionCartographic;
  if (!cartographic) return null;

  return {
    lon: parseFloat(Cesium.Math.toDegrees(cartographic.longitude).toFixed(4)),
    lat: parseFloat(Cesium.Math.toDegrees(cartographic.latitude).toFixed(4)),
    height: Math.round(cartographic.height),
    pitch: parseFloat(Cesium.Math.toDegrees(viewer.camera.pitch).toFixed(1)),
    heading: parseFloat(Cesium.Math.toDegrees(viewer.camera.heading).toFixed(1))
  };
}

/**
 * Instantly restore camera from a serialized state without animation (for permalink initialization).
 */
export function setCameraState(viewer: Cesium.Viewer, state: CameraState) {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.height),
    orientation: {
      heading: Cesium.Math.toRadians(state.heading),
      pitch: Cesium.Math.toRadians(state.pitch),
      roll: 0.0
    }
  });
}
