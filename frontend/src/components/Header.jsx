import React from 'react';
import {
  Compass,
  Database,
  Cpu,
  Sliders,
  Info,
  Crosshair,
  Radio,
  Activity,
  Layers
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const Header = () => {
  const {
    activePage,
    setActivePage,
    health,
    datasets,
    activeDataset,
    selectDataset,
    variable,
    timeIndex,
    metadata,
    isDiagnosticsOpen,
    toggleDiagnostics,
    isControlPanelOpen,
    toggleControlPanel,
    isInspectorOpen,
    toggleInspector,
    toggleGoToLocationModal,
  } = useOceanStore();

  const navItems = [
    { id: 'home', label: 'MISSION CONTROL' },
    { id: 'explorer', label: '3D EXPLORER' },
    { id: 'coordinates', label: 'COORDINATES' },
    { id: 'argo', label: 'ARGO IN-SITU' },
    { id: 'comparison', label: '4D COMPARISON' },
    { id: 'analytics', label: 'ANALYTICS' },
    { id: 'data', label: 'DATA CATALOG' },
    { id: 'methodology', label: 'METHODOLOGY' },
  ];

  const getVarLabel = (v) => {
    if (metadata?.variable_info?.[v]?.long_name) {
      return `${v.toUpperCase()} (${metadata.variable_info[v].long_name.split('(')[0].trim()})`;
    }
    switch (v) {
      case 'temp': return 'TEMP (SST)';
      case 'salt': return 'PSAL (SSS)';
      case 'u': return 'U-VEL (u)';
      case 'v': return 'V-VEL (v)';
      case 'chl': return 'CHLA (chl)';
      case 'mld': return 'MLD (depth)';
      case 'dic': return 'DIC (carbon)';
      case 'no3': return 'NO3 (nitrate)';
      case 'pco2': return 'pCO2 (atm)';
      default: return v?.toUpperCase() || 'TEMP';
    }
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <header className="relative z-30 flex flex-col bg-[#060a14] border-b border-[#1e293b] text-slate-200 select-none">
      {/* Top Bar: Identity, System Status, Actions */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#141e33] min-h-[44px]">
        {/* Left: INCOIS Brand */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActivePage('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-2.5 h-2.5 bg-cyan-400 group-hover:bg-cyan-300 transition-colors shadow-sm shadow-cyan-400/50" />
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-widest uppercase font-mono text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                INCOIS OCEAN DATA SYSTEM
                <span className="text-[9px] px-1 py-0.2 bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-normal">
                  v2.0
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:inline">
                Indian Ocean Operational ROMS & Coriolis In-Situ Argo Colocation
              </span>
            </div>
          </div>
        </div>

        {/* Middle Status (Dynamic Contextual Readout) */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono">
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
              <span className="text-amber-400 font-mono">INCOIS-BIO-ROMS.nc</span>
            )}
          </div>

          {/* Spatial Coordinates */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] text-[11px] text-slate-300">
            <Compass className="w-3 h-3 text-teal-400 shrink-0" />
            <span className="text-slate-400">DOMAIN:</span>
            <span className="text-slate-200">
              {metadata?.bounds
                ? `${metadata.bounds.min_lon.toFixed(1)}°E—${metadata.bounds.max_lon.toFixed(1)}°E, ${metadata.bounds.min_lat.toFixed(1)}°N—${metadata.bounds.max_lat.toFixed(1)}°N`
                : '30.0°E—120.0°E, -30.0°N—30.0°N'}
            </span>
          </div>

          {/* Active Field & Timestep */}
          {activePage === 'explorer' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] text-[11px]">
              <span className="text-slate-400">FIELD:</span>
              <span className="text-sky-300 font-bold">
                {getVarLabel(variable)}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">DATE:</span>
              <span className="text-teal-300 font-bold">
                {metadata?.time_range?.[timeIndex]
                  ? metadata.time_range[timeIndex].split('T')[0]
                  : `Step ${timeIndex + 1}`}
              </span>
            </div>
          )}
        </div>

        {/* Right Tools & Status */}
        <div className="flex items-center gap-1.5">
          {/* Quick Go-To Coordinate Button */}
          <button
            onClick={toggleGoToLocationModal}
            title="Locate Geographic Coordinates (Lat / Lon)"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono border bg-[#0c1424] border-cyan-500/50 hover:bg-cyan-950 hover:border-cyan-400 text-cyan-300 transition-colors shadow-sm"
          >
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px] font-bold">GO TO LOCATION</span>
          </button>

          {/* Explorer View Specific Panel Toggles */}
          {activePage === 'explorer' && (
            <>
              <button
                onClick={toggleControlPanel}
                title="Toggle Variable & Shading Controls"
                className={`hidden md:flex items-center gap-1 px-2 py-1 text-xs font-mono border transition-colors ${
                  isControlPanelOpen
                    ? 'bg-[#162138] border-sky-500/60 text-sky-300'
                    : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span className="text-[11px]">CONTROLS</span>
              </button>

              <button
                onClick={toggleInspector}
                title="Toggle In-Situ & Metadata Inspector"
                className={`hidden md:flex items-center gap-1 px-2 py-1 text-xs font-mono border transition-colors ${
                  isInspectorOpen
                    ? 'bg-[#162138] border-teal-500/60 text-teal-300'
                    : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200'
                }`}
              >
                <Info className="w-3 h-3" />
                <span className="text-[11px]">INSPECTOR</span>
              </button>
            </>
          )}

          {/* Diagnostics Drawer Toggle */}
          <button
            onClick={toggleDiagnostics}
            title="Toggle System Diagnostics"
            className={`flex items-center gap-1 px-2 py-1 text-xs font-mono border transition-colors ${
              isDiagnosticsOpen
                ? 'bg-[#162138] border-indigo-500 text-indigo-300'
                : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span className="hidden sm:inline text-[11px]">DIAGNOSTICS</span>
          </button>

          {/* Shortcuts Reference Toggle */}
          <button
            onClick={() => useOceanStore.getState().toggleShortcutsModal()}
            title="Keyboard Shortcuts & Operations Help (?)"
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono border bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-sky-300 hover:border-sky-500 transition-colors"
          >
            <span className="font-bold text-sky-400">?</span>
          </button>

          {/* Backend Health Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0c1424] border border-[#1e293b] text-xs font-mono">
            <span
              className={`w-1.5 h-1.5 ${
                isHealthy ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className={`text-[10px] font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isHealthy ? 'ONLINE' : 'ACTIVE'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Rail Bar */}
      <nav className="flex items-center gap-1 px-3 py-1 bg-[#090e1c] overflow-x-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`px-3 py-1 text-xs font-mono font-bold tracking-wider transition-all whitespace-nowrap border-b-2 flex items-center gap-1.5 ${
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#10182c]'
              }`}
            >
              {item.id === 'home' && <Activity className="w-3 h-3 text-cyan-400" />}
              {item.id === 'explorer' && <Layers className="w-3 h-3 text-sky-400" />}
              {item.id === 'coordinates' && <Crosshair className="w-3 h-3 text-teal-400" />}
              {item.id === 'argo' && <Radio className="w-3 h-3 text-amber-400" />}
              {item.id === 'comparison' && <Compass className="w-3 h-3 text-indigo-400" />}
              {item.id === 'analytics' && <Activity className="w-3 h-3 text-emerald-400" />}
              {item.id === 'data' && <Database className="w-3 h-3 text-blue-400" />}
              {item.id === 'methodology' && <Info className="w-3 h-3 text-purple-400" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
