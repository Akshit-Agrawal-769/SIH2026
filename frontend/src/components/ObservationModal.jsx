import React from 'react';
import {
  X,
  CheckCircle2,
  TrendingUp,
  Activity,
  Thermometer,
  Droplet
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ObservationModal = () => {
  const {
    isModalOpen,
    closeModal,
    comparisonData,
    selectedFloat,
    fetchComparison,
    variable,
    setVariable
  } = useOceanStore();

  if (!isModalOpen || !comparisonData) return null;

  const { metrics, depths, obs_values, model_interpolated_values, residuals } = comparisonData;

  const compVar = comparisonData.variable || variable;
  const varUnit = compVar === 'temp' ? '°C' : (compVar === 'salt' ? 'PSU' : '');
  const varName = compVar === 'temp' ? 'Potential Temperature' : 'Practical Salinity';

  // SVG Chart Geometry
  const svgWidth = 460;
  const svgHeight = 320;
  const margin = { top: 25, right: 25, bottom: 40, left: 55 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  // Filter valid data points
  const validIndices = depths.map((d, i) => i).filter(i =>
    obs_values[i] !== null && obs_values[i] !== undefined &&
    model_interpolated_values[i] !== null && model_interpolated_values[i] !== undefined
  );

  const cleanDepths = validIndices.map(i => depths[i]);
  const cleanObs = validIndices.map(i => obs_values[i]);
  const cleanModel = validIndices.map(i => model_interpolated_values[i]);
  const cleanRes = validIndices.map(i => residuals[i]);

  const maxDepth = cleanDepths.length > 0 ? Math.max(...cleanDepths, 100) : 2000;
  const minVal = Math.min(...cleanObs, ...cleanModel, 0);
  const maxVal = Math.max(...cleanObs, ...cleanModel, 1);
  const valRange = maxVal - minVal > 0.1 ? maxVal - minVal : 1.0;

  const scaleX = (v) => margin.left + ((v - minVal) / valRange) * plotWidth;
  const scaleY = (d) => margin.top + (d / maxDepth) * plotHeight;

  const obsPoints = cleanObs.map((v, idx) => `${scaleX(v)},${scaleY(cleanDepths[idx])}`).join(' ');
  const modelPoints = cleanModel.map((v, idx) => `${scaleX(v)},${scaleY(cleanDepths[idx])}`).join(' ');

  const maxAbsRes = cleanRes.length > 0 ? Math.max(...cleanRes.map(r => Math.abs(r)), 0.2) : 1.0;
  const resScaleX = (r) => margin.left + ((r + maxAbsRes) / (2 * maxAbsRes)) * plotWidth;
  const resPoints = cleanRes.map((r, idx) => `${resScaleX(r)},${scaleY(cleanDepths[idx])}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md select-none">
      <div className="relative w-full max-w-5xl bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-5 text-slate-100 flex flex-col gap-4 max-h-[92vh] overflow-y-auto custom-scrollbar">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded">
                Argo Float WMO {comparisonData.platform_number}
              </span>
              <span className="text-xs font-mono text-slate-300">
                Cycle #{comparisonData.cycle_number}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-mono text-slate-400">
                Lat: {comparisonData.latitude.toFixed(2)}°N, Lon: {comparisonData.longitude.toFixed(2)}°E
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-mono text-teal-300">
                {comparisonData.timestamp}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-100 mt-0.5">
              4D Interpolated ROMS Model Forecast vs. In-Situ Argo Observation Profile
            </h2>
          </div>

          <button
            onClick={closeModal}
            title="Close Comparison Modal"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Variable Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Ocean Variable:</span>
          <button
            onClick={() => {
              setVariable('temp');
              fetchComparison(comparisonData.platform_number, comparisonData.cycle_number);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
              compVar === 'temp'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>Temperature (°C)</span>
          </button>
          <button
            onClick={() => {
              setVariable('salt');
              fetchComparison(comparisonData.platform_number, comparisonData.cycle_number);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
              compVar === 'salt'
                ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            <span>Salinity (PSU)</span>
          </button>
        </div>

        {/* Validation Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-400 font-medium uppercase">Root Mean Square Error</div>
            <div className="text-lg font-bold text-sky-400 font-mono mt-0.5 tabular-nums">
              {metrics.rmse.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-400 font-medium uppercase">Mean Absolute Error</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5 tabular-nums">
              {metrics.mae.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-400 font-medium uppercase">Forecast Bias</div>
            <div className={`text-lg font-bold font-mono mt-0.5 tabular-nums ${metrics.bias >= 0 ? 'text-teal-300' : 'text-amber-400'}`}>
              {metrics.bias > 0 ? `+${metrics.bias.toFixed(3)}` : metrics.bias.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-400 font-medium uppercase">Pearson Correlation (r)</div>
            <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5 tabular-nums">
              {metrics.pearson_r !== null && metrics.pearson_r !== undefined ? metrics.pearson_r.toFixed(4) : 'N/A'}
            </div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-400 font-medium uppercase">Valid Sample Levels</div>
            <div className="text-lg font-bold text-purple-300 font-mono mt-0.5 tabular-nums">
              {metrics.sample_count} <span className="text-xs font-normal text-slate-400">levels</span>
            </div>
          </div>
        </div>

        {/* Dual Analytical SVG Plots */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-950/80 p-3.5 border border-slate-800 rounded-xl">

          {/* Plot 1: Depth vs Value Profile */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4 text-xs font-medium mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
                <span className="text-amber-300 font-mono text-[11px]">In-Situ Argo Observation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400 rounded-full" />
                <span className="text-sky-300 font-mono text-[11px]">ROMS Model (4D Interp)</span>
              </div>
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[460px] h-auto overflow-visible">
              {/* Axes lines */}
              <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />
              <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />

              {/* Depth grid lines */}
              {[0, 200, 500, 1000, 1500, 2000].filter(d => d <= maxDepth).map((d) => (
                <g key={d}>
                  <line x1={margin.left - 4} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x={margin.left - 8} y={scaleY(d) + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {d}m
                  </text>
                </g>
              ))}

              {/* Value X-axis labels */}
              {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
                <g key={i}>
                  <text x={scaleX(v)} y={svgHeight - margin.bottom + 18} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    {v.toFixed(1)}{varUnit}
                  </text>
                </g>
              ))}

              {/* Observation & Model Profile Polylines */}
              <polyline points={obsPoints} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
              <polyline points={modelPoints} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 2" />

              {/* Axis Titles */}
              <text x={svgWidth / 2} y={svgHeight - 4} fill="#cbd5e1" fontSize="10" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">
                {varName} ({varUnit})
              </text>
              <text x={14} y={svgHeight / 2} fill="#cbd5e1" fontSize="10" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" transform={`rotate(-90 14 ${svgHeight / 2})`}>
                Depth (m)
              </text>
            </svg>
          </div>

          {/* Plot 2: Depth vs Residual Curve */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-xs font-medium mb-2 text-rose-300">
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-mono text-[11px]">Depth Residual Error (Delta = Model - Obs)</span>
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[460px] h-auto overflow-visible">
              {/* Axes lines */}
              <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />
              <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />

              {/* Zero Reference Line */}
              <line x1={resScaleX(0)} y1={margin.top} x2={resScaleX(0)} y2={svgHeight - margin.bottom} stroke="#64748b" strokeWidth="1.5" strokeDasharray="2 2" />

              {/* Depth grid lines */}
              {[0, 200, 500, 1000, 1500, 2000].filter(d => d <= maxDepth).map((d) => (
                <g key={d}>
                  <line x1={margin.left - 4} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x={margin.left - 8} y={scaleY(d) + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {d}m
                  </text>
                </g>
              ))}

              {/* Residual X-axis labels */}
              {[-maxAbsRes, 0, maxAbsRes].map((r, i) => (
                <text key={i} x={resScaleX(r)} y={svgHeight - margin.bottom + 18} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  {r > 0 ? `+${r.toFixed(1)}` : r.toFixed(1)}{varUnit}
                </text>
              ))}

              {/* Residual Polyline */}
              <polyline points={resPoints} fill="none" stroke="#f43f5e" strokeWidth="2.5" />

              {/* Axis Titles */}
              <text x={svgWidth / 2} y={svgHeight - 4} fill="#cbd5e1" fontSize="10" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">
                Residual Delta ({varUnit})
              </text>
              <text x={14} y={svgHeight / 2} fill="#cbd5e1" fontSize="10" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" transform={`rotate(-90 14 ${svgHeight / 2})`}>
                Depth (m)
              </text>
            </svg>
          </div>

        </div>

        {/* Footer & Cycle Selection */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px]">
              TEOS-10 Unit Conversion via <code>gsw.z_from_p</code> | Quality Control: QC Flags 1 & 2 Accepted
            </span>
          </div>

          {selectedFloat && selectedFloat.cycles?.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-medium text-slate-300">Select Float Cycle:</span>
              <select
                value={comparisonData.cycle_number}
                onChange={(e) => fetchComparison(selectedFloat.platform_number, Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs cursor-pointer"
              >
                {selectedFloat.cycles.map((c) => (
                  <option key={c} value={c}>Cycle #{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
