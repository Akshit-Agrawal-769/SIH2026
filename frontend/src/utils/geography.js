/**
 * Geography Utility Module
 * Single authoritative coordinate transform for all geospatial and Three.js layers:
 * - Ocean scientific volume / surface
 * - Natural Earth land polygons
 * - Natural Earth coastline vectors
 * - In-situ Argo profiling float markers
 * - Selected coordinate marker & target beacons
 * - Camera focus & navigation
 */

export const DEFAULT_INDIAN_OCEAN_BOUNDS = {
  minLon: 30.0,
  maxLon: 120.0,
  minLat: -30.0,
  maxLat: 30.0,
};

export const DEFAULT_GEOMETRY_SCALE = {
  xScale: 1.8,
  zScale: 1.2,
};

export const EARTH_RADIUS = 1.0;

/**
 * Authoritative Spherical Transformation: Converts (Latitude, Longitude) to 3D Cartesian coordinates on/above the Globe.
 * Uses standard Earth geometry with +Y as North Pole, Equator in XZ plane, and 0° Lon at (0, 0, radius).
 *
 * @param {number} lat - Latitude in degrees (-90 to +90)
 * @param {number} lon - Longitude in degrees (-180 to +180)
 * @param {number} [radius=EARTH_RADIUS] - Globe radius
 * @returns {{x: number, y: number, z: number}} 3D Cartesian coordinates
 */
export function latLonToGlobe(lat, lon, radius = EARTH_RADIUS) {
  const latRad = (lat * Math.PI) / 180.0;
  const lonRad = (lon * Math.PI) / 180.0;
  const cosLat = Math.cos(latRad);
  const x = radius * cosLat * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * cosLat * Math.cos(lonRad);
  return { x, y, z };
}

/**
 * Authoritative Inverse Spherical Transformation: Converts 3D Cartesian coordinates back to (Latitude, Longitude).
 *
 * @param {number} x - 3D X position
 * @param {number} y - 3D Y position
 * @param {number} z - 3D Z position
 * @returns {{lat: number, lon: number}} Geographic coordinates in degrees
 */
export function globeToLatLon(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-9) return { lat: 0, lon: 0 };
  const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) * (180.0 / Math.PI);
  const lon = Math.atan2(x, z) * (180.0 / Math.PI);
  return { lat, lon };
}

/**
 * Spherical Linear Interpolation (SLERP) for great-circle lines between two points.
 * Ensures coastlines and boundaries follow the spherical curvature without clipping the interior.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @param {number} [maxStepDeg=2.0]
 * @returns {Array<{lat: number, lon: number}>} Array of interpolated points
 */
export function interpolateGreatCircle(lat1, lon1, lat2, lon2, maxStepDeg = 2.0) {
  const p1 = latLonToGlobe(lat1, lon1, 1.0);
  const p2 = latLonToGlobe(lat2, lon2, 1.0);

  // Dot product
  let dot = p1.x * p2.x + p1.y * p2.y + p1.z * p2.z;
  dot = Math.max(-1, Math.min(1, dot));

  const omega = Math.acos(dot);
  const angularDistDeg = (omega * 180.0) / Math.PI;

  if (angularDistDeg <= maxStepDeg || omega < 1e-6) {
    return [
      { lat: lat1, lon: lon1 },
      { lat: lat2, lon: lon2 },
    ];
  }

  const steps = Math.min(64, Math.max(2, Math.ceil(angularDistDeg / maxStepDeg)));
  const points = [];
  const sinOmega = Math.sin(omega);

  for (let i = 0; i <= steps; i++) {
    if (i === 0) {
      points.push({ lat: lat1, lon: lon1 });
    } else if (i === steps) {
      points.push({ lat: lat2, lon: lon2 });
    } else {
      const t = i / steps;
      const s1 = Math.sin((1 - t) * omega) / sinOmega;
      const s2 = Math.sin(t * omega) / sinOmega;
      const ix = s1 * p1.x + s2 * p2.x;
      const iy = s1 * p1.y + s2 * p2.y;
      const iz = s1 * p1.z + s2 * p2.z;
      points.push(globeToLatLon(ix, iy, iz));
    }
  }

  return points;
}

