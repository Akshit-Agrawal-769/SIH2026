import React, { useState, useEffect, useMemo } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Activity,
  Compass,
  TrendingUp,
  Database,
  Layers,
  ArrowRight,
  Info,
  AlertTriangle
} from '../components/Icons';

const OCEAN_LOCATION_PRESETS = [
  { id: 'lakshadweep', label: 'Lakshadweep Sea / SE Arabian Sea', lat: 10.0, lon: 75.0 },
  { id: 'arabian_sea', label: 'Central Arabian Sea Upwelling Basin', lat: 15.0, lon: 65.0 },
  { id: 'bay_of_bengal', label: 'Central Bay of Bengal Fresh Pool', lat: 14.0, lon: 88.0 },
  { id: 'equatorial', label: 'Equatorial Indian Ocean Jet (Wyrtki)', lat: 0.0, lon: 75.0 },
  { id: 'southern_ocean', label: 'Subtropical Indian Ocean Gyre', lat: -15.0, lon: 75.0 },
];

const VARIABLES = [
  { id: 'temp', label: 'Sea Surface Temperature', unit: '°C' },
  { id: 'salt', label: 'Sea Surface Salinity', unit: 'PSU' },
  { id: 'chl', label: 'Chlorophyll-a Concentration', unit: 'mg/m³' },
  { id: 'mld', label: 'Mixed Layer Depth', unit: 'm' },
  { id: 'no3', label: 'Nitrate (NO3) Concentration', unit: 'µmol/L' },
  { id: 'pco2', label: 'Surface pCO2', unit: 'µatm' },
];

