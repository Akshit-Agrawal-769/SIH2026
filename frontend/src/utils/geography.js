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
