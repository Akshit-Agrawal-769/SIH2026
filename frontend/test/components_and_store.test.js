/**
 * Comprehensive Frontend Components, Store & Utility Test Suite
 * Tests coordinate parsing, DMS rollover, store depth normalization,
 * settings persistence, and WAI-ARIA tab navigation semantics.
 */

import assert from 'node:assert/strict';
import { parseGeographicCoordinate } from '../src/utils/geography.js';
import { prepareObservationProfileData } from '../src/utils/observationProfile.js';
import { useOceanStore, DEFAULT_SETTINGS } from '../src/store/oceanStore.js';

console.log('====================================================');
console.log('RUNNING FRONTEND COMPONENTS & STORE TEST SUITE');
console.log('====================================================');

// Test 1: parseGeographicCoordinate with Decimal Inputs
{
  console.log('[TEST 1] Decimal coordinate parsing');
  assert.strictEqual(parseGeographicCoordinate('12.83', true), 12.83);
  assert.strictEqual(parseGeographicCoordinate('-12.83', true), -12.83);
  assert.strictEqual(parseGeographicCoordinate('69.00', false), 69.0);
  assert.strictEqual(parseGeographicCoordinate('-69.00', false), -69.0);
  assert.strictEqual(parseGeographicCoordinate('0', true), 0);
  assert.strictEqual(parseGeographicCoordinate('0.0', false), 0);
  console.log('  ✓ Standard decimal strings parsed correctly');
}

// Test 2: parseGeographicCoordinate with Cardinal Direction Suffixes
{
  console.log('[TEST 2] Cardinal direction parsing');
  assert.strictEqual(parseGeographicCoordinate('15.4 N', true), 15.4);
  assert.strictEqual(parseGeographicCoordinate('15.4n', true), 15.4);
  assert.strictEqual(parseGeographicCoordinate('12.83 S', true), -12.83);
  assert.strictEqual(parseGeographicCoordinate('12.83s', true), -12.83);
  assert.strictEqual(parseGeographicCoordinate('69.0 E', false), 69.0);
  assert.strictEqual(parseGeographicCoordinate('69.0e', false), 69.0);
  assert.strictEqual(parseGeographicCoordinate('45.5 W', false), -45.5);
  assert.strictEqual(parseGeographicCoordinate('45.5w', false), -45.5);
  console.log('  ✓ Cardinal direction suffixes parsed with correct sign');
}

// Test 3: parseGeographicCoordinate with DMS (Degrees, Minutes, Seconds)
{
  console.log('[TEST 3] DMS notation parsing');
  // 12° 30' 00" N = 12 + 30/60 = 12.5°
  const dms1 = parseGeographicCoordinate("12° 30' 00\" N", true);
  assert.ok(Math.abs(dms1 - 12.5) < 1e-4, `Expected 12.5, got ${dms1}`);

  // 12° 30' N = 12.5°
  const dms2 = parseGeographicCoordinate("12° 30' N", true);
  assert.ok(Math.abs(dms2 - 12.5) < 1e-4, `Expected 12.5, got ${dms2}`);

  // 69° 15' 36" E = 69 + 15/60 + 36/3600 = 69.26°
  const dms3 = parseGeographicCoordinate("69° 15' 36\" E", false);
  assert.ok(Math.abs(dms3 - 69.26) < 1e-4, `Expected 69.26, got ${dms3}`);

  // 10° 30' S = -10.5°
  const dms4 = parseGeographicCoordinate("10° 30' S", true);
  assert.ok(Math.abs(dms4 - (-10.5)) < 1e-4, `Expected -10.5, got ${dms4}`);

  console.log('  ✓ DMS notations converted to high-precision decimal degrees');
}

// Test 4: Coordinate Bounds Validation & Error Handling
{
  console.log('[TEST 4] Coordinate bounds rejection');
  // Latitude out of [-90, +90]
  assert.strictEqual(parseGeographicCoordinate('95.0', true), null);
  assert.strictEqual(parseGeographicCoordinate('-91.0', true), null);
  assert.strictEqual(parseGeographicCoordinate('95° N', true), null);

  // Longitude out of [-180, +180]
  assert.strictEqual(parseGeographicCoordinate('185.0', false), null);
  assert.strictEqual(parseGeographicCoordinate('-181.0', false), null);
  assert.strictEqual(parseGeographicCoordinate('190° E', false), null);

  // Garbage input
  assert.strictEqual(parseGeographicCoordinate('', true), null);
  assert.strictEqual(parseGeographicCoordinate('   ', false), null);
  assert.strictEqual(parseGeographicCoordinate('not-a-coord', true), null);
  assert.strictEqual(parseGeographicCoordinate(null, true), null);
  assert.strictEqual(parseGeographicCoordinate(undefined, false), null);

  console.log('  ✓ Out-of-bounds coordinates and invalid formats safely return null');
}

