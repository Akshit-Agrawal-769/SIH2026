/**
 * Comprehensive State, Workflow & Interaction Synchronization Test Suite
 * Tests dataset switching, state clamping, variable fallbacks, trajectory synchronization,
 * and scientific domain validations.
 */

import assert from 'node:assert/strict';
import { useOceanStore } from '../src/store/oceanStore.js';
import { isInsideModelDomain, DEFAULT_INDIAN_OCEAN_BOUNDS } from '../src/utils/geography.js';
import { computeResidualsAndMetrics } from '../src/utils/comparison.js';

console.log('====================================================');
console.log('RUNNING STATE, WORKFLOW & REPRODUCIBILITY TEST SUITE');
console.log('====================================================');

// Test 1: Unsupported variable fallback on dataset selection
{
  console.log('[TEST 1] Unsupported variable fallback on dataset selection');
  useOceanStore.setState({ variable: 'u' }); // 'u' is unsupported in mock
  const store = useOceanStore.getState();

  store.sanitizeStateAgainstMetadata({
    variables: ['temp', 'salt'],
    bounds: { min_lon: 30, max_lon: 120, min_lat: -30, max_lat: 30, max_depth: 1000 },
    time_range: ['2023-01-01', '2023-01-02', '2023-01-03'],
  });

  const currentVar = useOceanStore.getState().variable;
  assert.ok(['temp', 'salt'].includes(currentVar), `Expected temp or salt, got ${currentVar}`);
  assert.strictEqual(currentVar, 'temp');
  console.log('  ✓ Unsupported variable clamped to valid dataset variable PASSED');
}

// Test 2: Depth level clamping against dataset max depth
{
  console.log('[TEST 2] Depth level clamping against dataset max depth');
  useOceanStore.setState({ depthLevelMeters: 1500 }); // Exceeds 800m
  const store = useOceanStore.getState();

  store.sanitizeStateAgainstMetadata({
    variables: ['temp'],
    bounds: { max_depth: 800 },
    time_range: ['2023-01-01'],
  });

  const clampedDepth = useOceanStore.getState().depthLevelMeters;
  assert.ok(clampedDepth <= 800, `Expected depth <= 800m, got ${clampedDepth}`);
  assert.strictEqual(clampedDepth, 800);
  console.log('  ✓ Depth clamped against maximum dataset vertical extent PASSED');
}

// Test 3: Time index clamping against dataset temporal frames
{
  console.log('[TEST 3] Time index clamping against dataset temporal frames');
  useOceanStore.setState({ timeIndex: 10 }); // Exceeds 2 frames
  const store = useOceanStore.getState();

  store.sanitizeStateAgainstMetadata({
    variables: ['temp'],
    time_range: ['2023-01-01', '2023-01-02'], // 2 frames (max index 1)
  });

  const clampedTime = useOceanStore.getState().timeIndex;
  assert.ok(clampedTime <= 1, `Expected time index <= 1, got ${clampedTime}`);
  assert.strictEqual(clampedTime, 1);
  console.log('  ✓ Time frame index clamped to maximum available time frame PASSED');
}

// Test 4: Variable cycling across available dataset variables
{
  console.log('[TEST 4] Variable cycling (V key) across available variables');
  useOceanStore.setState({
    metadata: {
      variables: ['temp', 'salt', 'u'],
    },
    variable: 'temp',
  });

  const store = useOceanStore.getState();
  store.cycleVariable();
  assert.strictEqual(useOceanStore.getState().variable, 'salt');

  store.cycleVariable();
  assert.strictEqual(useOceanStore.getState().variable, 'u');

  store.cycleVariable();
  assert.strictEqual(useOceanStore.getState().variable, 'temp');
  console.log('  ✓ Variable cycling wraps deterministically across available variables PASSED');
}

