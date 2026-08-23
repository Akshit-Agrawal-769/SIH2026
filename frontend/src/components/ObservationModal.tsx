import React from 'react';
import { X, CheckCircle2, TrendingUp } from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ObservationModal: React.FC = () => {
  const { 
    isModalOpen, 
    closeModal, 
    comparisonData, 
    selectedFloat, 
    fetchComparison, 
    variable 
  } = useOceanStore();

  if (!isModalOpen || !comparisonData) return null;

  const { metrics, depths, obs_values, model_interpolated_values, residuals } = comparisonData;

  const varUnit = variable === 'temp' ? '°C' : (variable === 'salt' ? 'PSU' : '');

  const svgWidth = 480;
  const svgHeight = 340;
  const margin = { top: 25, right: 30, bottom: 40, left: 55 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const maxDepth = Math.max(...depths, 100);
  const minVal = Math.min(...obs_values, ...model_interpolated_values);
  const maxVal = Math.max(...obs_values, ...model_interpolated_values);
  const valRange = maxVal - minVal > 0.1 ? maxVal - minVal : 1.0;

  const scaleX = (v: number) => margin.left + ((v - minVal) / valRange) * plotWidth;
  const scaleY = (d: number) => margin.top + (d / maxDepth) * plotHeight;

  const obsPoints = obs_values.map((v, i) => `${scaleX(v)},${scaleY(depths[i])}`).join(' ');
  const modelPoints = model_interpolated_values.map((v, i) => `${scaleX(v)},${scaleY(depths[i])}`).join(' ');

  const maxAbsRes = Math.max(...residuals.map(r => Math.abs(r)), 0.5);
  const resScaleX = (r: number) => margin.left + ((r + maxAbsRes) / (2 * maxAbsRes)) * plotWidth;
  const resPoints = residuals.map((r, i) => `${resScaleX(r)},${scaleY(depths[i])}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full">
                Argo Float WMO {comparisonData.platform_number}
              </span>
              <span className="text-xs text-slate-400">
                Cycle #{comparisonData.cycle_number} | Lat: {comparisonData.latitude.toFixed(2)}°N, Lon: {comparisonData.longitude.toFixed(2)}°E
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mt-1">
              Model Forecast vs. In-Situ Observation Depth Profile & Residuals
            </h2>
          </div>
          <button 
            onClick={closeModal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-800/80 border border-slate-700/70 rounded-xl">
            <div className="text-[11px] text-slate-400 font-medium">Root Mean Square Error</div>
            <div className="text-lg font-bold text-sky-400 font-mono mt-0.5">
              {metrics.rmse.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700/70 rounded-xl">
            <div className="text-[11px] text-slate-400 font-medium">Mean Absolute Error</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
              {metrics.mae.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700/70 rounded-xl">
            <div className="text-[11px] text-slate-400 font-medium">Forecast Bias</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${metrics.bias >= 0 ? 'text-teal-400' : 'text-amber-400'}`}>
              {metrics.bias > 0 ? `+${metrics.bias.toFixed(3)}` : metrics.bias.toFixed(3)} <span className="text-xs font-normal text-slate-400">{varUnit}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700/70 rounded-xl">
            <div className="text-[11px] text-slate-400 font-medium">Pearson Correlation (r)</div>
            <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">
              {metrics.pearson_r.toFixed(4)}
            </div>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700/70 rounded-xl">
            <div className="text-[11px] text-slate-400 font-medium">Valid Sample Levels</div>
            <div className="text-lg font-bold text-purple-400 font-mono mt-0.5">
              {metrics.sample_count} <span className="text-xs font-normal text-slate-400">levels</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-4 border border-slate-800 rounded-2xl">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4 text-xs font-medium mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
                <span className="text-amber-300">In-Situ Argo Observation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400 rounded-full" />
                <span className="text-sky-300">ROMS Model (4D Interpolated)</span>
              </div>
            </div>

            <svg width={svgWidth} height={svgHeight} className="overflow-visible">
              <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />
              <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />

              {[0, 200, 500, 1000, 1500, 2000].filter(d => d <= maxDepth).map((d) => (
                <g key={d}>
                  <line x1={margin.left - 4} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x={margin.left - 8} y={scaleY(d) + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {d}m
                  </text>
                </g>
              ))}

              {[minVal, (minVal + maxVal)/2, maxVal].map((v, i) => (
                <g key={i}>
                  <text x={scaleX(v)} y={svgHeight - margin.bottom + 18} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                    {v.toFixed(1)}{varUnit}
                  </text>
                </g>
              ))}

              <polyline points={obsPoints} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
              <polyline points={modelPoints} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 2" />
            </svg>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-xs font-medium mb-2 text-rose-300">
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              <span>Depth Residual Curve (Δ = Model − Observation)</span>
            </div>

            <svg width={svgWidth} height={svgHeight} className="overflow-visible">
              <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />
              <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1.5" />

              <line x1={resScaleX(0)} y1={margin.top} x2={resScaleX(0)} y2={svgHeight - margin.bottom} stroke="#64748b" strokeWidth="1.5" strokeDasharray="2 2" />

              {[0, 200, 500, 1000, 1500, 2000].filter(d => d <= maxDepth).map((d) => (
                <g key={d}>
                  <line x1={margin.left - 4} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x={margin.left - 8} y={scaleY(d) + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {d}m
                  </text>
                </g>
              ))}

              {[-maxAbsRes, 0, maxAbsRes].map((r, i) => (
                <text key={i} x={resScaleX(r)} y={svgHeight - margin.bottom + 18} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  {r > 0 ? `+${r.toFixed(1)}` : r.toFixed(1)}{varUnit}
                </text>
              ))}

              <polyline points={resPoints} fill="none" stroke="#f43f5e" strokeWidth="2" />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>TEOS-10 Unit Conversion via <code>gsw.z_from_p</code> | Quality Control Flag: QC = 1 (Good Data)</span>
          </div>

          {selectedFloat && selectedFloat.cycles.length > 1 && (
            <div className="flex items-center gap-2">
              <span>Switch Cycle:</span>
              <select
                value={comparisonData.cycle_number}
                onChange={(e) => fetchComparison(selectedFloat.platform_number, Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
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
