/**
 * Scientific 4D Comparison & Statistical Metric Engine
 * Handles interpolation (spatial, vertical, temporal), residual computation (Model - Obs),
 * statistical error metrics (RMSE, MAE, Bias, Pearson r), and explicit missing-data accounting.
 */

import { isInsideModelDomain } from './geography.js';

/**
 * Evaluates depth-resolved residuals and statistical error scorecard metrics.
 * Mathematical definitions:
 * - Residual_i = Model_i - Observation_i
 * - RMSE = sqrt( 1/N * sum((Model_i - Observation_i)^2) )
 * - MAE  = 1/N * sum( |Model_i - Observation_i| )
 * - Bias = 1/N * sum( Model_i - Observation_i )
 * - Pearson r = sum((m_i - m_bar)*(o_i - o_bar)) / sqrt( sum((m_i - m_bar)^2) * sum((o_i - o_bar)^2) )
 *
 * @param {Array<number|null>} obsValues - In-situ observation values
 * @param {Array<number|null>} modelValues - 4D interpolated model values
 * @param {Array<number>} [depths=[]] - Vertical depth levels (meters or dbar)
 * @returns {Object} Full scorecard with metrics, residuals, and data accounting
 */
export function computeResidualsAndMetrics(obsValues = [], modelValues = [], depths = []) {
  const totalPoints = Math.max(obsValues.length, modelValues.length);
  if (totalPoints === 0) {
    return {
      metrics: { rmse: 0, mae: 0, bias: 0, pearson_r: null, sample_count: 0 },
      residuals: [],
      validPairs: [],
      dataAccounting: {
        totalObs: 0,
        validPairsCount: 0,
        nanObsCount: 0,
        nanModelCount: 0,
        excludedCount: 0,
      },
    };
  }

  const validPairs = [];
  const residuals = [];
  let nanObsCount = 0;
  let nanModelCount = 0;

  for (let i = 0; i < totalPoints; i++) {
    const o = obsValues[i];
    const m = modelValues[i];
    const d = depths[i] !== undefined ? depths[i] : i;

    const isObsValid = o !== null && o !== undefined && !isNaN(o);
    const isModValid = m !== null && m !== undefined && !isNaN(m);

    if (!isObsValid) nanObsCount++;
    if (!isModValid) nanModelCount++;

    if (isObsValid && isModValid) {
      const res = Number((m - o).toFixed(4));
      residuals.push(res);
      validPairs.push({
        index: i,
        depth: d,
        obs: Number(o.toFixed(4)),
        model: Number(m.toFixed(4)),
        residual: res,
      });
    } else {
      residuals.push(null);
    }
  }

  const N = validPairs.length;
  if (N === 0) {
    return {
      metrics: { rmse: 0, mae: 0, bias: 0, pearson_r: null, sample_count: 0 },
      residuals,
      validPairs: [],
      dataAccounting: {
        totalObs: totalPoints,
        validPairsCount: 0,
        nanObsCount,
        nanModelCount,
        excludedCount: totalPoints,
      },
    };
  }

  const resVals = validPairs.map((p) => p.residual);
  const obsClean = validPairs.map((p) => p.obs);
  const modClean = validPairs.map((p) => p.model);

  // Bias = 1/N * sum(m_i - o_i)
  const bias = resVals.reduce((acc, v) => acc + v, 0) / N;

  // MAE = 1/N * sum(|m_i - o_i|)
  const mae = resVals.reduce((acc, v) => acc + Math.abs(v), 0) / N;

  // RMSE = sqrt(1/N * sum((m_i - o_i)^2))
  const rmse = Math.sqrt(resVals.reduce((acc, v) => acc + v * v, 0) / N);

  // Pearson correlation coefficient (r)
  let pearsonR = null;
  if (N > 1) {
    const meanObs = obsClean.reduce((acc, v) => acc + v, 0) / N;
    const meanMod = modClean.reduce((acc, v) => acc + v, 0) / N;

    let numerator = 0;
    let sumSqObs = 0;
    let sumSqMod = 0;

    for (let i = 0; i < N; i++) {
      const diffObs = obsClean[i] - meanObs;
      const diffMod = modClean[i] - meanMod;
      numerator += diffObs * diffMod;
      sumSqObs += diffObs * diffObs;
      sumSqMod += diffMod * diffMod;
    }

    const denominator = Math.sqrt(sumSqObs * sumSqMod);
    if (denominator > 1e-9) {
      pearsonR = Number((numerator / denominator).toFixed(4));
    }
  }

  return {
    metrics: {
      bias: Number(bias.toFixed(4)),
      mae: Number(mae.toFixed(4)),
      rmse: Number(rmse.toFixed(4)),
      pearson_r: pearsonR,
      sample_count: N,
    },
    residuals,
    validPairs,
    dataAccounting: {
      totalObs: totalPoints,
      validPairsCount: N,
      nanObsCount,
      nanModelCount,
      excludedCount: totalPoints - N,
    },
  };
}

