import React from 'react';
import {
  Thermometer,
  Droplet,
  Wind,
  Activity,
  Layers,
  Sparkles,
  Sliders,
  RotateCcw
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ControlPanel = () => {
  const {
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
    isControlPanelOpen,
  } = useOceanStore();

  if (!isControlPanelOpen) return null;

  const variables = [
    { id: 'temp', label: 'Temperature', code: 'TEMP', icon: <Thermometer className="w-3.5 h-3.5" />, units: '°C' },
    { id: 'salt', label: 'Salinity', code: 'PSAL', icon: <Droplet className="w-3.5 h-3.5" />, units: 'PSU' },
    { id: 'u', label: 'Zonal Current', code: 'U-VEL', icon: <Wind className="w-3.5 h-3.5" />, units: 'm/s' },
    { id: 'v', label: 'Meridional Current', code: 'V-VEL', icon: <Wind className="w-3.5 h-3.5 rotate-90" />, units: 'm/s' },
    { id: 'chl', label: 'Chlorophyll-a', code: 'CHLA', icon: <Activity className="w-3.5 h-3.5" />, units: 'mg/m³' },
  ];

  const colormaps = [
    { id: 'turbo', label: 'Turbo', gradient: 'linear-gradient(to right, #30123b, #4184f3, #1ae4b6, #a2fc3c, #fb8022, #7a0403)' },
    { id: 'viridis', label: 'Viridis', gradient: 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)' },
    { id: 'thermal', label: 'Thermal', gradient: 'linear-gradient(to right, #0d2673, #19b2cc, #f2d933, #e6331a)' },
    { id: 'jet', label: 'Jet', gradient: 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000)' },
  ];

  const resetRenderDefaults = () => {
    setOpacity(1.2);
    setThreshold(0.05);
    setIsoValue(0.65);
    setVerticalExaggeration(1.0);
  };

  return (
    <aside className="absolute top-16 left-4 z-20 w-72 max-h-[calc(100vh-140px)] overflow-y-auto bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 text-slate-200 shadow-2xl flex flex-col gap-3.5 text-xs select-none custom-scrollbar">

      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold tracking-wide text-slate-100 text-[11px] uppercase">
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <span>Scientific Controls</span>
        </div>
        <button
          onClick={resetRenderDefaults}
          title="Reset Display Parameters"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-colors"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Variable Selector */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          <span>Physical / BGC Field</span>
          <span className="font-mono text-sky-400">
            {variables.find(v => v.id === variable)?.units || ''}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {variables.map((v) => {
            const isActive = variable === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'bg-sky-950/80 border-sky-500/70 text-sky-200 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800/80 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={isActive ? 'text-sky-400' : 'text-slate-400'}>{v.icon}</span>
                  <span className="font-medium text-xs">{v.label}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700/50">
                    {v.units}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 3D Render Mode */}
      <div>
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          3D Rendering Mode
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setRenderMode('volume')}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              renderMode === 'volume'
                ? 'bg-teal-950/80 border-teal-500/70 text-teal-200 shadow-sm'
                : 'bg-slate-900/70 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Volume Raymarch</span>
          </button>
          <button
            onClick={() => setRenderMode('iso')}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              renderMode === 'iso'
                ? 'bg-teal-950/80 border-teal-500/70 text-teal-200 shadow-sm'
                : 'bg-slate-900/70 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Iso-Surface (3D)</span>
          </button>
        </div>
      </div>

      {/* 3. Colormap Transfer Function */}
      <div>
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          Colormap Transfer Function
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {colormaps.map((cm) => {
            const isSelected = colormap === cm.id;
            return (
              <button
                key={cm.id}
                onClick={() => setColormap(cm.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-slate-800 border-sky-400 text-slate-100'
                    : 'bg-slate-900/70 border-slate-800/80 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <div
                  className="w-4 h-3 rounded shrink-0 border border-slate-700/60"
                  style={{ background: cm.gradient }}
                />
                <span className="font-medium text-[11px]">{cm.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Transfer Function Parameters & Sliders */}
      <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg flex flex-col gap-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Transfer Function & Shading
        </div>

        {renderMode === 'volume' ? (
          <>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Raymarch Opacity</span>
                <span className="font-mono text-sky-400 tabular-nums font-bold">
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
                className="w-full cursor-pointer accent-sky-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Scalar Filter Threshold</span>
                <span className="font-mono text-sky-400 tabular-nums font-bold">
                  {(threshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.4"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full cursor-pointer accent-sky-400"
              />
            </div>
          </>
        ) : (
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Iso-Surface Value</span>
              <span className="font-mono text-teal-400 tabular-nums font-bold">
                {(isoValue * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.02"
              value={isoValue}
              onChange={(e) => setIsoValue(Number(e.target.value))}
              className="w-full cursor-pointer accent-teal-400"
            />
          </div>
        )}

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Vertical Exaggeration</span>
            <span className="font-mono text-teal-300 tabular-nums font-bold">
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
            className="w-full cursor-pointer accent-teal-400"
          />
        </div>
      </div>

    </aside>
  );
};
