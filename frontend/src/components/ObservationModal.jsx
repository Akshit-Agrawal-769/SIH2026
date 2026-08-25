import React from 'react';
import {
  X,
  TrendingUp
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
  const svgHeight = 300;
  const margin = { top: 20, right: 20, bottom: 35, left: 50 };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 select-none">
      <div className="relative w-full max-w-5xl bg-[#080e1a] border border-[#1e293b] p-4 text-slate-100 flex flex-col gap-3 max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              <span className="font-bold text-amber-300">
                ARGO WMO {comparisonData.platform_number}
              </span>
              <span className="text-slate-400">
                Cycle #{comparisonData.cycle_number}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">
                Lat: {comparisonData.latitude.toFixed(2)}°N, Lon: {comparisonData.longitude.toFixed(2)}°E
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-teal-300">
                {comparisonData.timestamp}
              </span>
            </div>
            <h2 className="text-sm font-bold font-mono text-slate-200 mt-0.5 uppercase tracking-wide">
              4D Spatio-Temporal Colocation & Statistical Residual Scorecard
            </h2>
          </div>

          <button
            onClick={closeModal}
            title="Close Comparison Modal"
            className="p-1 bg-[#0c1424] border border-[#1e293b] text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Variable Switcher */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">STATE VARIABLE:</span>
          <button
            onClick={() => {
              setVariable('temp');
              fetchComparison(comparisonData.platform_number, comparisonData.cycle_number);
            }}
            className={`px-2.5 py-1 border transition-all ${
              compVar === 'temp'
                ? 'bg-[#10243e] border-sky-500 text-sky-200 font-bold'
                : 'bg-[#0b1322] border-[#1e293b] text-slate-400 hover:text-slate-200'
            }`}
          >
            TEMPERATURE (°C)
          </button>
          <button
            onClick={() => {
              setVariable('salt');
              fetchComparison(comparisonData.platform_number, comparisonData.cycle_number);
            }}
            className={`px-2.5 py-1 border transition-all ${
              compVar === 'salt'
                ? 'bg-[#0f2d2a] border-teal-500 text-teal-200 font-bold'
                : 'bg-[#0b1322] border-[#1e293b] text-slate-400 hover:text-slate-200'
            }`}
          >
            SALINITY (PSU)
          </button>
        </div>

        {/* Validation Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
          <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
            <div className="text-[9px] text-slate-400 uppercase">Root Mean Sq Error</div>
            <div className="text-base font-bold text-sky-300 mt-0.5 tabular-nums">
              {metrics.rmse.toFixed(3)} <span className="text-[10px] font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
            <div className="text-[9px] text-slate-400 uppercase">Mean Absolute Error</div>
            <div className="text-base font-bold text-emerald-300 mt-0.5 tabular-nums">
              {metrics.mae.toFixed(3)} <span className="text-[10px] font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
            <div className="text-[9px] text-slate-400 uppercase">Forecast Bias</div>
            <div className={`text-base font-bold mt-0.5 tabular-nums ${metrics.bias >= 0 ? 'text-teal-300' : 'text-amber-400'}`}>
              {metrics.bias > 0 ? `+${metrics.bias.toFixed(3)}` : metrics.bias.toFixed(3)} <span className="text-[10px] font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
            <div className="text-[9px] text-slate-400 uppercase">Pearson Correlation (r)</div>
            <div className="text-base font-bold text-indigo-300 mt-0.5 tabular-nums">
              {metrics.pearson_r !== null && metrics.pearson_r !== undefined ? metrics.pearson_r.toFixed(4) : 'N/A'}
            </div>
          </div>
          <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
            <div className="text-[9px] text-slate-400 uppercase">Valid Vertical Levels</div>
            <div className="text-base font-bold text-purple-300 mt-0.5 tabular-nums">
              {metrics.sample_count} <span className="text-[10px] font-normal text-slate-400">levels</span>
            </div>
          </div>
        </div>

        {/* Dual Analytical SVG Plots */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-[#070c18] p-3 border border-[#1e293b]">

          {/* Plot 1: Depth vs Value Profile */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4 text-xs font-mono mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400" />
                <span className="text-amber-300 text-[10px]">In-Situ Argo Observation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400 border-b border-dashed border-sky-400" />
                <span className="text-sky-300 text-[10px]">ROMS Model (4D Colocated)</span>
              </div>
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[460px] h-auto overflow-visible">
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
              <polyline points={obsPoints} fill="none" stroke="#fbbf24" strokeWidth="2" />
              <polyline points={modelPoints} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 2" />

              {/* Axis Titles */}
              <text x={svgWidth / 2} y={svgHeight - 4} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                {varName} ({varUnit})
              </text>
              <text x={12} y={svgHeight / 2} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 12 ${svgHeight / 2})`}>
                Depth (m)
              </text>
            </svg>
          </div>

          {/* Plot 2: Depth vs Residual Curve */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-mono mb-1.5 text-rose-300">
              <TrendingUp className="w-3 h-3 text-rose-400" />
              <span className="text-[10px]">Depth Residual Error (Delta = Model - Obs)</span>
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[460px] h-auto overflow-visible">
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
              <polyline points={resPoints} fill="none" stroke="#f43f5e" strokeWidth="2" />

              {/* Axis Titles */}
              <text x={svgWidth / 2} y={svgHeight - 4} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                Residual Delta ({varUnit})
              </text>
              <text x={12} y={svgHeight / 2} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 12 ${svgHeight / 2})`}>
                Depth (m)
              </text>
            </svg>
          </div>

        </div>

        {/* Footer & Cycle Selection */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 font-mono text-xs text-slate-400 border-t border-[#1e293b] pt-2.5">
          <div className="text-[10px]">
            TEOS-10 Conversion via <code>gsw.z_from_p</code> | Quality Control: QC Flags 1 & 2 Validated
          </div>

          {selectedFloat && selectedFloat.cycles?.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400">CYCLE:</span>
              <select
                value={comparisonData.cycle_number}
                onChange={(e) => fetchComparison(selectedFloat.platform_number, Number(e.target.value))}
                className="bg-[#0c1424] border border-[#1e293b] px-2 py-0.5 text-slate-200 font-mono text-xs cursor-pointer focus:outline-none focus:border-sky-500"
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
