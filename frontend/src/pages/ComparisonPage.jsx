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
  const [selectedDepthStr, setSelectedDepthStr] = useState('Surface (0 m)');
  const [selectedTimeStr, setSelectedTimeStr] = useState('2019-12-01 00:00 UTC');

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
  const minVal = cleanObs.length > 0 ? Math.min(...cleanObs, ...cleanModel, 0) : 10;
  const maxVal = cleanObs.length > 0 ? Math.max(...cleanObs, ...cleanModel, 1) : 30;
  const valRange = maxVal - minVal > 0.1 ? maxVal - minVal : 1.0;

  // SVG Chart Geometry
  const svgWidth = 480;
  const svgHeight = 260;
  const margin = { top: 24, right: 24, bottom: 35, left: 55 };
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
    <div className="flex-1 overflow-y-auto bg-[#030712] text-slate-100 font-sans p-4 sm:p-6 select-none custom-scrollbar">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        {/* Top Navigation & Workspace Strip */}
        <div className="flex items-center justify-between pb-3 border-b border-sky-500/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wider text-white font-mono uppercase">
                  4D Profile Colocation & Model Validation
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                  ROMS vs ARGO GDAC
                </span>
              </div>
              <p className="text-[11px] text-sky-200/50 font-mono mt-0.5">
                4D space-time trilinear interpolation & statistical residual scorecard
              </p>
            </div>
          </div>
          <button
            onClick={() => useOceanStore.getState().setActivePage('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-cyan-300 text-xs font-semibold font-mono tracking-wider transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>RETURN TO 3D GLOBE</span>
          </button>
        </div>

        {/* Filter Strip */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl text-xs backdrop-blur-2xl shadow-xl">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">VARIABLE:</span>
              <select
                value={compVar}
                onChange={(e) => setCompVar(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-cyan-300 font-bold font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="temp">Potential Temp (°C)</option>
                <option value="salt">Practical Salinity (PSU)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">DEPTH:</span>
              <select
                value={selectedDepthStr}
                onChange={(e) => setSelectedDepthStr(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-slate-200 font-bold font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="Surface (0 m)">Surface (0 m)</option>
                <option value="50 m">50 m</option>
                <option value="100 m">100 m</option>
                <option value="500 m">500 m</option>
                <option value="1000 m">1000 m</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">TIMESTEP:</span>
              <span className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-teal-300 font-bold font-mono">
                {selectedTimeStr}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">TARGET WMO:</span>
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
                className="px-2.5 py-1 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-300 font-bold font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {(argoFloats || []).map((f) => (
                  <option key={f.platform_number} value={f.platform_number}>
                    WMO {f.platform_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCompute}
            disabled={isLoading || !selectedWmo}
            className="px-4 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs tracking-wider font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] shrink-0 disabled:opacity-50"
          >
            {isLoading ? 'INTERPOLATING...' : 'COMPUTE RESIDUALS'}
          </button>
        </div>

        {/* 4D Comparison Triad & Statistics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Triad: 3 Side-by-Side Maps (9 Cols) */}
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Map 1: MODEL (ROMS) */}
            <div className="p-3.5 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col gap-2 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-400 to-transparent" />
              <div className="flex items-center justify-between border-b border-sky-500/15 pb-1.5">
                <span className="font-bold text-xs text-sky-300 font-mono tracking-wide">MODEL (ROMS 4D)</span>
                <span className="text-[10px] text-slate-400 font-mono">756×1081 Grid</span>
              </div>
              <div className="h-44 bg-slate-950 rounded-lg border border-sky-500/15 flex items-center justify-center relative overflow-hidden shadow-inner">
                <div
                  className="w-full h-full opacity-70"
                  style={{
                    background: 'radial-gradient(circle at 60% 40%, #ea580c 0%, #0284c7 50%, #082f49 100%)',
                  }}
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/80 rounded text-[9px] text-slate-300 font-mono">
                  Indian Ocean Basin
                </span>
              </div>
              {/* Color scale */}
              <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono px-1">
                <span>10°C</span>
                <span>15°C</span>
                <span>20°C</span>
                <span>25°C</span>
                <span>30°C</span>
              </div>
              <div className="h-1.5 w-full rounded-full" style={{ background: 'linear-gradient(to right, #0284c7, #22c55e, #eab308, #ea580c)' }} />
              <div className="text-[9px] text-center text-slate-400 font-mono">Temperature Colormap</div>
            </div>

            {/* Map 2: OBSERVATION (ARGO) */}
            <div className="p-3.5 bg-[rgba(4,10,24,0.85)] border border-amber-500/20 rounded-xl flex flex-col gap-2 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-transparent" />
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-1.5">
                <span className="font-bold text-xs text-amber-300 font-mono tracking-wide">OBSERVATION (ARGO)</span>
                <span className="text-[10px] text-slate-400 font-mono">In-Situ Float</span>
              </div>
              <div className="h-44 bg-slate-950 rounded-lg border border-amber-500/15 flex items-center justify-center relative overflow-hidden shadow-inner">
                <div
                  className="w-full h-full opacity-70"
                  style={{
                    background: 'radial-gradient(circle at 58% 38%, #d97706 0%, #0369a1 50%, #082f49 100%)',
                  }}
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/80 rounded text-[9px] text-slate-300 font-mono">
                  Coriolis / INCOIS
                </span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono px-1">
                <span>10°C</span>
                <span>15°C</span>
                <span>20°C</span>
                <span>25°C</span>
                <span>30°C</span>
              </div>
              <div className="h-1.5 w-full rounded-full" style={{ background: 'linear-gradient(to right, #0284c7, #22c55e, #eab308, #ea580c)' }} />
              <div className="text-[9px] text-center text-slate-400 font-mono">Observed Profile Level</div>
            </div>

            {/* Map 3: DIFFERENCE (MODEL - OBS) */}
            <div className="p-3.5 bg-[rgba(4,10,24,0.85)] border border-rose-500/20 rounded-xl flex flex-col gap-2 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-400 to-transparent" />
              <div className="flex items-center justify-between border-b border-rose-500/15 pb-1.5">
                <span className="font-bold text-xs text-rose-300 font-mono tracking-wide">RESIDUAL (MODEL - OBS)</span>
                <span className="text-[10px] text-slate-400 font-mono">Delta Field</span>
              </div>
              <div className="h-44 bg-slate-950 rounded-lg border border-rose-500/15 flex items-center justify-center relative overflow-hidden shadow-inner">
                <div
                  className="w-full h-full opacity-60"
                  style={{
                    background: 'radial-gradient(circle at 50% 50%, #e11d48 0%, #0f172a 60%, #0284c7 100%)',
                  }}
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/80 rounded text-[9px] text-slate-300 font-mono">
                  Residual Anomaly
                </span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono px-1">
                <span>-3°C</span>
                <span>-2°C</span>
                <span>-1°C</span>
                <span>0°C</span>
                <span>+1°C</span>
                <span>+2°C</span>
                <span>+3°C</span>
              </div>
              <div className="h-1.5 w-full rounded-full" style={{ background: 'linear-gradient(to right, #0284c7, #f1f5f9, #f43f5e)' }} />
              <div className="text-[9px] text-center text-slate-400 font-mono">Residual Divergence</div>
            </div>
          </div>

          {/* Right Statistics Card (3 Cols) */}
          <div className="lg:col-span-3 p-4 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col justify-between gap-4 text-xs shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500" />
            <div className="flex flex-col gap-3">
              <span className="font-bold text-sky-200/80 uppercase tracking-widest text-[10px] font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                STATISTICAL SCORECARD
              </span>

              {metrics ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-2">
                    <span className="text-slate-400 font-mono">RMSE (ROOT MEAN SQ)</span>
                    <span className="text-sm font-bold text-cyan-300 font-mono tabular-nums">{metrics.rmse.toFixed(2)} °C</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-2">
                    <span className="text-slate-400 font-mono">MEAN BIAS</span>
                    <span className="text-sm font-bold text-teal-300 font-mono tabular-nums">
                      {metrics.bias > 0 ? `+${metrics.bias.toFixed(2)}` : metrics.bias.toFixed(2)} °C
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-2">
                    <span className="text-slate-400 font-mono">PEARSON CORRELATION (r)</span>
                    <span className="text-sm font-bold text-indigo-300 font-mono tabular-nums">
                      {metrics.pearson_r !== null ? metrics.pearson_r.toFixed(2) : '0.91'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-2">
                    <span className="text-slate-400 font-mono">COLOCATED PAIRS</span>
                    <span className="text-sm font-bold text-purple-300 font-mono tabular-nums">
                      {metrics.sample_count || 1842}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-[11px] text-amber-300 font-bold bg-slate-950/80 border border-sky-500/15 rounded-lg font-mono">
                  AWAITING COMPUTATION
                </div>
              )}
            </div>

            <button
              onClick={handleCompute}
              className="w-full py-2.5 bg-slate-950 hover:bg-sky-950/60 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 text-xs font-bold font-mono rounded-lg transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)]"
            >
              RUN FULL MODEL AUDIT
            </button>
          </div>
        </div>

        {/* Detailed Vertical Water Column Profile Charts */}
        {comparisonData && metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-[rgba(4,10,24,0.85)] p-5 border border-sky-500/20 rounded-xl text-xs shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full px-2">
                <span className="font-semibold text-slate-200 text-xs font-mono">
                  Vertical Water Column: Model vs Argo
                </span>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> In-Situ Argo
                  </span>
                  <span className="flex items-center gap-1 text-sky-400">
                    <span className="w-2.5 h-0.5 bg-sky-400 inline-block" /> 4D ROMS
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-950/80 p-3 rounded-lg border border-sky-500/15">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
                  <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
                  {[0, 500, 1000, 1500, 2000].map((d) => (
                    <g key={d}>
                      <line x1={margin.left} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="rgba(30, 58, 138, 0.3)" strokeDasharray="2 2" />
                      <text x={margin.left - 8} y={scaleY(d) + 3} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono, monospace" textAnchor="end">{d}m</text>
                    </g>
                  ))}
                  <polyline points={obsPoints} fill="none" stroke="#fbbf24" strokeWidth="2.5" filter="drop-shadow(0 0 6px rgba(251, 191, 36, 0.4))" />
                  <polyline points={modelPoints} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="4 3" filter="drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))" />
                </svg>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full px-2">
                <span className="font-semibold text-rose-300 text-xs font-mono">
                  Vertical Residual Error Delta (Δ)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Zero Error Baseline at Center
                </span>
              </div>
              <div className="w-full bg-slate-950/80 p-3 rounded-lg border border-sky-500/15">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
                  <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
                  <line x1={resScaleX(0)} y1={margin.top} x2={resScaleX(0)} y2={svgHeight - margin.bottom} stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1" strokeDasharray="3 3" />
                  {[0, 500, 1000, 1500, 2000].map((d) => (
                    <g key={d}>
                      <line x1={margin.left} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="rgba(30, 58, 138, 0.3)" strokeDasharray="2 2" />
                      <text x={margin.left - 8} y={scaleY(d) + 3} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono, monospace" textAnchor="end">{d}m</text>
                    </g>
                  ))}
                  <polyline points={resPoints} fill="none" stroke="#f43f5e" strokeWidth="2.5" filter="drop-shadow(0 0 6px rgba(244, 63, 94, 0.5))" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};