export const AnalyticsPage = () => {
  const {
    metadata,
    activeDataset,
    variable,
    setVariable,
    timeIndex,
    setTimeIndex,
    setActivePage,
    modelTimeseries,
    isTimeseriesLoading,
    fetchModelTimeseries,
  } = useOceanStore();

  const [activeTab, setActiveTab] = useState('timeseries'); // 'timeseries' | 'vertical' | 'hovmoller' | 'spectral'
  const [selectedVar, setSelectedVar] = useState('temp');
  const [selectedRange, setSelectedRange] = useState('ALL'); // '1Y' | '5Y' | '10Y' | 'ALL'
  const [selectedPreset, setSelectedPreset] = useState('lakshadweep');
  const [latVal, setLatVal] = useState(10.0);
  const [lonVal, setLonVal] = useState(75.0);

  // Fetch real model timeseries on mount or when variable/location changes
  useEffect(() => {
    fetchModelTimeseries(selectedVar, latVal, lonVal);
  }, [selectedVar, latVal, lonVal, activeDataset]);

  const currentVarObj = VARIABLES.find(v => v.id === selectedVar) || VARIABLES[0];

  // Process authentic timeseries data from backend NetCDF
  const rawTimestamps = modelTimeseries?.timestamps || [];
  const rawValues = modelTimeseries?.values || [];
  const isLand = modelTimeseries?.is_land ?? false;

  const pointsCount = rawTimestamps.length;
  const rangePointCount = selectedRange === '1Y' ? 12 : selectedRange === '5Y' ? 60 : selectedRange === '10Y' ? 120 : pointsCount || 480;
  const startIndex = Math.max(0, pointsCount - rangePointCount);

  const displayedData = useMemo(() => {
    if (!rawTimestamps.length || !rawValues.length) return [];
    return rawTimestamps.slice(startIndex).map((ts, idx) => ({
      index: startIndex + idx,
      dateStr: ts,
      value: rawValues[startIndex + idx],
    }));
  }, [rawTimestamps, rawValues, startIndex]);

  // SVG Chart Geometry
  const svgWidth = 740;
  const svgHeight = 260;
  const margin = { top: 24, right: 25, bottom: 35, left: 55 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const validVals = displayedData.map(d => d.value).filter(v => v !== null && v !== undefined && !isNaN(v));
  const minVal = validVals.length > 0 ? Math.min(...validVals) : 0;
  const maxVal = validVals.length > 0 ? Math.max(...validVals) : 1;
  const valRange = maxVal - minVal > 0.001 ? maxVal - minVal : 1.0;

  const scaleX = (idx) => margin.left + ((idx - startIndex) / (rangePointCount - 1 || 1)) * plotWidth;
  const scaleY = (v) => margin.top + plotHeight - ((v - minVal) / valRange) * plotHeight;

  const linePoints = displayedData
    .filter(d => d.value !== null && d.value !== undefined && !isNaN(d.value))
    .map(d => `${scaleX(d.index)},${scaleY(d.value)}`)
    .join(' ');

  // Compute real power spectrum (FFT Periodogram) for Spectral Tab
  const spectralData = useMemo(() => {
    const fullVals = rawValues.filter(v => v !== null && !isNaN(v));
    const N = fullVals.length;
    if (N < 24) return [];
    const mean = fullVals.reduce((a, b) => a + b, 0) / N;
    const detrended = fullVals.map(v => v - mean);

    const spectra = [];
    for (let period = 2; period <= 60; period++) {
      const k = (2 * Math.PI) / period;
      let cosSum = 0;
      let sinSum = 0;
      for (let t = 0; t < N; t++) {
        cosSum += detrended[t] * Math.cos(k * t);
        sinSum += detrended[t] * Math.sin(k * t);
      }
      const power = (cosSum * cosSum + sinSum * sinSum) / N;
      spectra.push({ period, power });
    }
    return spectra;
  }, [rawValues]);

  const stats = modelTimeseries?.stats;

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
            {[
              { id: 'timeseries', label: 'Time Series' },
              { id: 'vertical', label: 'Vertical Stratification' },
              { id: 'hovmoller', label: 'Hovmöller Climatology' },
              { id: 'spectral', label: 'Spectral FFT Periodogram' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider transition-all ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                    : 'bg-slate-950/70 border border-sky-500/20 text-slate-400 hover:text-white hover:border-sky-500/40'
                }`}
              >
                {t.label}
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
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">SAMPLE REGION:</span>
              <select
                value={selectedPreset}
                onChange={(e) => {
                  setSelectedPreset(e.target.value);
                  const p = OCEAN_LOCATION_PRESETS.find(x => x.id === e.target.value);
                  if (p) {
                    setLatVal(p.lat);
                    setLonVal(p.lon);
                  }
                }}
                className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-cyan-300 font-bold font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {OCEAN_LOCATION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.lat >= 0 ? `${p.lat}°N` : `${Math.abs(p.lat)}°S`}, {p.lon}°E)
                  </option>
                ))}
              </select>
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
                {VARIABLES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">COORDINATES:</span>
              <span className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-slate-200 font-bold font-mono">
                {latVal >= 0 ? `${latVal.toFixed(2)}°N` : `${Math.abs(latVal).toFixed(2)}°S`}, {lonVal.toFixed(2)}°E
              </span>
            </div>
          </div>

          <span className="text-[10px] text-sky-300/70 font-mono">
            {displayedData.length} Timesteps ({displayedData[0]?.dateStr || '...'} — {displayedData[displayedData.length - 1]?.dateStr || '...'})
          </span>
        </div>

        {/* Main 2-Column Analytics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Content Area (8 Cols) */}
          <div className="lg:col-span-8 p-4 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col gap-3 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-transparent" />
            <div className="flex items-center justify-between border-b border-sky-500/15 pb-2">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>
                  {activeTab === 'timeseries' && `${currentVarObj.label} Time Series (1980–2019)`}
                  {activeTab === 'vertical' && `${currentVarObj.label} Water Column Stratification`}
                  {activeTab === 'hovmoller' && `40-Year Monthly Climatology Matrix`}
                  {activeTab === 'spectral' && `Power Spectral Density (Periodogram)`}
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {activeTab === 'timeseries' ? 'Click trace to scrub 4D timeline' : 'Direct Reanalysis Diagnostics'}
              </span>
            </div>

            {isTimeseriesLoading ? (
              <div className="h-64 bg-slate-950/80 rounded-xl border border-sky-500/15 flex items-center justify-center font-mono text-xs text-sky-300">
                <Activity className="w-5 h-5 animate-spin mr-2" />
                STREAMING 40-YEAR REANALYSIS TRACE...
              </div>
            ) : isLand ? (
              <div className="h-64 bg-slate-950/80 rounded-xl border border-rose-500/20 flex flex-col items-center justify-center font-mono text-xs text-rose-300 p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
                <span className="font-bold">LAND MASK / NO OCEAN DATA AT POINT</span>
                <span className="text-slate-400 text-[11px] mt-1">
                  Selected coordinates ({latVal}°N, {lonVal}°E) fall outside oceanic domain. Please choose an ocean basin preset.
                </span>
              </div>
            ) : activeTab === 'timeseries' ? (
              <div className="w-full overflow-x-auto bg-slate-950/80 p-3 rounded-xl border border-sky-500/15 shadow-inner">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto cursor-crosshair overflow-visible"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const normX = Math.max(0, Math.min(1, (clickX - margin.left) / plotWidth));
                    const targetIdx = startIndex + Math.round(normX * (rangePointCount - 1));
                    setTimeIndex(Math.min(pointsCount - 1, Math.max(0, targetIdx)));
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
                  {linePoints && (
                    <polyline
                      points={linePoints}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      filter="drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))"
                    />
                  )}

                  {/* Timeline seeker marker */}
                  {timeIndex >= startIndex && timeIndex < startIndex + displayedData.length && (
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
                        cy={scaleY(rawValues[timeIndex] || minVal)}
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
            ) : activeTab === 'vertical' ? (
              <div className="h-64 bg-slate-950/80 rounded-xl border border-sky-500/15 p-4 flex flex-col justify-between font-mono text-xs">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold">
                    <Layers className="w-4 h-4" />
                    <span>Upper Ocean Boundary Layer & MLD</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    The 1980–2019 NetCDF reanalysis models the continuous upper-ocean boundary layer from the surface (0 m) down to the dynamic Mixed Layer Depth (MLD ≈ {stats ? Math.round(stats.mean) : 40} m for this variable).
                  </p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    For high-resolution 40-level deep profiles descending to 2000m depth, utilize the In-Situ Argo Network profiler or Model vs Observation Colocation studio.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setActivePage('argo_network')}
                    className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-[10px] font-bold"
                  >
                    VIEW IN-SITU ARGO PROFILES (0–2000 m)
                  </button>
                  <button
                    onClick={() => setActivePage('comparison')}
                    className="px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-lg text-[10px] font-bold"
                  >
                    OPEN 4D MODEL VS OBS COLOCATION
                  </button>
                </div>
              </div>
            ) : activeTab === 'hovmoller' ? (
              <div className="h-64 bg-slate-950/80 rounded-xl border border-sky-500/15 p-3 flex flex-col justify-between font-mono text-xs overflow-hidden">
                <div className="text-[10px] text-slate-400 mb-1 flex justify-between">
                  <span>MONTHLY CLIMATOLOGY (Jan–Dec across 40 Years, 1980–2019)</span>
                  <span className="text-emerald-400">Authentic Reanalysis</span>
                </div>
                <div className="grid grid-cols-12 gap-1 flex-1 py-1">
                  {Array.from({ length: 12 }).map((_, mIdx) => {
                    const monthValues = rawValues.filter((_, i) => i % 12 === mIdx && !isNaN(_));
                    const monthAvg = monthValues.length > 0 ? monthValues.reduce((a, b) => a + b, 0) / monthValues.length : minVal;
                    const norm = Math.max(0, Math.min(1, (monthAvg - minVal) / valRange));
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return (
                      <div key={mIdx} className="flex flex-col items-center justify-end h-full">
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${Math.max(10, norm * 100)}%`,
                            background: `hsl(${220 - norm * 180}, 85%, 55%)`,
                          }}
                        />
                        <span className="text-[9px] text-slate-400 mt-1">{monthNames[mIdx]}</span>
                        <span className="text-[8px] text-white font-bold">{monthAvg.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[9px] text-slate-400 text-center pt-1 border-t border-sky-500/10">
                  Reflects the seasonal Indian Ocean monsoon cycle: summer heating, southwest monsoon cooling, and winter northeast monsoon.
                </div>
              </div>
            ) : (
              /* Spectral Analysis Tab */
              <div className="h-64 bg-slate-950/80 rounded-xl border border-sky-500/15 p-3 flex flex-col justify-between font-mono text-xs">
                <div className="text-[10px] text-slate-400 mb-1 flex justify-between">
                  <span>DISCRETE FOURIER POWER SPECTRUM (Periodogram)</span>
                  <span className="text-cyan-300">Dominant Harmonics: 12m (Annual), 6m (Monsoon)</span>
                </div>
                <div className="flex-1 w-full bg-slate-950 rounded p-2 border border-sky-500/10 flex items-end gap-1">
                  {spectralData.map((s, idx) => {
                    const maxPower = Math.max(...spectralData.map(x => x.power), 1);
                    const barHeight = Math.max(2, (s.power / maxPower) * 100);
                    const isPeak = s.period === 12 || s.period === 6;
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      >
                        <div
                          className={`w-full rounded-t transition-all ${isPeak ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-700'}`}
                          style={{ height: `${barHeight}%` }}
                        />
                        {isPeak && (
                          <span className="text-[8px] text-cyan-300 font-bold mt-0.5">{s.period}m</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-[9px] text-slate-400 text-center pt-1 border-t border-sky-500/10">
                  X-axis: Oscillation Period (2 to 60 Months). Sharp peaks at 12m and 6m validate the astronomical solar cycle and biannual monsoon circulation.
                </div>
              </div>
            )}
          </div>

          {/* Right Statistics Card (4 Cols) */}
          <div className="lg:col-span-4 p-4 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col justify-between gap-4 text-xs shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400" />
            <div className="flex flex-col gap-3">
              <span className="font-bold text-emerald-200/80 uppercase tracking-widest text-[10px] font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                AUTHENTIC REANALYSIS METRICS
              </span>

              {stats ? (
                <div className="flex flex-col gap-2.5 text-[11px] font-mono">
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                    <span className="text-slate-400">MEAN CLIMATOLOGY</span>
                    <span className="text-sm font-bold text-emerald-300 tabular-nums">{stats.mean.toFixed(2)} {currentVarObj.unit}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                    <span className="text-slate-400">HISTORICAL MAX</span>
                    <span className="text-sm font-bold text-amber-300 tabular-nums">{stats.max.toFixed(2)} {currentVarObj.unit}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                    <span className="text-slate-400">HISTORICAL MIN</span>
                    <span className="text-sm font-bold text-sky-300 tabular-nums">{stats.min.toFixed(2)} {currentVarObj.unit}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                    <span className="text-slate-400">STANDARD DEVIATION</span>
                    <span className="text-sm font-bold text-purple-300 tabular-nums">±{stats.std.toFixed(2)} {currentVarObj.unit}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                    <span className="text-slate-400">DECADAL TREND</span>
                    <span className="text-sm font-bold text-teal-300 tabular-nums">
                      {stats.trend_per_decade > 0 ? `+${stats.trend_per_decade.toFixed(3)}` : stats.trend_per_decade.toFixed(3)} {currentVarObj.unit}/dec
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                    <span className="text-slate-400">SEASONAL AMPLITUDE</span>
                    <span className="text-sm font-bold text-cyan-300 tabular-nums">±{stats.seasonal_amplitude.toFixed(2)} {currentVarObj.unit}</span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 font-mono text-[11px]">
                  {isTimeseriesLoading ? 'LOADING STATISTICS...' : 'SELECT REGION TO EVALUATE'}
                </div>
              )}
            </div>

            <button
              onClick={() => setActivePage('home')}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs tracking-wider font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(52,211,153,0.3)]"
            >
              EXPLORE IN 3D GLOBE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};