/**
 * INCOIS 3D Ocean Data Visualization Platform
 * Observation Modal Profile Data Preparation & Projection Geometry
 */

export function prepareObservationProfileData(comparisonData, dimensions = { svgWidth: 460, svgHeight: 280 }) {
  if (!comparisonData || !Array.isArray(comparisonData.depths) || comparisonData.depths.length === 0) {
    return null;
  }

  const {
    depths = [],
    obs_values = [],
    model_interpolated_values = [],
    residuals = [],
  } = comparisonData;

  const svgWidth = dimensions?.svgWidth || 460;
  const svgHeight = dimensions?.svgHeight || 280;
  const margin = { top: 20, right: 20, bottom: 35, left: 50 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  // Filter valid data points, safely rejecting null, undefined, or NaN
  const validIndices = depths.map((d, i) => i).filter(i =>
    obs_values[i] !== null && obs_values[i] !== undefined && !Number.isNaN(obs_values[i]) &&
    model_interpolated_values[i] !== null && model_interpolated_values[i] !== undefined && !Number.isNaN(model_interpolated_values[i])
  );

  const cleanDepths = validIndices.map(i => depths[i]);
  const cleanObs = validIndices.map(i => obs_values[i]);
  const cleanModel = validIndices.map(i => model_interpolated_values[i]);
  const cleanRes = validIndices.map(i => (residuals[i] !== undefined && residuals[i] !== null) ? residuals[i] : (obs_values[i] - model_interpolated_values[i]));

  const maxDepth = cleanDepths.length > 0 ? Math.max(...cleanDepths, 100) : 2000;
  const minVal = cleanObs.length > 0 ? Math.min(...cleanObs, ...cleanModel) : 0;
  const maxVal = cleanObs.length > 0 ? Math.max(...cleanObs, ...cleanModel) : 1;
  const valRange = maxVal - minVal > 0.1 ? maxVal - minVal : 1.0;

  const scaleX = (v) => margin.left + ((v - minVal) / valRange) * plotWidth;
  const scaleY = (d) => margin.top + (d / maxDepth) * plotHeight;

  const obsPoints = cleanObs.map((v, idx) => `${scaleX(v).toFixed(1)},${scaleY(cleanDepths[idx]).toFixed(1)}`).join(' ');
  const modelPoints = cleanModel.map((v, idx) => `${scaleX(v).toFixed(1)},${scaleY(cleanDepths[idx]).toFixed(1)}`).join(' ');

  const maxAbsRes = cleanRes.length > 0 ? Math.max(...cleanRes.map(r => Math.abs(r)), 0.2) : 1.0;
  const resScaleX = (r) => margin.left + ((r + maxAbsRes) / (2 * maxAbsRes)) * plotWidth;
  const resPoints = cleanRes.map((r, idx) => `${resScaleX(r).toFixed(1)},${scaleY(cleanDepths[idx]).toFixed(1)}`).join(' ');

  return {
    validCount: validIndices.length,
    totalCount: depths.length,
    cleanDepths,
    cleanObs,
    cleanModel,
    cleanRes,
    maxDepth,
    minVal,
    maxVal,
    valRange,
    scaleX,
    scaleY,
    resScaleX,
    obsPoints,
    modelPoints,
    resPoints,
    margin,
    svgWidth,
    svgHeight,
    plotWidth,
    plotHeight,
  };
}
