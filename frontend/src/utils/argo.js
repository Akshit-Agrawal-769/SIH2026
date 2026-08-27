/**
 * Argo In-Situ Utility Module
 * Handles trajectory normalization, chronological sorting, cycle deduplication,
 * longitude dateline wrapping, and metadata extraction.
 */

import { latLonToGlobe, interpolateGreatCircle } from './geography.js';

/**
 * Normalizes and sanitizes raw float trajectory points.
 * - Sorts chronologically by timestamp and cycle number
 * - Filters out invalid / NaN coordinates
 * - Deduplicates cycles (retaining latest valid coordinate for each cycle)
 *
 * @param {Array<Object>} rawTrajectory - Raw trajectory points from API
 * @param {Array<number>} [cycles=[]] - List of cycle numbers from float summary
 * @returns {Array<Object>} Sanitized, sorted trajectory points
 */
export function normalizeTrajectory(rawTrajectory = [], cycles = []) {
  if (!Array.isArray(rawTrajectory) || rawTrajectory.length === 0) {
    return [];
  }

  // 1. Filter valid points with valid numeric lat & lon
  const validPoints = rawTrajectory.filter((pt) => {
    if (!pt) return false;
    const lat = typeof pt.latitude === 'number' ? pt.latitude : parseFloat(pt.latitude);
    const lon = typeof pt.longitude === 'number' ? pt.longitude : parseFloat(pt.longitude);
    return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  });

  if (validPoints.length === 0) return [];

  // 2. Map into clean shape
  const cleaned = validPoints.map((pt, originalIndex) => {
    const lat = typeof pt.latitude === 'number' ? pt.latitude : parseFloat(pt.latitude);
    const lon = typeof pt.longitude === 'number' ? pt.longitude : parseFloat(pt.longitude);
    const cycle = typeof pt.cycle_number === 'number' ? pt.cycle_number : parseInt(pt.cycle_number, 10) || 1;
    const ts = pt.timestamp ? String(pt.timestamp) : null;
    const timeMs = ts ? new Date(ts).getTime() : 0;

    return {
      cycleNumber: cycle,
      latitude: lat,
      longitude: lon,
      timestamp: ts,
      timeMs: isNaN(timeMs) ? 0 : timeMs,
      originalIndex,
    };
  });

  // 3. Sort chronologically (by timestamp, fallback to cycle number)
  cleaned.sort((a, b) => {
    if (a.timeMs > 0 && b.timeMs > 0 && a.timeMs !== b.timeMs) {
      return a.timeMs - b.timeMs;
    }
    return a.cycleNumber - b.cycleNumber;
  });

  // 4. Deduplicate consecutive duplicate cycles or identical records
  const deduplicated = [];
  const seenCycles = new Map();

  for (const pt of cleaned) {
    // If we've seen this cycle, update with later record if valid
    seenCycles.set(pt.cycleNumber, pt);
  }

  // Convert map values to array maintaining chronological order
  for (const pt of cleaned) {
    if (seenCycles.get(pt.cycleNumber) === pt) {
      deduplicated.push(pt);
      seenCycles.delete(pt.cycleNumber); // Only push once
    }
  }

  return deduplicated;
}

/**
 * Splits a trajectory polyline into contiguous segments when crossing the antimeridian (180° / -180°).
 * Prevents visual artifacts where a segment crosses the entire globe (e.g. 179°E -> -179°W).
 *
 * @param {Array<{latitude: number, longitude: number}>} points - Trajectory points
 * @param {number} [thresholdDeg=180.0] - Longitude delta threshold indicating dateline crossing
 * @returns {Array<Array<{latitude: number, longitude: number}>>} Array of contiguous polyline segments
 */
export function splitTrajectoryAtDateline(points = [], thresholdDeg = 180.0) {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return [[points[0]]];

  const segments = [];
  let currentSegment = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const lonDiff = Math.abs(curr.longitude - prev.longitude);

    // If longitude jump is greater than threshold, break segment
    if (lonDiff > thresholdDeg) {
      segments.push(currentSegment);
      currentSegment = [curr];
    } else {
      currentSegment.push(curr);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Generates 3D Great-Circle spherical polyline vertices on a unit sphere with terrain offset.
 *
 * @param {Array<Object>} points - Trajectory points with latitude and longitude
 * @param {number} [radius=1.006] - Radius slightly above globe surface to avoid Z-fighting
 * @param {number} [subdivisionStepDeg=2.0] - Angular step size for smooth spherical curvature
 * @returns {Array<number>} Flat array of [x, y, z, x, y, z...] coordinates suitable for THREE.BufferGeometry
 */
export function generateSphericalTrajectoryVertices(points = [], radius = 1.006, subdivisionStepDeg = 2.0) {
  if (!points || points.length < 2) return [];

  const segments = splitTrajectoryAtDateline(points);
  const flatVertices = [];

  segments.forEach((seg) => {
    for (let i = 0; i < seg.length - 1; i++) {
      const p1 = seg[i];
      const p2 = seg[i + 1];

      const slerpPoints = interpolateGreatCircle(
        p1.latitude,
        p1.longitude,
        p2.latitude,
        p2.longitude,
        subdivisionStepDeg
      );

      slerpPoints.forEach((pt) => {
        const v = latLonToGlobe(pt.lat, pt.lon, radius);
        flatVertices.push(v.x, v.y, v.z);
      });
    }
  });

  return flatVertices;
}

/**
 * Calculates direction of travel heading angle in degrees (0° = North, 90° = East, 180° = South, 270° = West).
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Heading in degrees (0 to 360)
 */
export function calculateTravelHeadingDeg(lat1, lon1, lat2, lon2) {
  const phi1 = (lat1 * Math.PI) / 180.0;
  const phi2 = (lat2 * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);

  let brng = (Math.atan2(y, x) * 180.0) / Math.PI;
  return (brng + 360.0) % 360.0;
}

/**
 * Finds closest cycle point in trajectory.
 *
 * @param {Array<Object>} trajectory - Normalized trajectory
 * @param {number} cycleNumber - Requested cycle number
 * @returns {Object|null} Matching cycle record or nearest fallback
 */
export function findCycleInTrajectory(trajectory = [], cycleNumber) {
  if (!trajectory || trajectory.length === 0) return null;
  const match = trajectory.find((t) => t.cycleNumber === cycleNumber);
  if (match) return match;
  return trajectory[trajectory.length - 1];
}
