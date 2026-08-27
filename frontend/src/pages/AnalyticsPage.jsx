import React, { useState, useMemo } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Activity,
  Compass,
  TrendingUp,
  Database,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

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
  const svgWidth = 720;
  const svgHeight = 260;
  const margin = { top: 20, right: 25, bottom: 35, left: 50 };
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
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        {/* Sub-Header Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-3 text-xs">
          <div className="flex items-center gap-2">
            {['timeseries', 'vertical', 'hovmoller', 'spectral'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 text-xs font-bold uppercase transition-colors ${
                  activeTab === t
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-[#080e1a] border border-[#1e293b] text-slate-400 hover:text-white'
                }`}
              >
                {t === 'timeseries' ? 'Time Series' : t === 'vertical' ? 'Vertical Profile' : t === 'hovmoller' ? 'Hovmöller' : 'Spectral Analysis'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#080e1a] border border-[#1e293b] p-0.5">
            {['1Y', '5Y', '10Y', 'ALL'].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRange(r)}
                className={`px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                  selectedRange === r ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Strip */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[#080e1a] border border-[#1e293b] text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">LOCATION:</span>
              <span className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-cyan-300 font-bold">
                {latVal >= 0 ? `${latVal.toFixed(2)}°N` : `${Math.abs(latVal).toFixed(2)}°S`}, {lonVal.toFixed(2)}°E
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">VARIABLE:</span>
              <select
                value={selectedVar}
                onChange={(e) => {
                  setSelectedVar(e.target.value);
                  setVariable(e.target.value);
                }}
                className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-emerald-300 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {variables.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">DEPTH:</span>
              <select
                value={depthVal}
                onChange={(e) => setDepthVal(e.target.value)}
                className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-slate-200 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
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

          <span className="text-[10px] text-slate-400 font-mono">
            {timeSeriesData.length} Timesteps ({timeSeriesData[0]?.dateStr} — {timeSeriesData[timeSeriesData.length - 1]?.dateStr})
          </span>
        </div>

        {/* Main 2-Column Analytics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Chart Area (8 Cols) */}
          <div className="lg:col-span-8 p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>{currentVarObj.label} Time Series</span>
              </span>
              <span className="text-[10px] text-slate-400">Click graph to seek timeline</span>
            </div>

            <div className="w-full overflow-x-auto">
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
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />

                {/* Y gridlines */}
                {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
                  <g key={i}>
                    <line x1={margin.left - 4} y1={scaleY(v)} x2={svgWidth - margin.right} y2={scaleY(v)} stroke="#1e293b" strokeDasharray="2 2" />
                    <text x={margin.left - 8} y={scaleY(v) + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                      {v.toFixed(1)}
                    </text>
                  </g>
                ))}

                {/* Trend line */}
                <polyline points={linePoints} fill="none" stroke="#10b981" strokeWidth="2" />

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
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={scaleX(timeIndex)}
                      cy={scaleY(fullTimeSeriesData[timeIndex]?.value || currentVarObj.baseline)}
                      r="4"
                      fill="#38bdf8"
                      stroke="#080e1a"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Right Statistics & Profile Thumbnail Card (4 Cols) */}
          <div className="lg:col-span-4 p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col justify-between gap-4 text-xs">
            <div className="flex flex-col gap-3">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                STATISTICAL METRICS
              </span>

              <div className="flex flex-col gap-2 text-[11px]">
                <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                  <span className="text-slate-400">MEAN</span>
                  <span className="text-sm font-bold text-emerald-300">{currentVarObj.baseline.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                  <span className="text-slate-400">MAX</span>
                  <span className="text-sm font-bold text-amber-300">{currentVarObj.max.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                  <span className="text-slate-400">MIN</span>
                  <span className="text-sm font-bold text-sky-300">{currentVarObj.min.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                  <span className="text-slate-400">STD DEV</span>
                  <span className="text-sm font-bold text-purple-300">±{currentVarObj.std.toFixed(2)} {currentVarObj.unit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                  <span className="text-slate-400">TREND</span>
                  <span className="text-sm font-bold text-teal-300">+{ (currentVarObj.trend * 10).toFixed(2) } {currentVarObj.unit}/dec</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                  <span className="text-slate-400">SEASONAL AMP</span>
                  <span className="text-sm font-bold text-cyan-300">±{currentVarObj.amp.toFixed(2)} {currentVarObj.unit}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActivePage('explorer')}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-md"
            >
              Explore 3D Slices at Point
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};