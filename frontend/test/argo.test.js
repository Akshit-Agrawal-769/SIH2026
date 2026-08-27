/**
 * Comprehensive Argo In-Situ & Trajectory Test Suite
 * Tests multi-cycle sorting, deduplication, dateline wrapping, missing data handling, and profile mapping.
 */

import assert from 'node:assert/strict';
import {
  normalizeTrajectory,
  splitTrajectoryAtDateline,
  generateSphericalTrajectoryVertices,
  calculateTravelHeadingDeg,
  findCycleInTrajectory,
} from '../src/utils/argo.js';

console.log('====================================================');
console.log('RUNNING ARGO IN-SITU & TRAJECTORY TEST SUITE');
console.log('====================================================');

// Test 1: Cycles sorted chronologically
{
  console.log('[TEST 1] Cycles sorted chronologically');
  const rawTrajectory = [
    { cycle_number: 3, latitude: 12.0, longitude: 87.0, timestamp: '2023-01-20T00:00:00Z' },
    { cycle_number: 1, latitude: 11.0, longitude: 85.0, timestamp: '2023-01-01T00:00:00Z' },
    { cycle_number: 2, latitude: 11.5, longitude: 86.0, timestamp: '2023-01-10T00:00:00Z' },
  ];

  const sorted = normalizeTrajectory(rawTrajectory);
  assert.strictEqual(sorted.length, 3);
  assert.strictEqual(sorted[0].cycleNumber, 1);
  assert.strictEqual(sorted[1].cycleNumber, 2);
  assert.strictEqual(sorted[2].cycleNumber, 3);
  console.log('  ✓ Chronological sorting verified PASSED');
}

// Test 2: Duplicate cycles handled
{
  console.log('[TEST 2] Duplicate cycles handled & deduplicated');
  const rawTrajectory = [
    { cycle_number: 1, latitude: 11.0, longitude: 85.0, timestamp: '2023-01-01T00:00:00Z' },
    { cycle_number: 1, latitude: 11.05, longitude: 85.05, timestamp: '2023-01-01T06:00:00Z' },
    { cycle_number: 2, latitude: 11.5, longitude: 86.0, timestamp: '2023-01-10T00:00:00Z' },
  ];

  const deduplicated = normalizeTrajectory(rawTrajectory);
  assert.strictEqual(deduplicated.length, 2);
  assert.strictEqual(deduplicated[0].cycleNumber, 1);
  assert.strictEqual(deduplicated[0].latitude, 11.05); // Latest point for cycle 1
  assert.strictEqual(deduplicated[1].cycleNumber, 2);
  console.log('  ✓ Duplicate cycle deduplication verified PASSED');
}

// Test 3: Missing coordinates handled
{
  console.log('[TEST 3] Missing or invalid coordinates filtered out');
  const rawTrajectory = [
    { cycle_number: 1, latitude: 11.0, longitude: 85.0, timestamp: '2023-01-01T00:00:00Z' },
    { cycle_number: 2, latitude: null, longitude: 86.0, timestamp: '2023-01-10T00:00:00Z' },
    { cycle_number: 3, latitude: 12.0, longitude: NaN, timestamp: '2023-01-20T00:00:00Z' },
    { cycle_number: 4, latitude: 195.0, longitude: 88.0, timestamp: '2023-01-30T00:00:00Z' }, // Out of bounds lat
    { cycle_number: 5, latitude: 13.0, longitude: 89.0, timestamp: '2023-02-10T00:00:00Z' },
  ];

  const clean = normalizeTrajectory(rawTrajectory);
  assert.strictEqual(clean.length, 2);
  assert.strictEqual(clean[0].cycleNumber, 1);
  assert.strictEqual(clean[1].cycleNumber, 5);
  console.log('  ✓ Invalid coordinates safely filtered PASSED');
}

// Test 4: Missing CTD profile handled
{
  console.log('[TEST 4] Missing CTD profile / cycle handled gracefully');
  const trajectory = [
    { cycleNumber: 1, latitude: 10.0, longitude: 70.0 },
    { cycleNumber: 2, latitude: 11.0, longitude: 71.0 },
  ];

  // Requesting non-existent cycle 99 falls back to latest valid cycle without error
  const match = findCycleInTrajectory(trajectory, 99);
  assert.ok(match !== null);
  assert.strictEqual(match.cycleNumber, 2);
  console.log('  ✓ Missing cycle fallback verified PASSED');
}

