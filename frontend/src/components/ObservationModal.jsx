import React from 'react';
import { X, TrendingUp, Activity, ShieldCheck } from './Icons';
import { useOceanStore } from '../store/oceanStore';
import { prepareObservationProfileData } from '../utils/observationProfile';

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

  const profileGeom = prepareObservationProfileData(comparisonData);
  if (!profileGeom) return null;

  const {
    cleanDepths,
    cleanObs,
    cleanModel,
    cleanRes,
    maxDepth,
    minVal,
    maxVal,
    scaleX,
    scaleY,
    resScaleX,
    obsPoints,
    modelPoints,
    resPoints,
    margin,
    svgWidth,
    svgHeight,
  } = profileGeom;

  const { metrics } = comparisonData;
  const compVar = comparisonData.variable || variable;
  const varUnit = compVar === 'temp' ? '°C' : (compVar === 'salt' ? 'PSU' : '');
  const varName = compVar === 'temp' ? 'Potential Temperature' : 'Practical Salinity';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="4D Spatio-Temporal Colocation & Statistical Residual Scorecard"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md select-none"
    >
      <div className="relative w-full max-w-5xl bg-[rgba(4,10,24,0.95)] backdrop-blur-2xl border border-sky-500/25 rounded-2xl p-5 text-slate-100 flex flex-col gap-4 max-h-[92vh] overflow-y-auto custom-scrollbar shadow-panel-dark animate-fade-slide">

        {/* ─── Modal Header ─── */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              <span className="font-bold text-sky-300 px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/30">
                ARGO WMO {comparisonData.platform_number}
              </span>
              <span className="text-slate-400">
                CYCLE #{comparisonData.cycle_number}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300 tabular-nums">
                {comparisonData.latitude.toFixed(2)}°N, {comparisonData.longitude.toFixed(2)}°E
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-300">
                {comparisonData.timestamp}
              </span>
            </div>
            <h2 className="text-sm font-bold font-mono text-white mt-1 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>4D Spatio-Temporal Colocation &amp; Statistical Residual Scorecard</span>
            </h2>
          </div>

          <button
            onClick={closeModal}
            title="Close Comparison Modal"
            aria-label="Close Comparison Modal"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Variable Switcher Pills ─── */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400 font-semibold">STATE VARIABLE:</span>
          <button
            onClick={() => {
              setVariable('temp');
              fetchComparison(comparisonData.platform_number, comparisonData.cycle_number);
            }}
            className={`px-3 py-1 rounded-xl border font-semibold transition-all ${
              compVar === 'temp'
                ? 'bg-sky-500/25 border-sky-400/60 text-sky-200 shadow-glow-cyan-sm'
                : 'bg-black/30 border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            POTENTIAL TEMPERATURE (°C)
          </button>
          <button
            onClick={() => {
              setVariable('salt');
              fetchComparison(comparisonData.platform_number, comparisonData.cycle_number);
            }}
            className={`px-3 py-1 rounded-xl border font-semibold transition-all ${
              compVar === 'salt'
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200 shadow-sm'
                : 'bg-black/30 border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            PRACTICAL SALINITY (PSU)
          </button>
        </div>

        {/* ─── Validation Metrics Strip ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono">
          <div className="p-2.5 bg-black/40 border border-sky-500/20 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Root Mean Sq Error</div>
            <div className="text-base font-bold text-sky-300 mt-1 tabular-nums">
              {metrics.rmse.toFixed(3)} <span className="text-[10px] font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-2.5 bg-black/40 border border-emerald-500/20 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Mean Absolute Error</div>
            <div className="text-base font-bold text-emerald-300 mt-1 tabular-nums">
              {metrics.mae.toFixed(3)} <span className="text-[10px] font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-2.5 bg-black/40 border border-amber-500/20 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Forecast Bias</div>
            <div className={`text-base font-bold mt-1 tabular-nums ${metrics.bias >= 0 ? 'text-teal-300' : 'text-amber-400'}`}>
              {metrics.bias > 0 ? `+${metrics.bias.toFixed(3)}` : metrics.bias.toFixed(3)} <span className="text-[10px] font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-2.5 bg-black/40 border border-purple-500/20 rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Pearson Correlation (r)</div>
            <div className="text-base font-bold text-purple-300 mt-1 tabular-nums">
              {metrics.pearson_r !== null && metrics.pearson_r !== undefined ? metrics.pearson_r.toFixed(4) : 'N/A'}
            </div>
          </div>
          <div className="p-2.5 bg-black/40 border border-white/[0.08] rounded-xl">
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Valid Vertical Levels</div>
            <div className="text-base font-bold text-slate-200 mt-1 tabular-nums">
              {metrics.sample_count} <span className="text-[10px] font-normal text-slate-400">levels</span>
            </div>
          </div>
        </div>

        {/* ─── Dual Analytical SVG Plots ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-black/30 p-4 border border-white/[0.08] rounded-2xl">

          {/* Plot 1: Depth vs Value Profile */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4 text-xs font-mono mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-amber-400 rounded-sm" />
                <span className="text-amber-300 text-[10px]">In-Situ Argo Observation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-sky-400 rounded-sm" />
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
              <polyline points={obsPoints} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
              <polyline points={modelPoints} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" />

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
            <div className="flex items-center gap-1.5 text-xs font-mono mb-2 text-rose-300">
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] font-semibold">Depth Residual Error (Model - In-Situ Delta)</span>
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
              <polyline points={resPoints} fill="none" stroke="#f43f5e" strokeWidth="2.5" />

              {/* Axis Titles */}
              <text x={svgWidth / 2} y={svgHeight - 4} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                Residual Error Delta ({varUnit})
              </text>
              <text x={12} y={svgHeight / 2} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 12 ${svgHeight / 2})`}>
                Depth (m)
              </text>
            </svg>
          </div>

        </div>

        {/* ─── Footer & Cycle Selector ─── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs text-slate-400 border-t border-white/[0.08] pt-3">
          <div className="text-[10px] flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>TEOS-10 Standards (gsw.z_from_p) · Strict Quality Control QC Flags 1 &amp; 2 Validated</span>
          </div>

          {selectedFloat && selectedFloat.cycles?.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-slate-400 font-semibold">CYCLE:</span>
              <select
                value={comparisonData.cycle_number}
                onChange={(e) => fetchComparison(selectedFloat.platform_number, Number(e.target.value))}
                className="bg-black/40 border border-sky-500/30 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs cursor-pointer focus:outline-none focus:border-sky-400"
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
