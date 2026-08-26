/**
 * Comprehensive Geographic & Navigation Test Suite
 * Tests deterministic coordinate transformations, round-trip mappings, bounds, and GeoJSON validity.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lonLatToWorld,
  worldToLonLat,
  latLonToGlobe,
  globeToLatLon,
  interpolateGreatCircle,
  isInsideModelDomain,
  validateCoordinates,
  haversineDistanceKm,
  calculateNearestGridCell,
  DEFAULT_INDIAN_OCEAN_BOUNDS,
  DEFAULT_GEOMETRY_SCALE,
  EARTH_RADIUS,
} from '../src/utils/geography.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('RUNNING GEOGRAPHIC & NAVIGATION TEST SUITE');
console.log('====================================================');

// Test 1: Center Point Mapping
{
  console.log('[TEST 1] Domain Center maps to (0, 0) world space');
  const centerLon = (DEFAULT_INDIAN_OCEAN_BOUNDS.minLon + DEFAULT_INDIAN_OCEAN_BOUNDS.maxLon) / 2; // 75.0°E
  const centerLat = (DEFAULT_INDIAN_OCEAN_BOUNDS.minLat + DEFAULT_INDIAN_OCEAN_BOUNDS.maxLat) / 2; // 0.0°
  const world = lonLatToWorld(centerLon, centerLat, 0.3);

  assert.ok(Math.abs(world.x) < 1e-6, `Center X expected 0, got ${world.x}`);
  assert.ok(Math.abs(world.z) < 1e-6, `Center Z expected 0, got ${world.z}`);
  assert.strictEqual(world.y, 0.3);
  console.log('  ✓ Center point (75°E, 0°N) -> (0, 0.3, 0) PASSED');
}

// Test 2: Bounding Corner Mappings
{
  console.log('[TEST 2] Domain Corners map to exact world box extents');
  // SW Corner (30°E, -30°S)
  const sw = lonLatToWorld(30.0, -30.0);
  assert.ok(Math.abs(sw.x - (-0.9)) < 1e-6, `SW X expected -0.9, got ${sw.x}`);
  assert.ok(Math.abs(sw.z - (-0.6)) < 1e-6, `SW Z expected -0.6, got ${sw.z}`);

  // NE Corner (120°E, 30°N)
  const ne = lonLatToWorld(120.0, 30.0);
  assert.ok(Math.abs(ne.x - 0.9) < 1e-6, `NE X expected 0.9, got ${ne.x}`);
  assert.ok(Math.abs(ne.z - 0.6) < 1e-6, `NE Z expected 0.6, got ${ne.z}`);
  console.log('  ✓ SW Corner (30°E, -30°S) -> (-0.9, -0.6) and NE Corner (120°E, 30°N) -> (0.9, 0.6) PASSED');
}

// Test 3: Known Key Geographic Points
{
  console.log('[TEST 3] Known Indian Ocean stations and Argo positions');
  // Argo 2902120 (12.83°N, 69.00°E) - Arabian Sea
  const argo1 = lonLatToWorld(69.00, 12.83);
  assert.ok(argo1.x > -0.9 && argo1.x < 0.9, 'Argo 1 X within bounds');
  assert.ok(argo1.z > -0.6 && argo1.z < 0.6, 'Argo 1 Z within bounds');

  // Argo 2902084 (13.69°N, 88.07°E) - Bay of Bengal
  const argo2 = lonLatToWorld(88.07, 13.69);
  assert.ok(argo2.x > -0.9 && argo2.x < 0.9, 'Argo 2 X within bounds');
  assert.ok(argo2.z > -0.6 && argo2.z < 0.6, 'Argo 2 Z within bounds');

  // Relative positions: Bay of Bengal is East of Arabian Sea
  assert.ok(argo2.x > argo1.x, 'Bay of Bengal float must be East (greater X) than Arabian Sea float');
  console.log('  ✓ Known Argo positions correctly mapped in world space PASSED');
}

// Test 4: Round-Trip LonLat <-> World Space Inversion
{
  console.log('[TEST 4] Bijective round-trip LonLat <-> World conversion');
  const testPoints = [
    { lon: 30.0, lat: -30.0 },
    { lon: 120.0, lat: 30.0 },
    { lon: 69.0, lat: 12.83 },
    { lon: 88.07, lat: 13.69 },
    { lon: 52.0, lat: 8.5 },
    { lon: 95.0, lat: 10.5 },
    { lon: 75.0, lat: 0.0 },
  ];

  testPoints.forEach((pt) => {
    const world = lonLatToWorld(pt.lon, pt.lat);
    const roundTrip = worldToLonLat(world.x, world.z);
    assert.ok(
      Math.abs(roundTrip.lon - pt.lon) < 1e-5,
      `Lon round-trip failed: original ${pt.lon}, got ${roundTrip.lon}`
    );
    assert.ok(
      Math.abs(roundTrip.lat - pt.lat) < 1e-5,
      `Lat round-trip failed: original ${pt.lat}, got ${roundTrip.lat}`
    );
  });
  console.log(`  ✓ All ${testPoints.length} test coordinates inverted with zero error (< 1e-5 deg) PASSED`);
}

// Test 5: Dynamic Bounds Support
{
  console.log('[TEST 5] Dynamic domain bounds scaling');
  const customBounds = { minLon: 40.0, maxLon: 100.0, minLat: -20.0, maxLat: 20.0 };
  const customScale = { xScale: 2.0, zScale: 1.0 };

  const center = lonLatToWorld(70.0, 0.0, 0, customBounds, customScale);
  assert.ok(Math.abs(center.x) < 1e-6);
  assert.ok(Math.abs(center.z) < 1e-6);

  const sw = lonLatToWorld(40.0, -20.0, 0, customBounds, customScale);
  assert.ok(Math.abs(sw.x - (-1.0)) < 1e-6);
  assert.ok(Math.abs(sw.z - (-0.5)) < 1e-6);
  console.log('  ✓ Dynamic bounds and custom geometry scales properly evaluated PASSED');
}

// Test 6: Coordinate Validation & Error Reporting
{
  console.log('[TEST 6] Coordinate domain validation');
  // Valid points
  assert.strictEqual(validateCoordinates(12.83, 69.0).isValid, true);
  assert.strictEqual(validateCoordinates(-30.0, 30.0).isValid, true);
  assert.strictEqual(validateCoordinates(30.0, 120.0).isValid, true);

  // Invalid points
  assert.strictEqual(validateCoordinates(35.0, 69.0).isValid, false); // Lat too high
  assert.strictEqual(validateCoordinates(-35.0, 69.0).isValid, false); // Lat too low
  assert.strictEqual(validateCoordinates(12.83, 25.0).isValid, false); // Lon too low
  assert.strictEqual(validateCoordinates(12.83, 125.0).isValid, false); // Lon too high
  assert.strictEqual(validateCoordinates('invalid', 69.0).isValid, false);
  console.log('  ✓ Valid/invalid domain coordinates accurately classified PASSED');
}

// Test 7: Haversine Great-Circle Distance
{
  console.log('[TEST 7] Haversine Distance computation');
  // Distance from (0, 0) to (0, 1) at equator ~ 111.19 km
  const dist1Deg = haversineDistanceKm(0, 0, 0, 1);
  assert.ok(Math.abs(dist1Deg - 111.19) < 1.0, `1 deg longitude at equator should be ~111.19 km, got ${dist1Deg}`);

  // Same point distance is 0
  const distZero = haversineDistanceKm(12.83, 69.0, 12.83, 69.0);
  assert.ok(distZero < 1e-6);
  console.log('  ✓ Great-circle physical distance calculations verified PASSED');
}

// Test 8: GeoJSON Assets Integrity Gate
{
  console.log('[TEST 8] Natural Earth GeoJSON assets verification');
  const coastlinePath = path.resolve(__dirname, '../public/geography/coastline.geojson');
  const landPath = path.resolve(__dirname, '../public/geography/land.geojson');

  assert.ok(fs.existsSync(coastlinePath), 'coastline.geojson must exist in public/geography/');
  assert.ok(fs.existsSync(landPath), 'land.geojson must exist in public/geography/');

  const coastlineJson = JSON.parse(fs.readFileSync(coastlinePath, 'utf8'));
  const landJson = JSON.parse(fs.readFileSync(landPath, 'utf8'));

  assert.strictEqual(coastlineJson.type, 'FeatureCollection');
  assert.ok(coastlineJson.features.length > 500, `Expected > 500 coastline features, got ${coastlineJson.features.length}`);

  assert.strictEqual(landJson.type, 'FeatureCollection');
  assert.ok(landJson.features.length > 0, `Expected land features, got ${landJson.features.length}`);

  console.log(`  ✓ Coastline features (${coastlineJson.features.length}) and Land features (${landJson.features.length}) verified PASSED`);
}

// Test 9: Spherical Globe Coordinate Transformations
{
  console.log('[TEST 9] Spherical Globe latLonToGlobe & globeToLatLon');
  // North Pole (90°N, 0°E) -> (0, 1, 0)
  const np = latLonToGlobe(90.0, 0.0, 1.0);
  assert.ok(Math.abs(np.x) < 1e-6 && Math.abs(np.y - 1.0) < 1e-6 && Math.abs(np.z) < 1e-6);

  // South Pole (-90°S, 0°E) -> (0, -1, 0)
  const sp = latLonToGlobe(-90.0, 0.0, 1.0);
  assert.ok(Math.abs(sp.x) < 1e-6 && Math.abs(sp.y - (-1.0)) < 1e-6 && Math.abs(sp.z) < 1e-6);

  // Equator at Prime Meridian (0°N, 0°E) -> (0, 0, 1)
  const eqPrime = latLonToGlobe(0.0, 0.0, 1.0);
  assert.ok(Math.abs(eqPrime.x) < 1e-6 && Math.abs(eqPrime.y) < 1e-6 && Math.abs(eqPrime.z - 1.0) < 1e-6);

  // Equator at 90°E (Indian Ocean East) -> (1, 0, 0)
  const eq90E = latLonToGlobe(0.0, 90.0, 1.0);
  assert.ok(Math.abs(eq90E.x - 1.0) < 1e-6 && Math.abs(eq90E.y) < 1e-6 && Math.abs(eq90E.z) < 1e-6);

  // Equator at 90°W (-90° Lon) -> (-1, 0, 0)
  const eq90W = latLonToGlobe(0.0, -90.0, 1.0);
  assert.ok(Math.abs(eq90W.x - (-1.0)) < 1e-6 && Math.abs(eq90W.y) < 1e-6 && Math.abs(eq90W.z) < 1e-6);

  console.log('  ✓ Cardinal poles and equatorial axes on unit sphere verified PASSED');
}

// Test 10: Bijective Spherical Round-Trip Conversion
{
  console.log('[TEST 10] Bijective round-trip LonLat <-> Globe conversion');
  const testCoords = [
    { lat: 18.92, lon: 72.83 }, // Mumbai
    { lat: 13.08, lon: 80.27 }, // Chennai
    { lat: 7.87, lon: 80.77 },  // Sri Lanka
    { lat: 12.83, lon: 69.00 }, // Argo WMO 2902120 (Arabian Sea)
    { lat: 13.69, lon: 88.07 }, // Argo WMO 2902084 (Bay of Bengal)
    { lat: -25.0, lon: 65.0 },  // SW Indian Ridge
    { lat: 0.0, lon: 75.0 },    // Indian Ocean Center
    { lat: 45.0, lon: -120.0 }, // Pacific
    { lat: -45.0, lon: -20.0 }, // South Atlantic
  ];

  testCoords.forEach((pt) => {
    const pos = latLonToGlobe(pt.lat, pt.lon, 1.0);
    const inv = globeToLatLon(pos.x, pos.y, pos.z);
    assert.ok(Math.abs(inv.lat - pt.lat) < 1e-4, `Lat error: expected ${pt.lat}, got ${inv.lat}`);
    assert.ok(Math.abs(inv.lon - pt.lon) < 1e-4, `Lon error: expected ${pt.lon}, got ${inv.lon}`);
  });
  console.log(`  ✓ All ${testCoords.length} spherical test coordinates inverted with zero error (< 1e-4 deg) PASSED`);
}

// Test 11: Great-Circle Spherical Interpolation
{
  console.log('[TEST 11] Great-Circle Spherical Interpolation (SLERP)');
  const pts = interpolateGreatCircle(0.0, 30.0, 0.0, 120.0, 5.0);
  assert.ok(pts.length >= 18, `Expected >= 18 steps for 90 deg arc, got ${pts.length}`);
  assert.strictEqual(pts[0].lat, 0.0);
  assert.strictEqual(pts[0].lon, 30.0);
  assert.strictEqual(pts[pts.length - 1].lat, 0.0);
  assert.strictEqual(pts[pts.length - 1].lon, 120.0);

  // Every interpolated point should have radius 1 on sphere
  pts.forEach((pt) => {
    const g = latLonToGlobe(pt.lat, pt.lon, 1.0);
    const r = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    assert.ok(Math.abs(r - 1.0) < 1e-5, `Point radius deviation: ${r}`);
  });
  console.log('  ✓ Great-circle waypoints generated strictly on spherical manifold PASSED');
}

// Test 12: INCOIS Model Domain Validation vs Global Domain
{
  console.log('[TEST 12] INCOIS Model Domain Validation vs Global Domain');
  // Inside model domain (30E—120E, 30S—30N)
  assert.strictEqual(isInsideModelDomain(12.83, 69.0), true);
  assert.strictEqual(isInsideModelDomain(13.69, 88.07), true);
  assert.strictEqual(isInsideModelDomain(0.0, 75.0), true);
  assert.strictEqual(isInsideModelDomain(-29.9, 31.0), true);
  assert.strictEqual(isInsideModelDomain(29.9, 119.0), true);

  // Outside model domain (e.g. Atlantic, Pacific, Arctic, Antarctic)
  assert.strictEqual(isInsideModelDomain(45.0, 0.0), false);   // Europe (Lat too high)
  assert.strictEqual(isInsideModelDomain(-45.0, 75.0), false); // Southern Ocean (Lat too low)
  assert.strictEqual(isInsideModelDomain(10.0, -40.0), false); // Atlantic (Lon too west)
  assert.strictEqual(isInsideModelDomain(10.0, 160.0), false); // Pacific (Lon too east)

  console.log('  ✓ INCOIS model footprint correctly differentiated from global sphere PASSED');
}

console.log('====================================================');
console.log('ALL 12 GEOGRAPHIC & NAVIGATION TEST SUITES PASSED! ✓');
console.log('====================================================');