// Test 5: Longitude dateline crossing handled
{
  console.log('[TEST 5] Longitude dateline crossing handled without globe-spanning artifact');
  const crossingPoints = [
    { latitude: 0.0, longitude: 178.0 },
    { latitude: 0.0, longitude: 179.5 },
    { latitude: 0.0, longitude: -179.5 }, // Crossing antimeridian (180° / -180°)
    { latitude: 0.0, longitude: -178.0 },
  ];

  const segments = splitTrajectoryAtDateline(crossingPoints, 180.0);
  assert.strictEqual(segments.length, 2, `Expected 2 segments, got ${segments.length}`);
  assert.strictEqual(segments[0].length, 2);
  assert.strictEqual(segments[1].length, 2);
  assert.strictEqual(segments[0][1].longitude, 179.5);
  assert.strictEqual(segments[1][0].longitude, -179.5);
  console.log('  ✓ Antimeridian segment splitting verified PASSED');
}

// Test 6: Invalid cycle selection clamped
{
  console.log('[TEST 6] Invalid cycle selection clamped');
  const trajectory = [
    { cycleNumber: 10, latitude: 10.0, longitude: 70.0 },
    { cycleNumber: 20, latitude: 11.0, longitude: 71.0 },
    { cycleNumber: 30, latitude: 12.0, longitude: 72.0 },
  ];

  const under = findCycleInTrajectory(trajectory, 0);
  assert.ok(under !== null);
  const over = findCycleInTrajectory(trajectory, 100);
  assert.ok(over !== null);
  assert.strictEqual(over.cycleNumber, 30);
  console.log('  ✓ Clamping of out-of-range cycle numbers verified PASSED');
}

// Test 7: Selected cycle remains synchronized
{
  console.log('[TEST 7] Selected cycle remains synchronized');
  const trajectory = [
    { cycleNumber: 1, latitude: 10.0, longitude: 70.0, timestamp: '2023-01-01T00:00:00Z' },
    { cycleNumber: 2, latitude: 10.5, longitude: 70.5, timestamp: '2023-01-10T00:00:00Z' },
    { cycleNumber: 3, latitude: 11.0, longitude: 71.0, timestamp: '2023-01-20T00:00:00Z' },
  ];

  const cycle2 = findCycleInTrajectory(trajectory, 2);
  assert.strictEqual(cycle2.cycleNumber, 2);
  assert.strictEqual(cycle2.latitude, 10.5);
  assert.strictEqual(cycle2.longitude, 70.5);
  console.log('  ✓ Cycle spatial synchronization verified PASSED');
}

// Test 8: Direction of travel heading computation
{
  console.log('[TEST 8] Travel direction heading computation');
  // Moving due North (lat 0 -> lat 10 along lon 70)
  const headingNorth = calculateTravelHeadingDeg(0.0, 70.0, 10.0, 70.0);
  assert.ok(Math.abs(headingNorth - 0.0) < 1e-4, `Expected 0°, got ${headingNorth}`);

  // Moving due East (lon 70 -> lon 80 along equator)
  const headingEast = calculateTravelHeadingDeg(0.0, 70.0, 0.0, 80.0);
  assert.ok(Math.abs(headingEast - 90.0) < 1e-4, `Expected 90°, got ${headingEast}`);
  console.log('  ✓ Heading direction computation verified PASSED');
}

// Test 9: Spherical Great-Circle trajectory vertices generation
{
  console.log('[TEST 9] Spherical Great-Circle trajectory vertices generation');
  const points = [
    { latitude: 10.0, longitude: 70.0 },
    { latitude: 15.0, longitude: 75.0 },
  ];

  const vertices = generateSphericalTrajectoryVertices(points, 1.006, 2.0);
  assert.ok(vertices.length >= 6, `Expected at least 6 coordinates, got ${vertices.length}`);
  assert.strictEqual(vertices.length % 3, 0); // Flat array of [x, y, z]
  console.log('  ✓ Great-circle polyline vertices generated PASSED');
}

// Test 10: Empty trajectory handled
{
  console.log('[TEST 10] Empty trajectory handled without exceptions');
  assert.deepStrictEqual(normalizeTrajectory([]), []);
  assert.deepStrictEqual(normalizeTrajectory(null), []);
  assert.deepStrictEqual(splitTrajectoryAtDateline([]), []);
  assert.deepStrictEqual(generateSphericalTrajectoryVertices([]), []);
  assert.strictEqual(findCycleInTrajectory([], 1), null);
  console.log('  ✓ Empty trajectory edge-cases verified PASSED');
}

console.log('====================================================');
console.log('ALL 10 ARGO IN-SITU & TRAJECTORY TEST SUITES PASSED! ✓');
console.log('====================================================');
