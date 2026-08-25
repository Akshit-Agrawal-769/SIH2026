import React from 'react';
import {
  Waves,
  Compass,
  ShieldCheck,
  Database,
  Cpu,
  Activity,
  Sliders,
  Info,
  Layers,
  ChevronDown
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const Header = () => {
  const {
    health,
    metadata,
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
      case 'temp': return 'Temperature (temp)';
      case 'salt': return 'Salinity (salt)';
      case 'u': return 'Zonal Velocity (u)';
      case 'v': return 'Meridional Velocity (v)';
      case 'chl': return 'Chlorophyll-a (chl)';
      default: return v;
    }
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <header className="relative z-30 flex items-center justify-between px-4 py-2 bg-slate-950/95 border-b border-slate-800 text-slate-100 shadow-xl select-none min-h-[56px]">
      {/* Left Branding & Station Identifier */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-950 border border-sky-500/40 text-sky-400">
          <Waves className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-slate-100">
              INCOIS 3D Ocean Data System
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-sky-950 border border-sky-600/60 text-sky-300 rounded">
              PS 26067
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
            <span>Operational Ocean Forecast & In-Situ Argo Co-Display</span>
          </div>
        </div>
      </div>

      {/* Middle Dataset Selector & Active Status */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Dataset Selector */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
          <Database className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-[11px] text-slate-400 font-medium">Dataset:</span>
          {datasets.length > 0 ? (
            <select
              value={activeDataset}
              onChange={(e) => selectDataset(e.target.value)}
              className="bg-transparent text-xs text-sky-300 font-mono font-medium focus:outline-none cursor-pointer pr-2"
            >
              {datasets.map((d) => (
                <option key={d} value={d} className="bg-slate-900 text-slate-200">
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-amber-400 font-mono">REAL DATASET REQUIRED</span>
          )}
        </div>

        {/* Domain Coordinates */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300">
          <Compass className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span className="text-[11px] text-slate-400">Domain:</span>
          <span className="font-mono text-[11px] text-slate-200">
            58°E to 96°E, 4°N to 26°N
          </span>
        </div>

        {/* Active Variable & Timestep */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs">
          <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-[11px] text-slate-400">Active:</span>
          <span className="font-mono text-[11px] text-sky-300 font-bold">
            {getVarLabel(variable)}
          </span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-[11px] text-teal-300">
            T+{timeIndex * 24}h
          </span>
        </div>
      </div>

      {/* Right Controls & Health Status */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Toggle Control Panel Rail (Mobile/Desktop) */}
        <button
          onClick={toggleControlPanel}
          title="Toggle Controls Panel"
          className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
            isControlPanelOpen
              ? 'bg-slate-800 border-sky-500/50 text-sky-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">Controls</span>
        </button>

        {/* Toggle Inspector Panel (Mobile/Desktop) */}
        <button
          onClick={toggleInspector}
          title="Toggle Data Inspector"
          className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
            isInspectorOpen
              ? 'bg-slate-800 border-teal-500/50 text-teal-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">Inspector</span>
        </button>

        {/* Diagnostics Drawer Toggle */}
        <button
          onClick={toggleDiagnostics}
          title="Toggle System Diagnostics"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition-colors ${
            isDiagnosticsOpen
              ? 'bg-slate-800 border-indigo-500 text-indigo-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Diagnostics</span>
        </button>

        {/* Strict Data Policy & Backend Health Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <ShieldCheck className={`w-4 h-4 shrink-0 ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="hidden xl:inline font-mono text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
            {health?.data_policy || 'STRICT NO MOCK DATA'}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-400 animate-status' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className={`font-mono text-[10px] font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isHealthy ? 'ONLINE' : 'CHECK'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