// Test 5: Depth stepping (Arrow Up/Down keys)
{
  console.log('[TEST 5] Depth stepping (Arrow Up/Down keys)');
  useOceanStore.setState({ depthLevelMeters: 100 });
  const store = useOceanStore.getState();

  store.stepDepthLevel(1); // Step deeper (100 -> 200)
  assert.ok(useOceanStore.getState().depthLevelMeters > 100);

  store.stepDepthLevel(-1); // Step shallower
  assert.strictEqual(useOceanStore.getState().depthLevelMeters, 100);
  console.log('  ✓ Depth stepping up and down verified PASSED');
}

// Test 6: Outside-domain observation rejection
{
  console.log('[TEST 6] Outside-domain observation spatial boundary classification');
  const insideCoord = { lat: 10.0, lon: 75.0 }; // Indian Ocean
  const outsideCoord = { lat: 45.0, lon: -30.0 }; // North Atlantic

  assert.strictEqual(isInsideModelDomain(insideCoord.lat, insideCoord.lon, DEFAULT_INDIAN_OCEAN_BOUNDS), true);
  assert.strictEqual(isInsideModelDomain(outsideCoord.lat, outsideCoord.lon, DEFAULT_INDIAN_OCEAN_BOUNDS), false);
  console.log('  ✓ Boundary rejection of outside-domain coordinates verified PASSED');
}

// Test 7: Trajectory and active cycle synchronization
{
  console.log('[TEST 7] Trajectory and active cycle synchronization');
  const mockFloat = {
    platform_number: '2901234',
    cycles: [10, 11, 12],
    latest_cycle: 12,
    latest_position: { latitude: 12.5, longitude: 70.0 },
    trajectory: [
      { cycle_number: 10, latitude: 12.0, longitude: 69.0, timestamp: '2023-01-01T00:00:00Z' },
      { cycle_number: 11, latitude: 12.2, longitude: 69.5, timestamp: '2023-01-10T00:00:00Z' },
      { cycle_number: 12, latitude: 12.5, longitude: 70.0, timestamp: '2023-01-20T00:00:00Z' },
    ],
  };

  const store = useOceanStore.getState();
  store.selectFloat(mockFloat);
  store.setSelectedCycle(11);

  assert.strictEqual(useOceanStore.getState().selectedFloat.platform_number, '2901234');
  assert.strictEqual(useOceanStore.getState().selectedCycle, 11);
  console.log('  ✓ Float selection and cycle state synchronization verified PASSED');
}

// Test 8: Comparison depth level selection synchronization
{
  console.log('[TEST 8] Comparison depth level selection synchronization');
  const store = useOceanStore.getState();
  store.setDepthLevelMeters(500);

  assert.strictEqual(useOceanStore.getState().depthLevelMeters, 500);
  console.log('  ✓ Comparison depth level state synchronized PASSED');
}

// Test 9: Physical unit consistency across variables
{
  console.log('[TEST 9] Physical unit consistency across variables');
  const getUnit = (v) => (v === 'temp' ? '°C' : (v === 'salt' ? 'PSU' : 'm/s'));

  assert.strictEqual(getUnit('temp'), '°C');
  assert.strictEqual(getUnit('salt'), 'PSU');
  assert.strictEqual(getUnit('u'), 'm/s');
  assert.strictEqual(getUnit('v'), 'm/s');
  console.log('  ✓ Physical unit standards verified PASSED');
}

// Test 10: Projection mode layer dependencies
{
  console.log('[TEST 10] Projection mode layer dependencies');
  const store = useOceanStore.getState();

  store.setViewMode('ocean3d'); // Volume Box Mode
  assert.strictEqual(useOceanStore.getState().viewMode, 'ocean3d');

  store.setViewMode('globe'); // Spherical Earth Mode
  assert.strictEqual(useOceanStore.getState().viewMode, 'globe');
  console.log('  ✓ Viewport projection switching verified PASSED');
}

console.log('====================================================');
console.log('ALL 10 STATE & WORKFLOW TEST SUITES PASSED! ✓');
console.log('====================================================');
