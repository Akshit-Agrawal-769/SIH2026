import React, { useState, useEffect } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Compass,
  Radio,
  Layers,
  Activity,
  CheckCircle2,
  TrendingUp,
  Database,
  ArrowRight,
  AlertTriangle
} from '../components/Icons';

export const ComparisonPage = () => {
  const {
    datasets,
    activeDataset,
    argoFloats,
    selectedFloat,
    selectFloat,
    selectedCycle,
    setSelectedCycle,
    comparisonData,
    fetchComparison,
    isLoading,
    loadingMessage,
    errorState,
    focusCoordinateInExplorer,
  } = useOceanStore();

  const [selectedWmo, setSelectedWmo] = useState('');
  const [cycleInput, setCycleInput] = useState(1);
  const [compVar, setCompVar] = useState('temp');

  // Sync initial selection
  useEffect(() => {
    if (selectedFloat) {
      setSelectedWmo(selectedFloat.platform_number);
      const c = selectedCycle ?? selectedFloat.cycles?.[0] ?? 1;
      setCycleInput(c);
    } else if (argoFloats && argoFloats.length > 0) {
      const f = argoFloats[0];
      setSelectedWmo(f.platform_number);
      setCycleInput(f.cycles?.[0] ?? 1);
    }
  }, [selectedFloat, argoFloats, selectedCycle]);

  const activeFloatObj = (argoFloats || []).find((f) => String(f.platform_number) === String(selectedWmo));

  const handleCompute = () => {
    if (!selectedWmo) return;
    fetchComparison(selectedWmo, cycleInput);
  };

  const varUnit = compVar === 'temp' ? '°C' : 'PSU';
  const varName = compVar === 'temp' ? 'Potential Temperature' : 'Practical Salinity';

  // Metrics & Visualizations
  const metrics = comparisonData?.metrics;
  const depths = comparisonData?.depths || [];
  const obsValues = comparisonData?.obs_values || [];
  const modelValues = comparisonData?.model_interpolated_values || [];
  const residuals = comparisonData?.residuals || [];

  // Filter valid data points
  const validIndices = depths.map((d, i) => i).filter((i) =>
    obsValues[i] !== null && obsValues[i] !== undefined &&
    modelValues[i] !== null && modelValues[i] !== undefined
  );

  const cleanDepths = validIndices.map(i => depths[i]);
  const cleanObs = validIndices.map(i => obsValues[i]);
  const cleanModel = validIndices.map(i => modelValues[i]);
  const cleanRes = validIndices.map(i => residuals[i]);

  const maxDepth = cleanDepths.length > 0 ? Math.max(...cleanDepths, 100) : 2000;
  const minVal = Math.min(...cleanObs, ...cleanModel, 0);
  const maxVal = Math.max(...cleanObs, ...cleanModel, 1);
  const valRange = maxVal - minVal > 0.1 ? maxVal - minVal : 1.0;

  // SVG Chart Geometry
  const svgWidth = 480;
  const svgHeight = 320;
  const margin = { top: 25, right: 25, bottom: 40, left: 55 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const scaleX = (v) => margin.left + ((v - minVal) / valRange) * plotWidth;
  const scaleY = (d) => margin.top + (d / maxDepth) * plotHeight;

  const obsPoints = cleanObs.map((v, idx) => `${scaleX(v)},${scaleY(cleanDepths[idx])}`).join(' ');
  const modelPoints = cleanModel.map((v, idx) => `${scaleX(v)},${scaleY(cleanDepths[idx])}`).join(' ');

  const maxAbsRes = cleanRes.length > 0 ? Math.max(...cleanRes.map(r => Math.abs(r)), 0.2) : 1.0;
  const resScaleX = (r) => margin.left + ((r + maxAbsRes) / (2 * maxAbsRes)) * plotWidth;
  const resPoints = cleanRes.map((r, idx) => `${resScaleX(r)},${scaleY(cleanDepths[idx])}`).join(' ');

  return (
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">
                4D SPATIO-TEMPORAL COLOCATION
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
              Model vs In-Situ Observation Validation
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl">
              Compare 3D ROMS numerical simulation fields against in-situ Coriolis Argo vertical profiles. Compute authoritative validation scorecards including RMSE, MAE, Mean Bias, and Pearson correlation coefficients.
            </p>
          </div>
        </div>

        {/* Configuration Workspace Strip */}
        <div className="p-4 bg-[#080e1a] border border-indigo-500/40 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
            {/* Step 1: Model Dataset */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 uppercase">1. MODEL DATASET</span>
              <div className="px-2.5 py-1.5 bg-[#0c1424] border border-[#1e293b] text-sky-300 font-bold truncate">
                {activeDataset || 'INCOIS-BIO-ROMS.nc'}
              </div>
            </div>

            {/* Step 2: Argo Float Selection */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 uppercase">2. ARGO PROFILER</span>
              <select
                value={selectedWmo}
                onChange={(e) => {
                  setSelectedWmo(e.target.value);
                  const f = (argoFloats || []).find((fl) => String(fl.platform_number) === e.target.value);
                  if (f) {
                    selectFloat(f);
                    setCycleInput(f.cycles?.[0] ?? 1);
                  }
                }}
                className="px-2 py-1.5 bg-[#0c1424] border border-[#1e293b] text-amber-300 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {(argoFloats || []).map((f) => (
                  <option key={f.platform_number} value={f.platform_number}>
                    WMO {f.platform_number} ({f.dac || 'CORIOLIS'})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Cycle Number */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 uppercase">3. CYCLE NUMBER</span>
              {activeFloatObj?.cycles?.length ? (
                <select
                  value={cycleInput}
                  onChange={(e) => setCycleInput(Number(e.target.value))}
                  className="px-2 py-1.5 bg-[#0c1424] border border-[#1e293b] text-slate-200 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {activeFloatObj.cycles.map((c) => (
                    <option key={c} value={c}>
                      Cycle #{c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min="1"
                  value={cycleInput}
                  onChange={(e) => setCycleInput(Number(e.target.value))}
                  className="px-2 py-1 bg-[#0c1424] border border-[#1e293b] text-slate-200 font-bold"
                />
              )}
            </div>

            {/* Step 4: Variable Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 uppercase">4. VARIABLE</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCompVar('temp')}
                  className={`flex-1 py-1.5 px-2 border font-bold text-center transition-colors ${
                    compVar === 'temp'
                      ? 'bg-sky-950 border-sky-500 text-sky-300'
                      : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  TEMP (°C)
                </button>
                <button
                  onClick={() => setCompVar('salt')}
                  className={`flex-1 py-1.5 px-2 border font-bold text-center transition-colors ${
                    compVar === 'salt'
                      ? 'bg-teal-950 border-teal-500 text-teal-300'
                      : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  PSAL (PSU)
                </button>
              </div>
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            onClick={handleCompute}
            disabled={isLoading || !selectedWmo}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-950/50 shrink-0"
          >
            <Activity className="w-4 h-4" />
            <span>{isLoading ? 'CALCULATING 4D RESIDUALS...' : 'COMPUTE 4D COLOCATION'}</span>
          </button>
        </div>

        {/* Results Workspace */}
        {comparisonData && metrics ? (
          <div className="flex flex-col gap-6">
            {/* Meta Readout Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#080e1a] border border-[#1e293b] text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-amber-300">
                  ARGO WMO {comparisonData.platform_number}
                </span>
                <span className="text-slate-400">
                  Cycle #{comparisonData.cycle_number}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300">
                  Position: {comparisonData.latitude.toFixed(2)}°N, {comparisonData.longitude.toFixed(2)}°E
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-teal-300">
                  Timestamp: {comparisonData.timestamp}
                </span>
              </div>

              <button
                onClick={() => {
                  focusCoordinateInExplorer(
                    comparisonData.latitude,
                    comparisonData.longitude,
                    `Argo WMO ${comparisonData.platform_number}`
                  );
                }}
                className="px-3 py-1 bg-[#0c1424] hover:bg-sky-950 border border-sky-500/50 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <Layers className="w-3 h-3" />
                <span>VIEW IN 3D EXPLORER</span>
              </button>
            </div>

            {/* Statistical Scorecards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase">Root Mean Sq Error</span>
                <div className="text-lg font-bold text-sky-300 tabular-nums">
                  {metrics.rmse.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
                </div>
                <span className="text-[9px] text-slate-500">Standard dispersion</span>
              </div>

              <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase">Mean Absolute Error</span>
                <div className="text-lg font-bold text-emerald-300 tabular-nums">
                  {metrics.mae.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
                </div>
                <span className="text-[9px] text-slate-500">L1 average absolute delta</span>
              </div>

              <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase">Mean Forecast Bias</span>
                <div className={`text-lg font-bold tabular-nums ${metrics.bias >= 0 ? 'text-teal-300' : 'text-amber-400'}`}>
                  {metrics.bias > 0 ? `+${metrics.bias.toFixed(3)}` : metrics.bias.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
                </div>
                <span className="text-[9px] text-slate-500">{metrics.bias > 0 ? 'Warm/high model bias' : 'Cool/low model bias'}</span>
              </div>

              <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase">Pearson Correlation (r)</span>
                <div className="text-lg font-bold text-indigo-300 tabular-nums">
                  {metrics.pearson_r !== null && metrics.pearson_r !== undefined ? metrics.pearson_r.toFixed(4) : 'N/A'}
                </div>
                <span className="text-[9px] text-slate-500">Water column profile shape</span>
              </div>

              <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase">Valid Sample Levels</span>
                <div className="text-lg font-bold text-purple-300 tabular-nums">
                  {metrics.sample_count} <span className="text-xs font-normal text-slate-400">levels</span>
                </div>
                <span className="text-[9px] text-slate-500">QC Flag 1 & 2 validated</span>
              </div>
            </div>

            {/* Dual Analytical Plots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-[#080e1a] p-4 border border-[#1e293b]">
              {/* Plot 1: Water Column Profile */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-amber-400" />
                    <span className="text-amber-300 text-[11px] font-bold">In-Situ Argo Profile</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-sky-400 border-b border-dashed border-sky-400" />
                    <span className="text-sky-300 text-[11px] font-bold">ROMS Model (4D Colocated)</span>
                  </div>
                </div>

                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[480px] h-auto overflow-visible">
                  {/* Axes lines */}
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
                  <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />

                  {/* Depth grid lines */}
                  {[0, 200, 500, 1000, 1500, 2000].filter(d => d <= maxDepth).map((d) => (
                    <g key={d}>
                      <line x1={margin.left - 3} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="#1e293b" strokeDasharray="2 2" />
                      <text x={margin.left - 6} y={scaleY(d) + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                        {d}m
                      </text>
                    </g>
                  ))}

                  {/* Value X-axis labels */}
                  {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
                    <g key={i}>
                      <text x={scaleX(v)} y={svgHeight - margin.bottom + 14} fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                        {v.toFixed(1)}{varUnit}
                      </text>
                    </g>
                  ))}

                  {/* Observation & Model Profile Polylines */}
                  <polyline points={obsPoints} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
                  <polyline points={modelPoints} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 2" />

                  {/* Axis Titles */}
                  <text x={svgWidth / 2} y={svgHeight - 6} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                    {varName} ({varUnit})
                  </text>
                  <text x={14} y={svgHeight / 2} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 14 ${svgHeight / 2})`}>
                    Depth (m)
                  </text>
                </svg>
              </div>

              {/* Plot 2: Residual Error Curve */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-rose-300">
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-[11px] font-bold">Vertical Residual Error (Delta = Model - Obs)</span>
                </div>

                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[480px] h-auto overflow-visible">
                  {/* Axes lines */}
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
                  <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />

                  {/* Zero Reference Line */}
                  <line x1={resScaleX(0)} y1={margin.top} x2={resScaleX(0)} y2={svgHeight - margin.bottom} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />

                  {/* Depth grid lines */}
                  {[0, 200, 500, 1000, 1500, 2000].filter(d => d <= maxDepth).map((d) => (
                    <g key={d}>
                      <line x1={margin.left - 3} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="#1e293b" strokeDasharray="2 2" />
                      <text x={margin.left - 6} y={scaleY(d) + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                        {d}m
                      </text>
                    </g>
                  ))}

                  {/* Residual X-axis labels */}
                  {[-maxAbsRes, 0, maxAbsRes].map((r, i) => (
                    <text key={i} x={resScaleX(r)} y={svgHeight - margin.bottom + 14} fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                      {r > 0 ? `+${r.toFixed(1)}` : r.toFixed(1)}{varUnit}
                    </text>
                  ))}

                  {/* Residual Polyline */}
                  <polyline points={resPoints} fill="none" stroke="#f43f5e" strokeWidth="2.5" />

                  {/* Axis Titles */}
                  <text x={svgWidth / 2} y={svgHeight - 6} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                    Residual Delta ({varUnit})
                  </text>
                  <text x={14} y={svgHeight / 2} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 14 ${svgHeight / 2})`}>
                    Depth (m)
                  </text>
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500 bg-[#080e1a] border border-[#1e293b]">
            Click "COMPUTE 4D COLOCATION" above to calculate water column comparison metrics.
          </div>
        )}
      </div>
    </div>
  );
};