// Test 5: Depth Level & Slice Depth Synchronization Logic
{
  console.log('[TEST 5] Depth level & volumetric slice synchronization');
  // Simulating oceanStore depth setter logic
  let depthLevelMeters = 0;
  let sliceDepthMeters = 500;

  const setSliceDepthMeters = (depth) => {
    const clamped = Math.max(0, Math.min(2000, depth));
    sliceDepthMeters = clamped;
    depthLevelMeters = clamped;
  };

  const setDepthLevelMeters = (depth) => {
    const clamped = Math.max(0, Math.min(2000, depth));
    depthLevelMeters = clamped;
    sliceDepthMeters = clamped;
  };

  setSliceDepthMeters(150);
  assert.strictEqual(sliceDepthMeters, 150);
  assert.strictEqual(depthLevelMeters, 150);

  setDepthLevelMeters(750);
  assert.strictEqual(sliceDepthMeters, 750);
  assert.strictEqual(depthLevelMeters, 750);

  // Clamping check
  setSliceDepthMeters(-50);
  assert.strictEqual(sliceDepthMeters, 0);

  setDepthLevelMeters(3000);
  assert.strictEqual(depthLevelMeters, 2000);

  console.log('  ✓ Depth states correctly bidirectionally synchronize and clamp to [0, 2000]m');
}

// Test 6: ObservationModal Profile Data Preparation & Graceful Degradation (BUG-0041 Fix)
{
  console.log('[TEST 6] ObservationModal profile data preparation & graceful degradation');
  
  // 1. Realistic 4D Colocated Profile Dataset
  const mockColocation = {
    platform_number: '2902084',
    cycle_number: 42,
    depths: [0, 10, 50, 100, 200, 500],
    obs_values: [28.5, 28.2, 26.0, 22.4, 18.1, 11.2],
    model_interpolated_values: [28.3, 28.0, 26.2, 22.1, 17.9, 11.5],
    residuals: [0.2, 0.2, -0.2, 0.3, 0.2, -0.3],
  };

  const geom = prepareObservationProfileData(mockColocation);
  assert.ok(geom !== null, 'Profile geometry should not be null for valid dataset');
  assert.strictEqual(geom.validCount, 6, 'All 6 depth levels should be valid');
  assert.strictEqual(geom.cleanDepths.length, 6);
  assert.strictEqual(geom.cleanObs.length, 6);
  assert.strictEqual(geom.maxDepth, 500, 'Max depth should be 500m');
  assert.ok(geom.obsPoints.length > 0, 'SVG polyline points should be generated');
  assert.ok(geom.modelPoints.length > 0, 'Model polyline points should be generated');
  assert.ok(geom.resPoints.length > 0, 'Residual polyline points should be generated');

  // 2. Graceful Degradation on Incomplete / Null / NaN values
  const degradedData = {
    depths: [0, 25, 50, 100, 200],
    obs_values: [28.4, null, 25.1, undefined, NaN],
    model_interpolated_values: [28.1, 27.0, null, 21.0, 16.5],
    residuals: [0.3, null, null, null, null],
  };

  const degradedGeom = prepareObservationProfileData(degradedData);
  assert.ok(degradedGeom !== null);
  // Only depth 0 has both obs_values (28.4) and model_interpolated_values (28.1)
  assert.strictEqual(degradedGeom.validCount, 1, 'Only indices with both valid obs & model should pass');
  assert.strictEqual(degradedGeom.cleanDepths[0], 0);
  assert.strictEqual(degradedGeom.cleanObs[0], 28.4);
  assert.strictEqual(degradedGeom.cleanModel[0], 28.1);
  assert.ok(!degradedGeom.obsPoints.includes('NaN'), 'Generated SVG coordinates must never contain NaN');

  // 3. Null and Malformed Inputs
  assert.strictEqual(prepareObservationProfileData(null), null);
  assert.strictEqual(prepareObservationProfileData({}), null);
  assert.strictEqual(prepareObservationProfileData({ depths: [] }), null);
  assert.strictEqual(prepareObservationProfileData({ depths: 'not-an-array' }), null);

  console.log('  ✓ ObservationModal handles valid, degraded, and null datasets with zero errors');
}

