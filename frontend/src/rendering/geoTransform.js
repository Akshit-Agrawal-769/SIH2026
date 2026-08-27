import * as THREE from 'three';

/**
 * AUTHORITATIVE GEOGRAPHIC COORDINATE TRANSFORMATION SYSTEM
 * 
 * Canonical transformation between Geographic Coordinates (Latitude, Longitude, Altitude)
 * and Three.js 3D Cartesian Coordinates (X, Y, Z) on a spherical Earth.
 * 
 * Convention:
 * - Spherical Earth with canonical base radius R = 5.0 (Three.js world units).
 * - North Pole (+Y axis) is at Lat = +90°.
 * - South Pole (-Y axis) is at Lat = -90°.
 * - Prime Meridian (Lon = 0°) intersects Equator (Lat = 0°) along the +Z axis.
 * - East Longitudes (+Lon) proceed counter-clockwise around +Y toward the +X axis (Lon = +90°).
 * - West Longitudes (-Lon) proceed clockwise around +Y toward the -X axis (Lon = -90°).
 */

export const EARTH_RADIUS = 5.0;

/**
 * Converts Latitude, Longitude, and Altitude Offset to Three.js Cartesian Vector3.
 * 
 * @param {number} lat - Latitude in degrees [-90 to +90]
 * @param {number} lon - Longitude in degrees [-180 to +180]
 * @param {number} radius - Base sphere radius (defaults to EARTH_RADIUS = 5.0)
 * @param {number} altOffset - Height above sphere surface (defaults to 0.0)
 * @returns {THREE.Vector3} Cartesian 3D coordinate on or above the sphere
 */
export function latLonToVector3(lat, lon, radius = EARTH_RADIUS, altOffset = 0.0) {
  const r = radius + altOffset;
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 90) * (Math.PI / 180);

  const x = -r * Math.sin(phi) * Math.cos(theta);
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Converts a Three.js Cartesian Vector3 on or near the Earth sphere to Latitude and Longitude.
 * 
 * @param {THREE.Vector3} vec - Cartesian 3D position vector
 * @returns {{ latitude: number, longitude: number, altitude: number }}
 */
export function vector3ToLatLon(vec) {
  const norm = vec.clone().normalize();
  
  // Latitude: -90 to +90 degrees from Y axis
  const phi = Math.acos(Math.max(-1, Math.min(1, norm.y)));
  const latitude = 90 - phi * (180 / Math.PI);

  // Longitude: atan2 from X and Z axes
  const theta = Math.atan2(norm.z, -norm.x);
  let longitude = (theta * (180 / Math.PI)) - 90;

  // Normalize longitude to [-180, +180]
  while (longitude < -180) longitude += 360;
  while (longitude > 180) longitude -= 360;

  const altitude = Math.max(0, vec.length() - EARTH_RADIUS);

  return {
    latitude: Number(latitude.toFixed(5)),
    longitude: Number(longitude.toFixed(5)),
    altitude: Number(altitude.toFixed(4)),
  };
}

/**
 * Calculates Great-Circle Distance between two coordinates in kilometers using Haversine formula.
 * Earth mean radius = 6371.0 km.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in kilometers
 */
export function greatCircleDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Interpolates smoothly along a great circle arc between two lat/lon coordinates.
 * Uses SLERP on normalized spherical vectors.
 * 
 * @param {{ latitude: number, longitude: number }} start 
 * @param {{ latitude: number, longitude: number }} end 
 * @param {number} fraction - [0.0 to 1.0]
 * @returns {{ latitude: number, longitude: number }}
 */
export function interpolateGreatCircle(start, end, fraction) {
  const vStart = latLonToVector3(start.latitude, start.longitude, 1.0, 0.0);
  const vEnd = latLonToVector3(end.latitude, end.longitude, 1.0, 0.0);

  const dot = Math.max(-1, Math.min(1, vStart.dot(vEnd)));
  const theta = Math.acos(dot);

  if (Math.abs(theta) < 1e-6) {
    return { latitude: start.latitude, longitude: start.longitude };
  }

  const sinTheta = Math.sin(theta);
  const a = Math.sin((1 - fraction) * theta) / sinTheta;
  const b = Math.sin(fraction * theta) / sinTheta;

  const vInterp = new THREE.Vector3()
    .addScaledVector(vStart, a)
    .addScaledVector(vEnd, b)
    .normalize();

  return vector3ToLatLon(vInterp);
}

/**
 * Checks whether a given (latitude, longitude) coordinate falls within a bounding box.
 * 
 * @param {number} lat 
 * @param {number} lon 
 * @param {{ min_lat: number, max_lat: number, min_lon: number, max_lon: number }} bounds 
 * @returns {boolean}
 */
export function isInsideBounds(lat, lon, bounds) {
  if (!bounds) return false;
  const { min_lat, max_lat, min_lon, max_lon } = bounds;
  return lat >= min_lat && lat <= max_lat && lon >= min_lon && lon <= max_lon;
}

/**
 * Checks whether a coordinate is inside the authoritative INCOIS model domain.
 * Default domain is ~[30°E to 120°E, 30°S to 30°N] if metadata not loaded.
 * 
 * @param {number} lat 
 * @param {number} lon 
 * @param {object} modelMetadata 
 * @returns {boolean}
 */
export function isInsideModelDomain(lat, lon, modelMetadata = null) {
  const bounds = modelMetadata?.bounds || {
    min_lat: -30.0,
    max_lat: 30.0,
    min_lon: 30.0,
    max_lon: 120.0,
  };
  return isInsideBounds(lat, lon, bounds);
}
