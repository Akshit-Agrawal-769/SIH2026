/**
 * Comprehensive 4D Model vs Observation Comparison Test Suite
 * Hand-calculated numerical fixtures testing RMSE, MAE, Bias, Pearson r,
 * 1D/2D interpolation, NaN filtering, and edge cases.
 */

import assert from 'node:assert/strict';
import {
  computeResidualsAndMetrics,
  interpolate1DLinear,
  interpolate2DBilinear,
} from '../src/utils/comparison.js';

console.log('====================================================');
console.log('RUNNING 4D COMPARISON & METRIC VALIDATION TEST SUITE');
console.log('====================================================');

// Test 1: Identical Model & Observation Arrays -> Zero Residual
{
  console.log('[TEST 1] Identical arrays produce zero residuals, RMSE=0, MAE=0, Bias=0, r=1');
  const obs = [28.0, 27.5, 25.0, 20.0, 15.0];
  const mod = [28.0, 27.5, 25.0, 20.0, 15.0];
  const depths = [0, 50, 100, 200, 500];

  const { metrics, residuals } = computeResidualsAndMetrics(obs, mod, depths);
  assert.strictEqual(metrics.rmse, 0);
  assert.strictEqual(metrics.mae, 0);
  assert.strictEqual(metrics.bias, 0);
  assert.strictEqual(metrics.pearson_r, 1);
  assert.strictEqual(metrics.sample_count, 5);
  assert.deepStrictEqual(residuals, [0, 0, 0, 0, 0]);
  console.log('  ✓ Identical arrays zero residual verified PASSED');
}

// Test 2: Constant Offset -> Correct Bias
{
  console.log('[TEST 2] Constant offset of +0.50 produced exact Bias = +0.50');
  const obs = [28.0, 26.0, 22.0, 18.0];
  const mod = [28.5, 26.5, 22.5, 18.5]; // Exactly +0.5 offset

  const { metrics } = computeResidualsAndMetrics(obs, mod);
  assert.strictEqual(metrics.bias, 0.5);
  assert.strictEqual(metrics.mae, 0.5);
  assert.strictEqual(metrics.rmse, 0.5);
  assert.strictEqual(metrics.pearson_r, 1);
  console.log('  ✓ Constant offset bias verified PASSED');
}

// Test 3: Hand-Calculated Fixture -> Exact RMSE & MAE
{
  console.log('[TEST 3] Known hand-calculated fixture yields exact RMSE & MAE');
  // Obs = [10, 20, 30, 40]
  // Mod = [12, 18, 33, 44]
  // Res = [+2, -2, +3, +4]
  // |Res| = [2, 2, 3, 4] -> Sum = 11 -> MAE = 11/4 = 2.75
  // Res^2 = [4, 4, 9, 16] -> Sum = 33 -> MeanSq = 33/4 = 8.25 -> RMSE = sqrt(8.25) = 2.87228...
  // Bias = (2 - 2 + 3 + 4)/4 = 7/4 = 1.75
  const obs = [10.0, 20.0, 30.0, 40.0];
  const mod = [12.0, 18.0, 33.0, 44.0];

  const { metrics } = computeResidualsAndMetrics(obs, mod);
  assert.strictEqual(metrics.bias, 1.75);
  assert.strictEqual(metrics.mae, 2.75);
  assert.ok(Math.abs(metrics.rmse - Math.sqrt(8.25)) < 1e-4);
  console.log('  ✓ Hand-calculated RMSE (2.8723) and MAE (2.75) verified PASSED');
}

// Test 4: Perfect Negative Correlation -> Pearson r = -1
{
  console.log('[TEST 4] Inverse linear relationship yields Pearson r = -1.0');
  const obs = [10, 20, 30, 40];
  const mod = [40, 30, 20, 10];

  const { metrics } = computeResidualsAndMetrics(obs, mod);
  assert.strictEqual(metrics.pearson_r, -1);
  console.log('  ✓ Inverse correlation r = -1 verified PASSED');
}

// Test 5: Insufficient Samples / Zero Variance Graceful Handling
{
  console.log('[TEST 5] Single point and zero-variance produce graceful null for Pearson r');
  // Single point (N=1)
  const single = computeResidualsAndMetrics([28.0], [28.2]);
  assert.strictEqual(single.metrics.sample_count, 1);
  assert.strictEqual(single.metrics.pearson_r, null);

  // Constant arrays (variance = 0)
  const constArr = computeResidualsAndMetrics([20.0, 20.0, 20.0], [21.0, 21.0, 21.0]);
  assert.strictEqual(constArr.metrics.sample_count, 3);
  assert.strictEqual(constArr.metrics.pearson_r, null);
  console.log('  ✓ Zero variance and single sample handling verified PASSED');
}

