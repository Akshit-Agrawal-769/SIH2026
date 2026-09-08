import React, { useState } from 'react';
import {
  Layers,
  MapPin,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Crosshair,
  Copy,
  Check,
  Minimize2,
  Maximize2,
  Sliders,
  Compass,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const LocationDataPanel = () => {
  const {
    cursorCoords,
    variable,
    selectVitalSign,
    depthLevelMeters,
    setDepthLevelMeters,
    layers,
    toggleLayer,
    triggerCameraAction,
  } = useOceanStore();

  const [isLayersOpen, setIsLayersOpen] = useState(true);
  const [isScenesOpen, setIsScenesOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  // Format dynamic coordinates
  const lat = cursorCoords?.lat ?? 10.0;
  const lon = cursorCoords?.lon ?? 75.0;
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

  const availableVariables = [
    { id: 'temp', label: 'Sea Surface Temperature (SST)', code: 'SST', unit: '°C' },
    { id: 'salt', label: 'Sea Surface Salinity (SSS)', code: 'SSS', unit: 'PSU' },
    { id: 'chl', label: 'Chlorophyll-a Biomass (CHLA)', code: 'CHLA', unit: 'mg/m³' },
    { id: 'currents', label: 'Surface Velocity Vectors (CURR)', code: 'CURR', unit: 'm/s' },
    { id: 'waves', label: 'Significant Wave Height (SWH)', code: 'SWH', unit: 'm' },
  ];

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Authentic ROMS numerical grid indexing (1/12° resolution)
  const romsI = Math.max(0, Math.min(1199, Math.floor((lon - 20) * 12)));
  const romsJ = Math.max(0, Math.min(839, Math.floor((lat + 40) * 12)));
  const romsK = Math.max(1, 40 - Math.floor(depthLevelMeters / 50));
  const estDensity = (23.5 + (depthLevelMeters / 400) * 4.2).toFixed(2);

  if (isMinimized) {
    return (
      <div className="absolute top-18 left-6 z-30 flex items-center gap-2 p-1.5 bg-[rgba(3,7,18,0.6)] backdrop-blur-2xl rounded-xl border border-sky-500/30 shadow-[0_4px_25px_rgba(0,0,0,0.5),0_0_15px_rgba(6,182,212,0.15)] text-white select-none panel-transition animate-fade-slide hover:border-cyan-400/50">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-cyan-950/40 rounded-lg border border-cyan-500/30">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 pulse-beacon" />
          <span className="font-mono text-xs text-cyan-200 glow-text-cyan tabular-nums">{latStr} · {lonStr}</span>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1.5 rounded-lg hover:bg-sky-500/20 text-slate-300 hover:text-white transition-colors"
          title="Expand Ocean Intelligence Panel"
        >
          <Maximize2 className="w-4 h-4 text-cyan-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-18 left-6 z-30 w-80 mission-panel rounded-2xl p-4 text-white select-none panel-transition animate-fade-slide overflow-hidden relative">
      {/* Subtle Restrained Scanning Line */}
      <div className="absolute inset-0 scan-line pointer-events-none bg-gradient-to-b from-transparent via-cyan-400/[0.07] to-transparent h-10" />

      {/* ─── Panel Header ─── */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 pulse-beacon shadow-[0_0_8px_#00f2fe]" />
          <div>
            <h2 className="text-xs font-bold tracking-wider uppercase font-mono text-white flex items-center gap-1.5 glow-text-cyan">
              OCEAN INTELLIGENCE
            </h2>
            <span className="text-[9px] text-slate-400 tracking-tight block font-mono">
              ROMS SYNOPTIC TELEMETRY STREAM
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-sky-500/15 rounded-md transition-colors"
          title="Minimize to HUD Badge"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ─── Precise Coordinates & Grid Telemetry ─── */}
      <div className="p-2.5 rounded-xl bg-black/40 border border-sky-500/20 mb-3.5 shadow-inner">
        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-mono mb-1.5">
          <span className="flex items-center gap-1">
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-300 font-semibold">GEO RESOLUTION</span>
          </span>
          <button
            onClick={handleCopyCoords}
            className="flex items-center gap-1 text-[9px] text-cyan-300 hover:text-white transition-colors cursor-pointer"
            title="Copy Latitude, Longitude"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
            <span>{copied ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono mb-2">
          <div className="p-1.5 rounded-lg bg-black/40 border border-white/[0.06]">
            <span className="text-[9px] text-slate-500 block">LATITUDE</span>
            <span className="text-xs font-bold text-cyan-200 glow-text-cyan tabular-nums">{latStr}</span>
          </div>
          <div className="p-1.5 rounded-lg bg-black/40 border border-white/[0.06]">
            <span className="text-[9px] text-slate-500 block">LONGITUDE</span>
            <span className="text-xs font-bold text-cyan-200 glow-text-cyan tabular-nums">{lonStr}</span>
          </div>
        </div>

        {/* Real ROMS Grid Coordinate & Potential Density */}
        <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.06] text-[9.5px] font-mono">
          <span className="text-slate-400">ROMS CELL:</span>
          <span className="text-cyan-300 font-semibold tabular-nums">[i:{romsI}, j:{romsJ}, σ:{romsK}]</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">σ_θ: <span className="text-slate-200">{estDensity} kg/m³</span></span>
        </div>
      </div>

      {/* ─── ACTIVE OCEAN FIELD Selector (Hierarchy #2) ─── */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>ACTIVE OCEAN FIELD</span>
          </label>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
            CF-1.6
          </span>
        </div>

        <div className="relative">
          <select
            value={variable}
            onChange={(e) => selectVitalSign(e.target.value)}
            className="w-full bg-[#081226]/80 border border-cyan-500/40 hover:border-cyan-400/80 rounded-xl px-3 py-2 text-xs font-semibold text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all pr-8 shadow-[0_0_12px_rgba(6,182,212,0.12)]"
          >
            {availableVariables.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#071124] text-white">
                {v.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ─── VERTICAL DEPTH NAVIGATION ─── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5 font-mono">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            PROFILE DEPTH (σ-COORD)
          </span>
          <span className="text-xs font-bold text-cyan-300 tabular-nums glow-text-cyan">
            {depthLevelMeters} m {depthLevelMeters === 0 ? '(Surface)' : ''}
          </span>
        </div>

        <div className="relative py-1">
          <input
            type="range"
            min="0"
            max="2000"
            step="10"
            value={depthLevelMeters}
            onChange={(e) => setDepthLevelMeters(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800/80 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
          />
        </div>

        <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1 px-0.5">
          <span>0m (Surface)</span>
          <span>500m</span>
          <span>1000m</span>
          <span>2000m (Abyssal)</span>
        </div>
      </div>

      {/* ─── Collapsible: Data Layers ─── */}
      <div className="border-t border-white/[0.08] pt-2.5">
        <button
          onClick={() => setIsLayersOpen(!isLayersOpen)}
          className="w-full flex items-center justify-between py-1 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium text-[11px] uppercase tracking-wider font-mono">Telemetry Layers</span>
          </span>
          {isLayersOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {isLayersOpen && (
          <div className="mt-2 space-y-2 p-2.5 bg-black/40 rounded-xl border border-white/[0.06] text-xs text-slate-300 panel-transition">
            {/* Argo Floats */}
            <label className="flex items-center justify-between cursor-pointer hover:text-white group">
              <span className="text-[11px] group-hover:text-cyan-200 transition-colors flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Argo In-Situ Floats</span>
              </span>
              <input
                type="checkbox"
                checked={layers.argoSensors}
                onChange={() => toggleLayer('argoSensors')}
                className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
              />
            </label>

            {/* Coastlines */}
            <label className="flex items-center justify-between cursor-pointer hover:text-white group">
              <span className="text-[11px] group-hover:text-cyan-200 transition-colors">Natural Coastlines</span>
              <input
                type="checkbox"
                checked={layers.coastlines}
                onChange={() => toggleLayer('coastlines')}
                className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
              />
            </label>

            {/* Current Vectors */}
            <label className="flex items-center justify-between cursor-pointer hover:text-white group">
              <span className="text-[11px] group-hover:text-cyan-200 transition-colors">Surface Velocity Streamlines</span>
              <input
                type="checkbox"
                checked={layers.currentVectors}
                onChange={() => toggleLayer('currentVectors')}
                className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
              />
            </label>

            {/* Satellites */}
            <label className="flex items-center justify-between cursor-pointer hover:text-white group">
              <span className="text-[11px] group-hover:text-cyan-200 transition-colors">Observing Satellites</span>
              <input
                type="checkbox"
                checked={layers.satellites}
                onChange={() => toggleLayer('satellites')}
                className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
              />
            </label>

            {/* Graticule */}
            <label className="flex items-center justify-between cursor-pointer hover:text-white group">
              <span className="text-[11px] group-hover:text-cyan-200 transition-colors">Coordinate Graticule</span>
              <input
                type="checkbox"
                checked={layers.graticule}
                onChange={() => toggleLayer('graticule')}
                className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        )}
      </div>

      {/* ─── Collapsible: Regional Target Scenes ─── */}
      <div className="border-t border-white/[0.08] pt-2.5 mt-2.5">
        <button
          onClick={() => setIsScenesOpen(!isScenesOpen)}
          className="w-full flex items-center justify-between py-1 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium text-[11px] uppercase tracking-wider font-mono">Basin Targets</span>
          </span>
          {isScenesOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {isScenesOpen && (
          <div className="mt-2 space-y-1.5 p-1.5 bg-black/40 rounded-xl border border-white/[0.06] text-xs panel-transition">
            <button
              onClick={() => triggerCameraAction('fit_indian_ocean')}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 text-slate-300 hover:text-white transition-colors flex items-center justify-between group border border-transparent hover:border-cyan-500/30"
            >
              <span className="text-[11px]">Indian Ocean Basin</span>
              <span className="text-[9px] text-cyan-400 font-mono group-hover:text-cyan-300">OVERVIEW</span>
            </button>
            <button
              onClick={() => triggerCameraAction('arabian_sea')}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 text-slate-300 hover:text-white transition-colors flex items-center justify-between group border border-transparent hover:border-cyan-500/30"
            >
              <span className="text-[11px]">Arabian Sea Upwelling</span>
              <span className="text-[9px] text-cyan-400 font-mono group-hover:text-cyan-300">REGIONAL</span>
            </button>
            <button
              onClick={() => triggerCameraAction('bay_of_bengal')}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 text-slate-300 hover:text-white transition-colors flex items-center justify-between group border border-transparent hover:border-cyan-500/30"
            >
              <span className="text-[11px]">Bay of Bengal Stratification</span>
              <span className="text-[9px] text-cyan-400 font-mono group-hover:text-cyan-300">REGIONAL</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
