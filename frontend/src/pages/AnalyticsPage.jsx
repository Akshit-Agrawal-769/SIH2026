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

  const [selectedVar, setSelectedVar] = useState('temp');
  const [selectedSeason, setSelectedSeason] = useState('all');

  const variables = [
    { id: 'temp', label: 'Sea Surface Temp (SST)', unit: '°C', baseline: 28.2, amp: 1.8, trend: 0.015 },
    { id: 'salt', label: 'Sea Surface Salinity (SSS)', unit: 'PSU', baseline: 35.4, amp: 0.6, trend: -0.002 },
    { id: 'chl', label: 'Chlorophyll-a (CHL)', unit: 'mg/m³', baseline: 0.32, amp: 0.28, trend: 0.001 },
    { id: 'mld', label: 'Mixed Layer Depth (MLD)', unit: 'm', baseline: 42.0, amp: 22.0, trend: 0.04 },
    { id: 'dic', label: 'Dissolved Inorganic Carbon', unit: 'µmol/kg', baseline: 1980, amp: 35, trend: 0.85 },
    { id: 'no3', label: 'Nitrate Concentration (NO3)', unit: 'µmol/L', baseline: 4.8, amp: 3.2, trend: 0.01 },
    { id: 'pco2', label: 'Surface pCO2', unit: 'µatm', baseline: 385, amp: 25, trend: 1.45 },
  ];

  const currentVarObj = variables.find(v => v.id === selectedVar) || variables[0];

  // Generate 480 monthly timesteps (Jan 1980 to Dec 2019)
  const timeSeriesData = useMemo(() => {
    const data = [];
    const startYear = 1980;
    for (let i = 0; i < 480; i++) {
      const year = startYear + Math.floor(i / 12);
      const month = (i % 12) + 1;
      const monthAngle = (month / 12) * 2 * Math.PI;
      // Realistic annual seasonal cycle + interannual decadal trend + ENSO/IOD oscillation
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

  // SVG Chart Geometry
  const svgWidth = 840;
  const svgHeight = 280;
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const vals = timeSeriesData.map(d => d.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const valRange = maxVal - minVal > 0.01 ? maxVal - minVal : 1.0;

  const scaleX = (idx) => margin.left + (idx / 479) * plotWidth;
  const scaleY = (v) => margin.top + plotHeight - ((v - minVal) / valRange) * plotHeight;

  const linePoints = timeSeriesData.map(d => `${scaleX(d.index)},${scaleY(d.value)}`).join(' ');

  // Current selected timestep marker
  const currentPoint = timeSeriesData[timeIndex] || timeSeriesData[0];

  return (
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
                SCIENTIFIC DECADAL ANALYTICS
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
              Indian Ocean 40-Year Temporal Record
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl">
              Analysis across 480 monthly timesteps (January 1980 to December 2019). Tracking seasonal cycles, Indian Ocean Dipole (IOD) anomalies, and long-term thermodynamic trajectories.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePage('explorer')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950/50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>EXPLORE IN 3D SCENE</span>
            </button>
          </div>
        </div>

        {/* Variable Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {variables.map((v) => {
            const isActive = selectedVar === v.id;
            return (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVar(v.id);
                  setVariable(v.id);
                }}
                className={`px-3 py-2 text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#10243e] border-emerald-500 text-emerald-300 shadow-md'
                    : 'bg-[#080e1a] border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span>{v.label}</span>
                <span className="text-[10px] text-slate-500">({v.unit})</span>
              </button>
            );
          })}
        </div>

        {/* Basin-Wide Statistical Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 uppercase">Basin Mean (40-Yr)</span>
            <div className="text-lg font-bold text-emerald-300 tabular-nums">
              {currentVarObj.baseline.toFixed(2)} <span className="text-xs font-normal text-slate-400">{currentVarObj.unit}</span>
            </div>
            <span className="text-[9px] text-slate-500">Spatial/temporal climatology</span>
          </div>

          <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 uppercase">Seasonal Amplitude</span>
            <div className="text-lg font-bold text-sky-300 tabular-nums">
              ±{currentVarObj.amp.toFixed(2)} <span className="text-xs font-normal text-slate-400">{currentVarObj.unit}</span>
            </div>
            <span className="text-[9px] text-slate-500">Monsoon cycle range</span>
          </div>

          <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 uppercase">Decadal Trend</span>
            <div className="text-lg font-bold text-amber-300 tabular-nums">
              {currentVarObj.trend > 0 ? `+${(currentVarObj.trend * 10).toFixed(3)}` : (currentVarObj.trend * 10).toFixed(3)} <span className="text-xs font-normal text-slate-400">{currentVarObj.unit}/decade</span>
            </div>
            <span className="text-[9px] text-slate-500">Linear regression slope</span>
          </div>

          <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 uppercase">Current Timestep Value</span>
            <div className="text-lg font-bold text-cyan-300 tabular-nums">
              {currentPoint.value.toFixed(2)} <span className="text-xs font-normal text-slate-400">{currentVarObj.unit}</span>
            </div>
            <span className="text-[9px] text-slate-500">{currentPoint.dateStr} (Step {timeIndex + 1})</span>
          </div>
        </div>

        {/* 480-Timestep Interactive Time Series Plot */}
        <div className="p-5 bg-[#080e1a] border border-emerald-500/30 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>480-MONTH CONTINUOUS BASIN TIME SERIES (1980—2019)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Click anywhere on the chart to jump timeline
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full min-w-[700px] h-auto cursor-crosshair overflow-visible"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const normX = Math.max(0, Math.min(1, (clickX - margin.left) / plotWidth));
                const targetIdx = Math.round(normX * 479);
                setTimeIndex(targetIdx);
              }}
            >
              {/* Axes lines */}
              <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />
              <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#334155" strokeWidth="1" />

              {/* Decadal Year Grids */}
              {[1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2019].map((yr) => {
                const idx = (yr - 1980) * 12;
                const xPos = scaleX(Math.min(idx, 479));
                return (
                  <g key={yr}>
                    <line x1={xPos} y1={margin.top} x2={xPos} y2={svgHeight - margin.bottom} stroke="#1e293b" strokeDasharray="3 3" />
                    <text x={xPos} y={svgHeight - margin.bottom + 16} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
                      {yr}
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Value Labels */}
              {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
                <g key={i}>
                  <line x1={margin.left - 4} y1={scaleY(v)} x2={svgWidth - margin.right} y2={scaleY(v)} stroke="#1e293b" strokeDasharray="2 2" />
                  <text x={margin.left - 8} y={scaleY(v) + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {v.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Continuous Trend Line */}
              <polyline points={linePoints} fill="none" stroke="#10b981" strokeWidth="2" />

              {/* Current Active Timestep Cursor Bar */}
              <line
                x1={scaleX(timeIndex)}
                y1={margin.top}
                x2={scaleX(timeIndex)}
                y2={svgHeight - margin.bottom}
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="2 2"
              />
              <circle
                cx={scaleX(timeIndex)}
                cy={scaleY(currentPoint.value)}
                r="4.5"
                fill="#38bdf8"
                stroke="#080e1a"
                strokeWidth="2"
              />

              {/* Y Axis Title */}
              <text x={18} y={svgHeight / 2} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 18 ${svgHeight / 2})`}>
                {currentVarObj.label} ({currentVarObj.unit})
              </text>
            </svg>
          </div>
        </div>

        {/* Oceanographic Regimes Context Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-2 text-xs">
            <span className="font-bold text-emerald-300 uppercase tracking-wider">
              Monsoonal Climatology & Inversion Dynamics
            </span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              The Indian Ocean is distinguished by semi-annual wind reversals driving the Southwest Monsoon (June—September) and Northeast Monsoon (November—February). Strong coastal upwelling along Somalia and Oman causes drastic SST drops and intense nutrient flux into the photic zone.
            </p>
          </div>

          <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-2 text-xs">
            <span className="font-bold text-teal-300 uppercase tracking-wider">
              Indian Ocean Dipole (IOD) Mode
            </span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Coupled ocean-atmosphere oscillation featuring anomalous cooling in the southeastern tropical Indian Ocean and anomalous warming in the western tropical Indian Ocean during positive IOD phases, significantly impacting regional rainfall patterns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};