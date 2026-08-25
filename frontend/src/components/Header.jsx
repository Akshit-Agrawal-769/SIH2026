import React from 'react';
import {
  Compass,
  Database,
  Cpu,
  Sliders,
  Info
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const Header = () => {
  const {
    health,
    datasets,
    activeDataset,
    selectDataset,
    variable,
    timeIndex,
    isDiagnosticsOpen,
    toggleDiagnostics,
    isControlPanelOpen,
    toggleControlPanel,
    isInspectorOpen,
    toggleInspector,
  } = useOceanStore();

  const getVarLabel = (v) => {
    switch (v) {
      case 'temp': return 'TEMP (theta)';
      case 'salt': return 'PSAL (Sp)';
      case 'u': return 'U-VEL (u)';
      case 'v': return 'V-VEL (v)';
      case 'chl': return 'CHLA (chl)';
      default: return v?.toUpperCase() || 'TEMP';
    }
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <header className="relative z-30 flex items-center justify-between px-3 py-1.5 bg-[#070c18] border-b border-[#1e293b] text-slate-200 select-none min-h-[46px]">
      {/* Left Station Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-sky-400 rounded-none shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider uppercase font-mono text-slate-100">
              INCOIS Ocean Data System
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-tight">
              Operational ROMS & In-Situ Argo 4D Analysis
            </span>
          </div>
        </div>
      </div>

      {/* Middle Dataset Selector & Field Indicators */}
      <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
        {/* Dataset Selector */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] text-[11px]">
          <Database className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="text-slate-400">DATASET:</span>
          {datasets.length > 0 ? (
            <select
              value={activeDataset}
              onChange={(e) => selectDataset(e.target.value)}
              className="bg-transparent text-sky-300 font-mono font-medium focus:outline-none cursor-pointer pr-1"
            >
              {datasets.map((d) => (
                <option key={d} value={d} className="bg-[#0c1424] text-slate-200">
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-amber-400 font-mono">REAL DATASET REQUIRED</span>
          )}
        </div>

        {/* Spatial Coordinates */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] text-[11px] text-slate-300">
          <Compass className="w-3 h-3 text-teal-400 shrink-0" />
          <span className="text-slate-400">DOMAIN:</span>
          <span className="text-slate-200">
            58.00°E—96.00°E, 4.00°N—26.00°N
          </span>
        </div>

        {/* Active Field & Timestep */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] text-[11px]">
          <span className="text-slate-400">FIELD:</span>
          <span className="text-sky-300 font-bold">
            {getVarLabel(variable)}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">STEP:</span>
          <span className="text-teal-300 font-bold">
            T+{timeIndex * 24}h
          </span>
        </div>
      </div>

      {/* Right Controls & Health Status */}
      <div className="flex items-center gap-2">
        {/* Toggle Control Panel Rail */}
        <button
          onClick={toggleControlPanel}
          title="Toggle Variable & Shading Controls"
          className={`flex items-center gap-1 px-2 py-1 text-xs font-mono border transition-colors ${
            isControlPanelOpen
              ? 'bg-[#162138] border-sky-500/60 text-sky-300'
              : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span className="hidden md:inline text-[11px]">CONTROLS</span>
        </button>

        {/* Toggle Inspector Panel */}
        <button
          onClick={toggleInspector}
          title="Toggle In-Situ & Metadata Inspector"
          className={`flex items-center gap-1 px-2 py-1 text-xs font-mono border transition-colors ${
            isInspectorOpen
              ? 'bg-[#162138] border-teal-500/60 text-teal-300'
              : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Info className="w-3 h-3" />
          <span className="hidden md:inline text-[11px]">INSPECTOR</span>
        </button>

        {/* Diagnostics Drawer Toggle */}
        <button
          onClick={toggleDiagnostics}
          title="Toggle System Diagnostics"
          className={`flex items-center gap-1 px-2 py-1 text-xs font-mono border transition-colors ${
            isDiagnosticsOpen
              ? 'bg-[#162138] border-indigo-500 text-indigo-300'
              : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Cpu className="w-3 h-3" />
          <span className="hidden sm:inline text-[11px]">DIAGNOSTICS</span>
        </button>

        {/* Backend Health Status */}
        <div className="flex items-center gap-2 px-2 py-1 bg-[#0c1424] border border-[#1e293b] text-xs font-mono">
          <span className="hidden xl:inline text-[10px] text-slate-400 uppercase tracking-wider">
            {health?.data_policy || 'QC 1 & 2 ACCEPTED'}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 ${
                isHealthy ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className={`text-[10px] font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isHealthy ? 'ONLINE' : 'CHECK'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