/**
 * Deterministic 1D Linear Interpolation.
 * Given monotonic points (x0, y0) and (x1, y1), computes y at xQuery.
 * Clamps to endpoints if xQuery is outside [x0, x1].
 *
 * @param {number} xQuery - Target query coordinate
 * @param {Array<number>} xKnown - Sorted array of known X coordinates
 * @param {Array<number>} yKnown - Array of known Y values corresponding to xKnown
 * @returns {number|null} Interpolated value
 */
export function interpolate1DLinear(xQuery, xKnown = [], yKnown = []) {
  if (!xKnown || !yKnown || xKnown.length === 0 || yKnown.length === 0) return null;
  if (xKnown.length !== yKnown.length) return null;
  if (isNaN(xQuery)) return null;

  const n = xKnown.length;
  if (n === 1) return yKnown[0];

  // If outside bounds, clamp to boundary
  if (xQuery <= xKnown[0]) return yKnown[0];
  if (xQuery >= xKnown[n - 1]) return yKnown[n - 1];

  // Binary search or linear scan for segment [x_i, x_{i+1}]
  let i = 0;
  while (i < n - 1 && xKnown[i + 1] < xQuery) {
    i++;
  }

  const x0 = xKnown[i];
  const x1 = xKnown[i + 1];
  const y0 = yKnown[i];
  const y1 = yKnown[i + 1];

  if (x1 === x0) return y0;

  const t = (xQuery - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

/**
 * Deterministic 2D Bilinear Interpolation over regular rectilinear grid.
 *
 * @param {number} x - Query X (e.g. longitude)
 * @param {number} y - Query Y (e.g. latitude)
 * @param {Array<number>} xGrid - 1D array of grid X coordinates (length Nx)
 * @param {Array<number>} yGrid - 1D array of grid Y coordinates (length Ny)
 * @param {Array<Array<number>>|Float32Array} values2D - 2D grid matrix [Ny][Nx]
 * @returns {number|null} Bilinearly interpolated scalar
 */
export function interpolate2DBilinear(x, y, xGrid = [], yGrid = [], values2D = []) {
  if (!xGrid.length || !yGrid.length || !values2D.length) return null;

  const nx = xGrid.length;
  const ny = yGrid.length;

  if (x < xGrid[0] || x > xGrid[nx - 1] || y < yGrid[0] || y > yGrid[ny - 1]) {
    return null; // Outside spatial domain
  }

  // Find bounding X indices
  let ix = 0;
  while (ix < nx - 1 && xGrid[ix + 1] < x) ix++;
  const x0 = xGrid[ix];
  const x1 = xGrid[ix + 1] || x0;

  // Find bounding Y indices
  let iy = 0;
  while (iy < ny - 1 && yGrid[iy + 1] < y) iy++;
  const y0 = yGrid[iy];
  const y1 = yGrid[iy + 1] || y0;

  const q11 = Array.isArray(values2D[iy]) ? values2D[iy][ix] : values2D[iy * nx + ix];
  const q21 = Array.isArray(values2D[iy]) ? values2D[iy][ix + 1] : values2D[iy * nx + (ix + 1)];
  const q12 = Array.isArray(values2D[iy + 1]) ? values2D[iy + 1][ix] : values2D[(iy + 1) * nx + ix];
  const q22 = Array.isArray(values2D[iy + 1]) ? values2D[iy + 1][ix + 1] : values2D[(iy + 1) * nx + (ix + 1)];

  if (q11 === undefined || q21 === undefined || q12 === undefined || q22 === undefined) return null;
  if (isNaN(q11) || isNaN(q21) || isNaN(q12) || isNaN(q22)) return null;

  const tx = x1 !== x0 ? (x - x0) / (x1 - x0) : 0;
  const ty = y1 !== y0 ? (y - y0) / (y1 - y0) : 0;

  // Bilinear formula:
  // f(x, y) = (1-tx)(1-ty)*q11 + tx(1-ty)*q21 + (1-tx)ty*q12 + tx*ty*q22
  const val =
    (1 - tx) * (1 - ty) * q11 +
    tx * (1 - ty) * q21 +
    (1 - tx) * ty * q12 +
    tx * ty * q22;

  return val;
}
