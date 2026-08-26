import React from 'react';
import {
  RotateCcw,
  Sliders,
  Layers,
  Activity,
  Compass,
  Radio,
  Box,
  Globe,
  Waves
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ControlPanel = () => {
  const {
    viewMode,
    setViewMode,
    variable,
    setVariable,
    renderMode,
    setRenderMode,
    colormap,
    setColormap,
    opacity,
    setOpacity,
    threshold,
    setThreshold,
    isoValue,
    setIsoValue,
    verticalExaggeration,
    setVerticalExaggeration,
    layers,
    toggleLayer,
    metadata,
    isControlPanelOpen,
  } = useOceanStore();

  if (!isControlPanelOpen) return null;

  const variables = metadata?.variables && metadata.variables.length > 0
    ? metadata.variables.map((v) => {
        const vinfo = metadata.variable_info?.[v];
        return {
          id: v,
          label: vinfo?.long_name || v.toUpperCase(),
          code: (vinfo?.raw_name || v).toUpperCase().slice(0, 8),
          units: vinfo?.units || '',
        };
      })
    : [
        { id: 'temp', label: 'Potential Temperature', code: 'TEMP', units: '°C' },
        { id: 'salt', label: 'Practical Salinity', code: 'PSAL', units: 'PSU' },
        { id: 'u', label: 'Zonal Velocity', code: 'U-VEL', units: 'm/s' },
        { id: 'v', label: 'Meridional Velocity', code: 'V-VEL', units: 'm/s' },
        { id: 'chl', label: 'Chlorophyll-a', code: 'CHLA', units: 'mg/m³' },
      ];

  const colormaps = [
    { id: 'turbo', label: 'Turbo', gradient: 'linear-gradient(to right, #30123b, #4184f3, #1ae4b6, #a2fc3c, #fb8022, #7a0403)' },
    { id: 'viridis', label: 'Viridis', gradient: 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)' },
    { id: 'thermal', label: 'Thermal', gradient: 'linear-gradient(to right, #0d2673, #19b2cc, #f2d933, #e6331a)' },
    { id: 'jet', label: 'Jet', gradient: 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000)' },
  ];

  const globeLayerItems = [
    { id: 'earthGlobe', label: '3D Earth Globe Sphere', icon: '🌍', color: 'text-cyan-300' },
    { id: 'coastlines', label: 'Natural Earth 10m Coastlines', icon: '🌐', color: 'text-sky-300' },
    { id: 'land', label: 'Continental Landmasses', icon: '🗺️', color: 'text-emerald-400' },
    { id: 'countryBorders', label: 'Country Political Borders', icon: '🏳️', color: 'text-slate-300' },
    { id: 'graticule', label: 'Lat / Lon Spherical Grid', icon: '📐', color: 'text-indigo-300' },
    { id: 'modelCoverage', label: 'INCOIS Model Footprint & Data', icon: '📊', color: 'text-cyan-400' },
    { id: 'argoSensors', label: 'In-Situ Argo Profiler Network', icon: '📍', color: 'text-amber-300' },
    { id: 'atmosphere', label: 'Atmospheric Scattering Rim', icon: '✨', color: 'text-sky-200' },
  ];

  const resetRenderDefaults = () => {
    setOpacity(1.2);
    setThreshold(0.05);
    setIsoValue(0.65);
    setVerticalExaggeration(1.0);
  };

  return (
    <aside className="w-64 h-full bg-[#080e1a] border-r border-[#1e293b] p-3 text-slate-200 flex flex-col gap-3 text-xs select-none overflow-y-auto custom-scrollbar shrink-0">

      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-slate-100 text-[11px] uppercase font-mono">
          <Sliders className="w-3 h-3 text-cyan-400" />
          <span>Scientific Controls</span>
        </div>
        <button
          onClick={resetRenderDefaults}
          title="Reset Display Parameters to Defaults"
          className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] text-[10px] font-mono text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-colors"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>RESET</span>
        </button>
      </div>

      {/* 1. View Mode Switcher */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
          EXPLORATION MODE
        </span>
        <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
          <button
            onClick={() => setViewMode('globe')}
            className={`px-2 py-1.5 border text-center transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'globe'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                : 'bg-[#0b1322] border-[#1e293b] text-slate-400 hover:bg-[#131f33] hover:text-slate-200'
            }`}
          >
            <span>🌍</span>
            <span>3D Earth</span>
          </button>
          <button
            onClick={() => setViewMode('ocean3d')}
            className={`px-2 py-1.5 border text-center transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'ocean3d'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                : 'bg-[#0b1322] border-[#1e293b] text-slate-400 hover:bg-[#131f33] hover:text-slate-200'
            }`}
          >
            <span>🧊</span>
            <span>Ocean 3D</span>
          </button>
        </div>
      </div>

      {/* 2. Planetary & Geospatial Layers Stack */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>PLANETARY LAYERS</span>
          </div>
          <span className="text-cyan-400 font-bold tabular-nums">
            {Object.values(layers).filter(Boolean).length}/8
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          {globeLayerItems.map((item) => {
            const isEnabled = !!layers[item.id];
            return (
              <button
                key={item.id}
                onClick={() => toggleLayer(item.id)}
                className={`flex items-center justify-between px-2 py-1 text-left border transition-all ${
                  isEnabled
                    ? 'bg-[#0f1f33] border-cyan-500/70 text-slate-100'
                    : 'bg-[#0b1322] border-[#1e293b] text-slate-500 hover:bg-[#131f33] hover:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px]">{item.icon}</span>
                  <span className={`text-[10px] font-mono truncate ${isEnabled ? item.color : 'text-slate-500'}`}>
                    {item.label}
                  </span>
                </div>
                <span className={`text-[9px] font-mono font-bold px-1 py-0.2 border shrink-0 ${
                  isEnabled
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                    : 'bg-[#070c18] border-[#1e293b] text-slate-600'
                }`}>
                  {isEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Scientific Variable Selector */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
          <span>SCIENTIFIC VARIABLE</span>
          <span className="text-cyan-400">
            {variables.find(v => v.id === variable)?.units || ''}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {variables.map((v) => {
            const isActive = variable === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                className={`flex items-center justify-between px-2 py-1 text-left border transition-all ${
                  isActive
                    ? 'bg-[#10243e] border-cyan-500 text-cyan-200'
                    : 'bg-[#0b1322] border-[#1e293b] text-slate-300 hover:bg-[#131f33] hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-[11px] text-cyan-400 w-12">{v.code}</span>
                  <span className="text-[11px] text-slate-300">{v.label}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {v.units}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Colormap Selector */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
          SCIENTIFIC COLORMAP
        </span>
        <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
          {colormaps.map((cm) => {
            const isSelected = colormap === cm.id;
            return (
              <button
                key={cm.id}
                onClick={() => setColormap(cm.id)}
                className={`flex items-center gap-1.5 px-2 py-1 border transition-all ${
                  isSelected
                    ? 'bg-[#14233c] border-cyan-400 text-slate-100 font-bold'
                    : 'bg-[#0b1322] border-[#1e293b] text-slate-400 hover:bg-[#131f33] hover:text-slate-200'
                }`}
              >
                <div
                  className="w-3.5 h-2.5 shrink-0 border border-[#1e293b]"
                  style={{ background: cm.gradient }}
                />
                <span className="text-[10px]">{cm.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. 3D Ocean Shading Parameters (Active when in ocean3d mode) */}
      {viewMode === 'ocean3d' && (
        <div className="p-2 bg-[#0b1322] border border-[#1e293b] flex flex-col gap-2">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-[#1e293b] pb-1">
            VOLUME SHADING
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
              <span>RAYMARCH EXTINCTION</span>
              <span className="text-cyan-300 tabular-nums font-bold">
                {opacity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
              <span>VERTICAL EXAGGERATION</span>
              <span className="text-teal-300 tabular-nums font-bold">
                {verticalExaggeration.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={verticalExaggeration}
              onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>
        </div>
      )}

    </aside>
  );
};