/**
 * Validates whether a coordinate lies strictly within the INCOIS Bio-ROMS simulation domain.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Object} [bounds=DEFAULT_INDIAN_OCEAN_BOUNDS]
 * @returns {boolean}
 */
export function isInsideModelDomain(lat, lon, bounds = DEFAULT_INDIAN_OCEAN_BOUNDS) {
  const minLon = bounds?.minLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLon;
  const maxLon = bounds?.maxLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLon;
  const minLat = bounds?.minLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLat;
  const maxLat = bounds?.maxLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLat;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * Transforms geographic (Longitude, Latitude) to Three.js World Coordinates (X, Y, Z).
 * Preserves the exact ~3:2 geographic aspect ratio of the Indian Ocean domain.
 *
 * @param {number} lon - Longitude in degrees (-180 to 180)
 * @param {number} lat - Latitude in degrees (-90 to 90)
 * @param {number} [y=0] - World Y elevation
 * @param {Object} [bounds=DEFAULT_INDIAN_OCEAN_BOUNDS] - Domain bounds
 * @param {Object} [scale=DEFAULT_GEOMETRY_SCALE] - Domain geometry dimensions
 * @returns {{x: number, y: number, z: number}} World coordinate vector
 */
export function lonLatToWorld(
  lon,
  lat,
  y = 0,
  bounds = DEFAULT_INDIAN_OCEAN_BOUNDS,
  scale = DEFAULT_GEOMETRY_SCALE
) {
  const minLon = bounds?.minLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLon;
  const maxLon = bounds?.maxLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLon;
  const minLat = bounds?.minLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLat;
  const maxLat = bounds?.maxLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLat;

  const xScale = scale?.xScale ?? DEFAULT_GEOMETRY_SCALE.xScale;
  const zScale = scale?.zScale ?? DEFAULT_GEOMETRY_SCALE.zScale;

  const lonSpan = maxLon > minLon ? maxLon - minLon : 90.0;
  const latSpan = maxLat > minLat ? maxLat - minLat : 60.0;

  const normX = ((lon - minLon) / lonSpan - 0.5) * xScale;
  const normZ = ((lat - minLat) / latSpan - 0.5) * zScale;

  return { x: normX, y, z: normZ };
}

/**
 * Transforms Three.js World Coordinates (X, Z) back to geographic (Longitude, Latitude).
 *
 * @param {number} x - World X position
 * @param {number} z - World Z position
 * @param {Object} [bounds=DEFAULT_INDIAN_OCEAN_BOUNDS] - Domain bounds
 * @param {Object} [scale=DEFAULT_GEOMETRY_SCALE] - Domain geometry dimensions
 * @returns {{lon: number, lat: number}} Geographic coordinate
 */
export function worldToLonLat(
  x,
  z,
  bounds = DEFAULT_INDIAN_OCEAN_BOUNDS,
  scale = DEFAULT_GEOMETRY_SCALE
) {
  const minLon = bounds?.minLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLon;
  const maxLon = bounds?.maxLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLon;
  const minLat = bounds?.minLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLat;
  const maxLat = bounds?.maxLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLat;

  const xScale = scale?.xScale ?? DEFAULT_GEOMETRY_SCALE.xScale;
  const zScale = scale?.zScale ?? DEFAULT_GEOMETRY_SCALE.zScale;

  const lonSpan = maxLon > minLon ? maxLon - minLon : 90.0;
  const latSpan = maxLat > minLat ? maxLat - minLat : 60.0;

  const lon = minLon + (x / xScale + 0.5) * lonSpan;
  const lat = minLat + (z / zScale + 0.5) * latSpan;

  return { lon, lat };
}

/**
 * Validates whether a coordinate falls within the active dataset domain bounds.
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {Object} [bounds=DEFAULT_INDIAN_OCEAN_BOUNDS] - Domain bounds
 * @returns {{isValid: boolean, error: string|null}} Validation result
 */
export function validateCoordinates(lat, lon, bounds = DEFAULT_INDIAN_OCEAN_BOUNDS) {
  const minLon = bounds?.minLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLon;
  const maxLon = bounds?.maxLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLon;
  const minLat = bounds?.minLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLat;
  const maxLat = bounds?.maxLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLat;

  if (typeof lat !== 'number' || isNaN(lat)) {
    return { isValid: false, error: 'Latitude must be a valid number.' };
  }
  if (typeof lon !== 'number' || isNaN(lon)) {
    return { isValid: false, error: 'Longitude must be a valid number.' };
  }
  if (lat < minLat || lat > maxLat) {
    return {
      isValid: false,
      error: `Latitude ${lat.toFixed(2)}° is outside active domain [${minLat.toFixed(1)}°, ${maxLat.toFixed(1)}°].`,
    };
  }
  if (lon < minLon || lon > maxLon) {
    return {
      isValid: false,
      error: `Longitude ${lon.toFixed(2)}° is outside active domain [${minLon.toFixed(1)}°, ${maxLon.toFixed(1)}°].`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Calculates Great-Circle Haversine distance between two coordinates in kilometers.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates nearest model grid coordinate and offset distance.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} [gridRes=0.0833] - Grid resolution in degrees (~1/12 deg)
 * @param {Object} [bounds=DEFAULT_INDIAN_OCEAN_BOUNDS]
 * @returns {{nearestLat: number, nearestLon: number, distanceKm: number}}
 */
export function calculateNearestGridCell(
  lat,
  lon,
  gridRes = 0.083333,
  bounds = DEFAULT_INDIAN_OCEAN_BOUNDS
) {
  const minLon = bounds?.minLon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLon;
  const minLat = bounds?.minLat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLat;

  const iLon = Math.round((lon - minLon) / gridRes);
  const iLat = Math.round((lat - minLat) / gridRes);

  const nearestLon = minLon + iLon * gridRes;
  const nearestLat = minLat + iLat * gridRes;
  const distanceKm = haversineDistanceKm(lat, lon, nearestLat, nearestLon);

  return { nearestLat, nearestLon, distanceKm };
}

/**
 * Authoritative Indian Ocean oceanographic study regimes.
 */
export const INDIAN_OCEAN_PRESETS = [
  {
    id: 'arabian_sea',
    label: 'Arabian Sea Central Basin',
    lat: 12.83,
    lon: 69.0,
    depth: 3400,
    desc: 'High seasonal salinity, intense winter cooling, and oxygen minimum zone dynamics.',
  },
  {
    id: 'bay_of_bengal',
    label: 'Bay of Bengal Deep Zone',
    lat: 13.69,
    lon: 88.07,
    depth: 2800,
    desc: 'Freshwater barrier layer, severe cyclone genesis zone, and monsoonal river influx.',
  },
  {
    id: 'equatorial',
    label: 'Equatorial Indian Ocean',
    lat: 0.0,
    lon: 80.0,
    depth: 4200,
    desc: 'Wyrtki jets, Kelvin wave propagation, and Indian Ocean Dipole (IOD) equatorial axis.',
  },
  {
    id: 'somali_current',
    label: 'Somali Current Coastal Upwelling',
    lat: 8.5,
    lon: 52.0,
    depth: 1800,
    desc: 'Intense SW Monsoon western boundary current upwelling and strong nutrient enrichment.',
  },
  {
    id: 'sw_indian_ridge',
    label: 'Southwest Indian Ocean Ridge',
    lat: -25.0,
    lon: 65.0,
    depth: 4800,
    desc: 'Subtropical gyre transition zone, deep bottom water transport, and abyssal bathymetry.',
  },
  {
    id: 'andaman_sea',
    label: 'Andaman Sea Basin',
    lat: 10.5,
    lon: 95.0,
    depth: 2200,
    desc: 'Internal solitary wave hotspot, shallow sill mixing, and Southeast Asian marginal basin.',
  },
];
