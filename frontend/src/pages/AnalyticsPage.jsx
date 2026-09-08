import React, { useState, useMemo } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Activity,
  Compass,
  TrendingUp,
  Database,
  Layers,
  ArrowRight,
  Info
} from '../components/Icons';

export const AnalyticsPage = () => {
  const {
    metadata,
    activeDataset,
    variable,
    setVariable,
    timeIndex,
    setTimeIndex,
    setActivePage,
  } = useOceanStore();

  const [activeTab, setActiveTab] = useState('timeseries'); // 'timeseries' | 'vertical' | 'hovmoller' | 'spectral'
  const [selectedVar, setSelectedVar] = useState('temp');
  const [selectedRange, setSelectedRange] = useState('ALL'); // '1Y' | '5Y' | '10Y' | 'ALL'
  const [latVal, setLatVal] = useState(0.0);
  const [lonVal, setLonVal] = useState(75.0);
  const [depthVal, setDepthVal] = useState('0 m (Surface)');

  const variables = [
    { id: 'temp', label: 'Potential Temperature', unit: '°C', baseline: 28.32, min: 26.12, max: 30.45, std: 0.84, amp: 1.85, trend: 0.018 },
    { id: 'salt', label: 'Practical Salinity', unit: 'PSU', baseline: 35.42, min: 34.60, max: 36.10, std: 0.28, amp: 0.62, trend: -0.003 },
    { id: 'chl', label: 'Chlorophyll-a', unit: 'mg/m³', baseline: 0.35, min: 0.08, max: 1.45, std: 0.22, amp: 0.45, trend: 0.001 },
    { id: 'no3', label: 'Nitrate (NO3)', unit: 'µmol/L', baseline: 4.80, min: 0.50, max: 18.20, std: 2.90, amp: 3.20, trend: 0.012 },
    { id: 'pco2', label: 'Surface pCO2', unit: 'µatm', baseline: 388.5, min: 350.0, max: 440.0, std: 14.5, amp: 26.0, trend: 1.65 },
  ];

  const currentVarObj = variables.find(v => v.id === selectedVar) || variables[0];

  // Range-filtered points (ALL = 480 points; 10Y = 120 points; 5Y = 60 points; 1Y = 12 points)
  const pointCount = selectedRange === '1Y' ? 12 : selectedRange === '5Y' ? 60 : selectedRange === '10Y' ? 120 : 480;
  const startIndex = Math.max(0, 480 - pointCount);

  // Generate 480 monthly timesteps (Jan 1980 to Dec 2019)
  const fullTimeSeriesData = useMemo(() => {
    const data = [];
    const startYear = 1980;
    for (let i = 0; i < 480; i++) {
      const year = startYear + Math.floor(i / 12);
      const month = (i % 12) + 1;
      const monthAngle = (month / 12) * 2 * Math.PI;
      const seasonal = Math.sin(monthAngle - 0.5) * currentVarObj.amp;
      const decadalTrend = (i / 12) * currentVarObj.trend;
      const iodOscillation = Math.sin((i / 36) * 2 * Math.PI) * (currentVarObj.amp * 0.35);
      const value = currentVarObj.baseline + seasonal + decadalTrend + iodOscillation;

      data.push({
        index: i,
        year,
        month,
        dateStr: `${year}-${String(month).padStart(2, '0')}`,
        value,
      });
    }
    return data;
  }, [currentVarObj]);

  const timeSeriesData = fullTimeSeriesData.slice(startIndex);

  // SVG Chart Geometry
  const svgWidth = 740;
  const svgHeight = 260;
  const margin = { top: 24, right: 25, bottom: 35, left: 55 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const vals = timeSeriesData.map(d => d.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const valRange = maxVal - minVal > 0.01 ? maxVal - minVal : 1.0;

  const scaleX = (idx) => margin.left + ((idx - startIndex) / (pointCount - 1 || 1)) * plotWidth;
  const scaleY = (v) => margin.top + plotHeight - ((v - minVal) / valRange) * plotHeight;

  const linePoints = timeSeriesData.map(d => `${scaleX(d.index)},${scaleY(d.value)}`).join(' ');

  return (
    <div className="flex-1 overflow-y-auto bg-[#030712] text-slate-100 font-sans p-4 sm:p-6 select-none custom-scrollbar">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        {/* Top Header & Navigation Strip */}
        <div className="flex items-center justify-between pb-3 border-b border-sky-500/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.25)]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wider text-white font-mono uppercase">
                  Multi-Decadal Ocean Analytics & Trend Studio
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-400/30 text-emerald-300">
                  1980 — 2019 REANALYSIS
                </span>
              </div>
              <p className="text-[11px] text-sky-200/50 font-mono mt-0.5">
                Harmonic seasonal oscillation, decadal climate trends & spectral decomposition
              </p>
            </div>
          </div>
          <button
            onClick={() => setActivePage('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-cyan-300 text-xs font-semibold font-mono tracking-wider transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>RETURN TO 3D GLOBE</span>
          </button>
        </div>

        {/* Sub-Header Tabs & Temporal Range Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-500/15 pb-3 text-xs">
          <div className="flex items-center gap-2">
            {['timeseries', 'vertical', 'hovmoller', 'spectral'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider transition-all ${
                  activeTab === t
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                    : 'bg-slate-950/70 border border-sky-500/20 text-slate-400 hover:text-white hover:border-sky-500/40'
                }`}
              >
                {t === 'timeseries' ? 'Time Series' : t === 'vertical' ? 'Vertical Profile' : t === 'hovmoller' ? 'Hovmöller' : 'Spectral Analysis'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-950/80 border border-sky-500/20 rounded-lg p-1 shadow-inner">
            {['1Y', '5Y', '10Y', 'ALL'].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRange(r)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                  selectedRange === r
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Strip */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl text-xs backdrop-blur-2xl shadow-xl">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">SAMPLE POINT:</span>
              <span className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-cyan-300 font-bold font-mono">
                {latVal >= 0 ? `${latVal.toFixed(2)}°N` : `${Math.abs(latVal).toFixed(2)}°S`}, {lonVal.toFixed(2)}°E
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">VARIABLE:</span>
              <select
                value={selectedVar}
                onChange={(e) => {
                  setSelectedVar(e.target.value);
                  setVariable(e.target.value);
                }}
                className="px-2.5 py-1 bg-slate-950 border border-emerald-500/40 rounded-lg text-emerald-300 font-bold font-mono focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                {variables.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">DEPTH LEVEL:</span>
              <select
                value={depthVal}
                onChange={(e) => setDepthVal(e.target.value)}
                className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-slate-200 font-bold font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="0 m (Surface)">0 m (Surface)</option>
                <option value="50 m">50 m</option>
                <option value="100 m">100 m</option>
                <option value="250 m">250 m</option>
                <option value="500 m">500 m</option>
                <option value="1000 m">1000 m</option>
              </select>
            </div>
          </div>

          <span className="text-[10px] text-sky-300/70 font-mono">
            {timeSeriesData.length} Timesteps ({timeSeriesData[0]?.dateStr} — {timeSeriesData[timeSeriesData.length - 1]?.dateStr})
          </span>
        </div>

        {/* Main 2-Column Analytics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Chart Area (8 Cols) */}
          <div className="lg:col-span-8 p-4 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col gap-3 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-transparent" />
            <div className="flex items-center justify-between border-b border-sky-500/15 pb-2">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>{currentVarObj.label} Time Series</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Click trace to scrub 4D timeline
              </span>
            </div>

            <div className="w-full overflow-x-auto bg-slate-950/80 p-3 rounded-xl border border-sky-500/15 shadow-inner">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto cursor-crosshair overflow-visible"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const normX = Math.max(0, Math.min(1, (clickX - margin.left) / plotWidth));
                  const targetIdx = startIndex + Math.round(normX * (pointCount - 1));
                  setTimeIndex(Math.min(479, Math.max(0, targetIdx)));
                }}
              >
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" />

                {/* Y gridlines */}
                {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
                  <g key={i}>
                    <line x1={margin.left - 4} y1={scaleY(v)} x2={svgWidth - margin.right} y2={scaleY(v)} stroke="rgba(30, 58, 138, 0.3)" strokeDasharray="2 2" />
                    <text x={margin.left - 8} y={scaleY(v) + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono, monospace">
                      {v.toFixed(1)} {currentVarObj.unit}
                    </text>
                  </g>
                ))}

                {/* Trend line with glow */}
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  filter="drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))"
                />

                {/* Timeline seeker marker */}
                {timeIndex >= startIndex && (
                  <g>
                    <line
                      x1={scaleX(timeIndex)}
                      y1={margin.top}
                      x2={scaleX(timeIndex)}
                      y2={svgHeight - margin.bottom}
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={scaleX(timeIndex)}
                      cy={scaleY(fullTimeSeriesData[timeIndex]?.value || currentVarObj.baseline)}
                      r="4.5"
                      fill="#38bdf8"
                      stroke="#040a18"
                      strokeWidth="2"
                      className="animate-pulse"
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Right Statistics & Profile Thumbnail Card (4 Cols) */}
          <div className="lg:col-span-4 p-4 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col justify-between gap-4 text-xs shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400" />
            <div className="flex flex-col gap-3">
              <span className="font-bold text-emerald-200/80 uppercase tracking-widest text-[10px] font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                STATISTICAL METRICS & ANOMALIES
              </span>

              <div className="flex flex-col gap-2.5 text-[11px] font-mono">
                <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                  <span className="text-slate-400">MEAN CLIMATOLOGY</span>
                  <span className="text-sm font-bold text-emerald-300 tabular-nums">{currentVarObj.baseline.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                  <span className="text-slate-400">HISTORICAL MAX</span>
                  <span className="text-sm font-bold text-amber-300 tabular-nums">{currentVarObj.max.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                  <span className="text-slate-400">HISTORICAL MIN</span>
                  <span className="text-sm font-bold text-sky-300 tabular-nums">{currentVarObj.min.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                  <span className="text-slate-400">STANDARD DEVIATION</span>
                  <span className="text-sm font-bold text-purple-300 tabular-nums">±{currentVarObj.std.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                  <span className="text-slate-400">DECADAL TREND</span>
                  <span className="text-sm font-bold text-teal-300 tabular-nums">+{ (currentVarObj.trend * 10).toFixed(2) } {currentVarObj.unit}/dec</span>
                </div>
                <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                  <span className="text-slate-400">SEASONAL AMPLITUDE</span>
                  <span className="text-sm font-bold text-cyan-300 tabular-nums">±{currentVarObj.amp.toFixed(2)} {currentVarObj.unit}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActivePage('explorer')}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs tracking-wider font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(52,211,153,0.3)]"
            >
              EXPLORE 3D SLICES AT POINT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};