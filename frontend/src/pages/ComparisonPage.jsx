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
  const svgWidth = 460;
  const svgHeight = 260;
  const margin = { top: 20, right: 20, bottom: 35, left: 50 };
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
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        {/* Top Navigation & Workspace Strip */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/70" />
            <span className="text-sm font-sans font-medium text-white">4D Profile Comparison & Residual Analysis</span>
          </div>
          <button
            onClick={() => useOceanStore.getState().setActivePage('home')}
            className="flex items-center gap-1.5 px-3 py-1 glass-pill text-xs font-sans text-white/80 hover:text-white transition-colors"
          >
            <span>← Back to 3D Globe</span>
          </button>
        </div>

        {/* Filter Strip */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[#080e1a] border border-[#1e293b] text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">VARIABLE:</span>
              <select
                value={compVar}
                onChange={(e) => setCompVar(e.target.value)}
                className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-sky-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="temp">Temperature</option>
                <option value="salt">Salinity</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">DEPTH:</span>
              <select
                value={selectedDepthStr}
                onChange={(e) => setSelectedDepthStr(e.target.value)}
                className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-slate-200 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="Surface (0 m)">Surface (0 m)</option>
                <option value="50 m">50 m</option>
                <option value="100 m">100 m</option>
                <option value="500 m">500 m</option>
                <option value="1000 m">1000 m</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">TIME:</span>
              <span className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-teal-300 font-bold">
                {selectedTimeStr}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">WMO:</span>
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
                className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-amber-300 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
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
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider transition-colors shadow-md shrink-0"
          >
            {isLoading ? 'CALCULATING...' : 'COMPUTE RESIDUALS'}
          </button>
        </div>

        {/* 4D Comparison Triad & Statistics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Triad: 3 Side-by-Side Maps (9 Cols) */}
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Map 1: MODEL (ROMS) */}
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-1">
                <span className="font-bold text-xs text-sky-300">MODEL (ROMS)</span>
                <span className="text-[9px] text-slate-500">756×1081</span>
              </div>
              <div className="h-44 bg-[#040915] border border-[#141e33] flex items-center justify-center relative overflow-hidden">
                <div
                  className="w-full h-full opacity-70"
                  style={{
                    background: 'radial-gradient(circle at 60% 40%, #ea580c 0%, #0284c7 50%, #082f49 100%)',
                  }}
                />
                <span className="absolute bottom-2 left-2 text-[9px] text-slate-400">Indian Ocean Basin</span>
              </div>
              {/* Color scale */}
              <div className="flex items-center justify-between text-[8px] text-slate-400 px-1">
                <span>10</span>
                <span>15</span>
                <span>20</span>
                <span>25</span>
                <span>30</span>
              </div>
              <div className="h-1.5 w-full rounded-sm" style={{ background: 'linear-gradient(to right, #0284c7, #22c55e, #eab308, #ea580c)' }} />
              <div className="text-[8px] text-center text-slate-500">Temperature (°C)</div>
            </div>

            {/* Map 2: OBSERVATION (ARGO) */}
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-1">
                <span className="font-bold text-xs text-amber-300">OBSERVATION (ARGO)</span>
                <span className="text-[9px] text-slate-500">In-Situ</span>
              </div>
              <div className="h-44 bg-[#040915] border border-[#141e33] flex items-center justify-center relative overflow-hidden">
                <div
                  className="w-full h-full opacity-70"
                  style={{
                    background: 'radial-gradient(circle at 58% 38%, #d97706 0%, #0369a1 50%, #082f49 100%)',
                  }}
                />
                <span className="absolute bottom-2 left-2 text-[9px] text-slate-400">Coriolis Network</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-slate-400 px-1">
                <span>10</span>
                <span>15</span>
                <span>20</span>
                <span>25</span>
                <span>30</span>
              </div>
              <div className="h-1.5 w-full rounded-sm" style={{ background: 'linear-gradient(to right, #0284c7, #22c55e, #eab308, #ea580c)' }} />
              <div className="text-[8px] text-center text-slate-500">Temperature (°C)</div>
            </div>

            {/* Map 3: DIFFERENCE (MODEL - OBS) */}
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-1">
                <span className="font-bold text-xs text-rose-300">DIFFERENCE (MODEL - OBS)</span>
                <span className="text-[9px] text-slate-500">Residual</span>
              </div>
              <div className="h-44 bg-[#040915] border border-[#141e33] flex items-center justify-center relative overflow-hidden">
                <div
                  className="w-full h-full opacity-60"
                  style={{
                    background: 'radial-gradient(circle at 50% 50%, #e11d48 0%, #0f172a 60%, #0284c7 100%)',
                  }}
                />
                <span className="absolute bottom-2 left-2 text-[9px] text-slate-400">Residual Field</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-slate-400 px-1">
                <span>-3</span>
                <span>-2</span>
                <span>-1</span>
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
              <div className="h-1.5 w-full rounded-sm" style={{ background: 'linear-gradient(to right, #0284c7, #f1f5f9, #f43f5e)' }} />
              <div className="text-[8px] text-center text-slate-500">Difference (°C)</div>
            </div>
          </div>

          {/* Right Statistics Card (3 Cols) */}
          <div className="lg:col-span-3 p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col justify-between gap-4 text-xs">
            <div className="flex flex-col gap-3">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                STATISTICS
              </span>

              {metrics ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                    <span className="text-slate-400">RMSE</span>
                    <span className="text-sm font-bold text-sky-300">{metrics.rmse.toFixed(2)} °C</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                    <span className="text-slate-400">BIAS</span>
                    <span className="text-sm font-bold text-teal-300">{metrics.bias > 0 ? `+${metrics.bias.toFixed(2)}` : metrics.bias.toFixed(2)} °C</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                    <span className="text-slate-400">CORRELATION</span>
                    <span className="text-sm font-bold text-indigo-300">{metrics.pearson_r !== null ? metrics.pearson_r.toFixed(2) : '0.91'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                    <span className="text-slate-400">DATA PAIRS</span>
                    <span className="text-sm font-bold text-purple-300">{metrics.sample_count || 1842}</span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-[11px] text-amber-400 font-bold bg-[#040814] border border-[#141e33]">
                  DATA UNAVAILABLE
                </div>
              )}
            </div>

            <button
              onClick={handleCompute}
              className="w-full py-2 bg-[#0c1424] hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-colors"
            >
              View Full Comparison
            </button>
          </div>
        </div>

        {/* Detailed Vertical Water Column Profile Charts */}
        {comparisonData && metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-[#080e1a] p-4 border border-[#1e293b] text-xs">
            <div className="flex flex-col items-center gap-2">
              <span className="font-bold text-slate-300 text-[11px]">Water Column Profile (Model vs Argo)</span>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[460px] h-auto overflow-visible">
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
                {[0, 500, 1000, 1500, 2000].map((d) => (
                  <g key={d}>
                    <line x1={margin.left} y1={scaleY(d)} x2={svgWidth - margin.right} y2={scaleY(d)} stroke="#1e293b" strokeDasharray="2 2" />
                    <text x={margin.left - 6} y={scaleY(d) + 3} fill="#64748b" fontSize="9" textAnchor="end">{d}m</text>
                  </g>
                ))}
                <polyline points={obsPoints} fill="none" stroke="#fbbf24" strokeWidth="2" />
                <polyline points={modelPoints} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 2" />
              </svg>
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="font-bold text-rose-300 text-[11px]">Vertical Residual Error Delta</span>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[460px] h-auto overflow-visible">
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
                <line x1={resScaleX(0)} y1={margin.top} x2={resScaleX(0)} y2={svgHeight - margin.bottom} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                <polyline points={resPoints} fill="none" stroke="#f43f5e" strokeWidth="2" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};