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
  validateCoordinates,
  haversineDistanceKm,
  calculateNearestGridCell,
  DEFAULT_INDIAN_OCEAN_BOUNDS,
  DEFAULT_GEOMETRY_SCALE,
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

console.log('====================================================');
console.log('ALL 8 GEOGRAPHIC & NAVIGATION TEST SUITES PASSED! ✓');
console.log('====================================================');