// Test 6: NaN Observations & Models Excluded & Accounted
{
  console.log('[TEST 6] NaN observations & NaN model values excluded from metric computation');
  const obs = [28.0, NaN, 25.0, null, 20.0];
  const mod = [28.2, 27.0, null, 22.0, 19.8];
  // Valid pairs at index 0 (28.0 vs 28.2) and index 4 (20.0 vs 19.8) -> N=2
  const { metrics, dataAccounting } = computeResidualsAndMetrics(obs, mod);

  assert.strictEqual(metrics.sample_count, 2);
  assert.strictEqual(dataAccounting.totalObs, 5);
  assert.strictEqual(dataAccounting.validPairsCount, 2);
  assert.strictEqual(dataAccounting.excludedCount, 3);
  console.log('  ✓ NaN filtering and accounting verified PASSED');
}

// Test 7: 1D Linear Vertical Interpolation Fixture
{
  console.log('[TEST 7] 1D Linear Vertical Interpolation at intermediate depths');
  const knownDepths = [0, 50, 100, 200];
  const knownTemps = [28.0, 26.0, 20.0, 15.0];

  // At exact known point
  assert.strictEqual(interpolate1DLinear(50, knownDepths, knownTemps), 26.0);

  // At midpoint depth 25m (between 28.0 and 26.0) -> expected 27.0
  const temp25 = interpolate1DLinear(25, knownDepths, knownTemps);
  assert.strictEqual(temp25, 27.0);

  // At depth 150m (halfway between 100m@20° and 200m@15°) -> expected 17.5
  const temp150 = interpolate1DLinear(150, knownDepths, knownTemps);
  assert.strictEqual(temp150, 17.5);

  // Clamp outside upper/lower bounds
  assert.strictEqual(interpolate1DLinear(-10, knownDepths, knownTemps), 28.0);
  assert.strictEqual(interpolate1DLinear(300, knownDepths, knownTemps), 15.0);
  console.log('  ✓ 1D linear vertical interpolation verified PASSED');
}

// Test 8: 1D Temporal Linear Interpolation Fixture
{
  console.log('[TEST 8] 1D Temporal Linear Interpolation between forecast steps');
  const timeStepsMs = [
    new Date('2023-01-01T00:00:00Z').getTime(),
    new Date('2023-01-02T00:00:00Z').getTime(),
  ];
  const timeVals = [28.0, 29.0];

  const targetTimeMs = new Date('2023-01-01T12:00:00Z').getTime(); // Exactly halfway
  const interpTemp = interpolate1DLinear(targetTimeMs, timeStepsMs, timeVals);
  assert.strictEqual(interpTemp, 28.5);
  console.log('  ✓ 1D temporal interpolation verified PASSED');
}

// Test 9: 2D Bilinear Spatial Interpolation Fixture
{
  console.log('[TEST 9] 2D Bilinear Spatial Interpolation on rectilinear grid');
  const lons = [60.0, 70.0];
  const lats = [10.0, 20.0];
  // 2D matrix [lat_idx][lon_idx]
  // (60°E, 10°N)=20.0, (70°E, 10°N)=30.0
  // (60°E, 20°N)=40.0, (70°E, 20°N)=50.0
  const grid2D = [
    [20.0, 30.0],
    [40.0, 50.0],
  ];

  // At center point (65°E, 15°N) -> expected (20 + 30 + 40 + 50) / 4 = 35.0
  const centerVal = interpolate2DBilinear(65.0, 15.0, lons, lats, grid2D);
  assert.strictEqual(centerVal, 35.0);

  // At corner point (60°E, 10°N) -> expected 20.0
  const cornerVal = interpolate2DBilinear(60.0, 10.0, lons, lats, grid2D);
  assert.strictEqual(cornerVal, 20.0);

  // Out of bounds -> expected null
  assert.strictEqual(interpolate2DBilinear(50.0, 15.0, lons, lats, grid2D), null);
  console.log('  ✓ 2D bilinear interpolation verified PASSED');
}

// Test 10: Zero Valid Pairs / Empty Inputs
{
  console.log('[TEST 10] Zero valid pairs and empty arrays handled gracefully');
  const empty = computeResidualsAndMetrics([], []);
  assert.strictEqual(empty.metrics.sample_count, 0);
  assert.strictEqual(empty.metrics.rmse, 0);
  assert.strictEqual(empty.metrics.bias, 0);
  assert.strictEqual(empty.validPairs.length, 0);

  const allNaN = computeResidualsAndMetrics([NaN, NaN], [NaN, NaN]);
  assert.strictEqual(allNaN.metrics.sample_count, 0);
  assert.strictEqual(allNaN.dataAccounting.excludedCount, 2);
  console.log('  ✓ Empty and all-NaN inputs handled gracefully PASSED');
}

console.log('====================================================');
console.log('ALL 10 COMPARISON & METRIC TEST SUITES PASSED! ✓');
console.log('====================================================');