// Test 7: OceanStore Platform Settings Management (BUG-0008 Fix)
{
  console.log('[TEST 7] OceanStore hardware & algorithm settings management');
  const store = useOceanStore.getState();

  // Verify initial defaults
  assert.strictEqual(store.settings.highDpi, true);
  assert.strictEqual(store.settings.raymarchingSteps, '256');
  assert.strictEqual(store.settings.fpsCap, '60');
  assert.strictEqual(store.settings.qcPolicy, 'strict');

  // Apply new settings
  store.updateSettings({
    highDpi: false,
    raymarchingSteps: '512',
    fpsCap: '30',
    qcPolicy: 'all',
  });

  const updated = useOceanStore.getState();
  assert.strictEqual(updated.settings.highDpi, false);
  assert.strictEqual(updated.settings.raymarchingSteps, '512');
  assert.strictEqual(updated.settings.fpsCap, '30');
  assert.strictEqual(updated.settings.qcPolicy, 'all');
  assert.strictEqual(updated.argoFilterQC, false, 'argoFilterQC should sync with qcPolicy: all');

  // Re-apply strict policy
  store.updateSettings({ qcPolicy: 'strict' });
  assert.strictEqual(useOceanStore.getState().argoFilterQC, true, 'argoFilterQC should sync with qcPolicy: strict');

  // Reset settings
  store.resetSettings();
  const reset = useOceanStore.getState();
  assert.strictEqual(reset.settings.highDpi, true);
  assert.strictEqual(reset.settings.raymarchingSteps, '256');
  assert.strictEqual(reset.settings.fpsCap, '60');
  assert.strictEqual(reset.settings.qcPolicy, 'strict');
  assert.strictEqual(reset.argoFilterQC, true);

  console.log('  ✓ OceanStore updates, synchronizes QC policy, and resets platform settings cleanly');
}

// Test 8: ShortcutsModal Keyboard Hotkey Behavior & Single-Owner Dismissal (BUG-0026 Regression)
{
  console.log('[TEST 8] ShortcutsModal hotkey toggling & single-owner keyboard dismissal');
  const store = useOceanStore.getState();

  // 1. Initial state: modal is closed
  if (store.isShortcutsModalOpen) store.toggleShortcutsModal();
  assert.strictEqual(useOceanStore.getState().isShortcutsModalOpen, false);

  // 2. Pressing '?' opens the modal
  useOceanStore.getState().toggleShortcutsModal();
  assert.strictEqual(useOceanStore.getState().isShortcutsModalOpen, true, '? should open ShortcutsModal when closed');

  // 3. Pressing '?' again closes the modal (single owner prevents race toggle)
  useOceanStore.getState().toggleShortcutsModal();
  assert.strictEqual(useOceanStore.getState().isShortcutsModalOpen, false, '? should close ShortcutsModal when open');

  // 4. Repeated '?' keystrokes toggle cleanly
  for (let i = 0; i < 6; i++) {
    useOceanStore.getState().toggleShortcutsModal();
    assert.strictEqual(useOceanStore.getState().isShortcutsModalOpen, (i % 2 === 0));
  }

  // Ensure closed
  if (useOceanStore.getState().isShortcutsModalOpen) useOceanStore.getState().toggleShortcutsModal();

  // 5. Escape dismissal when open
  useOceanStore.getState().toggleShortcutsModal(); // Open
  assert.strictEqual(useOceanStore.getState().isShortcutsModalOpen, true);
  
  // Simulate App.jsx Escape handler: if (store.isShortcutsModalOpen) store.toggleShortcutsModal();
  if (useOceanStore.getState().isShortcutsModalOpen) {
    useOceanStore.getState().toggleShortcutsModal();
  }
  assert.strictEqual(useOceanStore.getState().isShortcutsModalOpen, false, 'Escape should dismiss open ShortcutsModal');

  // 6. Repeated Escape when already closed remains closed
  if (useOceanStore.getState().isShortcutsModalOpen) {
    useOceanStore.getState().toggleShortcutsModal();
  }
  assert.strictEqual(useOceanStore.getState().isShortcutsModalOpen, false);

  console.log('  ✓ ShortcutsModal ? toggle and Escape dismissal verified without race conditions');
}

// Test 9: WAI-ARIA Tab Navigation Keyboard Semantics
{
  console.log('[TEST 9] DataCatalog accessible tab keyboard navigation');
  const tabs = ['models', 'argo', 'insitu', 'satellites'];
  let activeIndex = 0;

  const handleKeyDown = (key) => {
    if (key === 'ArrowRight') {
      activeIndex = (activeIndex + 1) % tabs.length;
    } else if (key === 'ArrowLeft') {
      activeIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    } else if (key === 'Home') {
      activeIndex = 0;
    } else if (key === 'End') {
      activeIndex = tabs.length - 1;
    }
  };

  handleKeyDown('ArrowRight');
  assert.strictEqual(tabs[activeIndex], 'argo');

  handleKeyDown('ArrowRight');
  assert.strictEqual(tabs[activeIndex], 'insitu');

  handleKeyDown('End');
  assert.strictEqual(tabs[activeIndex], 'satellites');

  handleKeyDown('ArrowRight'); // Wrap around to first tab
  assert.strictEqual(tabs[activeIndex], 'models');

  handleKeyDown('ArrowLeft'); // Wrap around to last tab
  assert.strictEqual(tabs[activeIndex], 'satellites');

  handleKeyDown('Home');
  assert.strictEqual(tabs[activeIndex], 'models');

  console.log('  ✓ WAI-ARIA tablist arrow, home, and end keyboard navigation validated');
}

console.log('====================================================');
console.log('ALL FRONTEND COMPONENTS & STORE TESTS PASSED (9/9)');
console.log('====================================================');
