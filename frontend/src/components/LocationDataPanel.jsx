import React, { useState } from 'react';
import { Layers, MapPin, ChevronDown, ChevronUp, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useOceanStore, VITAL_SIGNS_CATALOG } from '../store/oceanStore';

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

  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isScenesOpen, setIsScenesOpen] = useState(false);

  // Format dynamic coordinates
  const lat = cursorCoords?.lat ?? 10.0;
  const lon = cursorCoords?.lon ?? 75.0;
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

  const availableVariables = [
    { id: 'temp', label: 'Sea Surface Temperature (SST)' },
    { id: 'salt', label: 'Sea Surface Salinity (SSS)' },
    { id: 'chl', label: 'Chlorophyll-a (CHLA)' },
    { id: 'currents', label: 'Surface Currents (CURR)' },
    { id: 'waves', label: 'Significant Wave Height (SWH)' },
  ];

  return (
    <div className="absolute top-20 left-6 z-30 w-80 bg-[rgba(6,12,24,0.82)] backdrop-blur-xl rounded-2xl border border-sky-500/20 shadow-2xl p-5 text-white select-none transition-all">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
          Location &amp; Data
        </h2>
      </div>

      {/* Lat/Lon Coordinates */}
      <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-white/[0.08]">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            LATITUDE
          </span>
          <span className="font-mono text-xs font-bold text-white tracking-wide">
            {latStr}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            LONGITUDE
          </span>
          <span className="font-mono text-xs font-bold text-white tracking-wide">
            {lonStr}
          </span>
        </div>
      </div>

      {/* FIELD Selector */}
      <div className="mb-4">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
          FIELD
        </label>
        <div className="relative">
          <select
            value={variable}
            onChange={(e) => selectVitalSign(e.target.value)}
            className="w-full bg-[#0a1526]/90 border border-sky-500/30 rounded-xl px-3.5 py-2 text-xs font-medium text-white appearance-none cursor-pointer hover:border-sky-400/60 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all pr-8 shadow-inner"
          >
            {availableVariables.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#0b1424] text-white">
                {v.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* DEPTH Selector */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            DEPTH
          </span>
          <span className="font-mono text-xs font-medium text-sky-300">
            {depthLevelMeters} m {depthLevelMeters === 0 ? '(Surface)' : ''}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2000"
          step="10"
          value={depthLevelMeters}
          onChange={(e) => setDepthLevelMeters(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 hover:accent-sky-300 transition-all"
        />
        <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
          <span>0m (Surface)</span>
          <span>1000m</span>
          <span>2000m</span>
        </div>
      </div>

      {/* Collapsible: Data Layers */}
      <div className="border-t border-white/[0.08] pt-3">
        <button
          onClick={() => setIsLayersOpen(!isLayersOpen)}
          className="w-full flex items-center justify-between py-1.5 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-medium">Data Layers</span>
          </span>
          {isLayersOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {isLayersOpen && (
          <div className="mt-2 space-y-1.5 pl-5 pr-1 py-1 text-xs text-slate-300 bg-black/20 rounded-lg p-2">
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Argo In-Situ Floats</span>
              <input
                type="checkbox"
                checked={layers.argoSensors}
                onChange={() => toggleLayer('argoSensors')}
                className="rounded accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Coastlines &amp; Borders</span>
              <input
                type="checkbox"
                checked={layers.coastlines}
                onChange={() => toggleLayer('coastlines')}
                className="rounded accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Surface Velocity Vectors</span>
              <input
                type="checkbox"
                checked={layers.currentVectors}
                onChange={() => toggleLayer('currentVectors')}
                className="rounded accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Observing Satellites</span>
              <input
                type="checkbox"
                checked={layers.satellites}
                onChange={() => toggleLayer('satellites')}
                className="rounded accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Coordinate Graticule</span>
              <input
                type="checkbox"
                checked={layers.graticule}
                onChange={() => toggleLayer('graticule')}
                className="rounded accent-sky-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* Collapsible: Scenes */}
      <div className="border-t border-white/[0.08] pt-2.5 mt-2.5">
        <button
          onClick={() => setIsScenesOpen(!isScenesOpen)}
          className="w-full flex items-center justify-between py-1.5 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-medium">Scenes</span>
          </span>
          {isScenesOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {isScenesOpen && (
          <div className="mt-2 space-y-1.5 pl-2 pr-1 py-1 text-xs bg-black/20 rounded-lg p-2">
            <button
              onClick={() => triggerCameraAction('fit_indian_ocean')}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-sky-500/20 text-slate-300 hover:text-white transition-colors flex items-center justify-between"
            >
              <span>Indian Ocean Basin</span>
              <span className="text-[10px] text-sky-400 font-mono">Overview</span>
            </button>
            <button
              onClick={() => triggerCameraAction('arabian_sea')}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-sky-500/20 text-slate-300 hover:text-white transition-colors flex items-center justify-between"
            >
              <span>Arabian Sea Upwelling</span>
              <span className="text-[10px] text-sky-400 font-mono">Regional</span>
            </button>
            <button
              onClick={() => triggerCameraAction('bay_of_bengal')}
              className="w-full text-left px-2.5 py-1.5 rounded hover:bg-sky-500/20 text-slate-300 hover:text-white transition-colors flex items-center justify-between"
            >
              <span>Bay of Bengal Stratification</span>
              <span className="text-[10px] text-sky-400 font-mono">Regional</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
