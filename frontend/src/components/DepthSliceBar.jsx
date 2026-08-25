import React from 'react';
import { Layers, Crosshair } from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const DepthSliceBar = () => {
  const {
    enableSlice,
    setEnableSlice,
    sliceDepthMeters,
    setSliceDepthMeters,
  } = useOceanStore();

  const depthPresets = [
    { label: 'Surface', depth: 0 },
    { label: 'Thermocline', depth: 100 },
    { label: 'Intermediate', depth: 500 },
    { label: 'Deep Layer', depth: 1000 },
    { label: 'Abyssal', depth: 2000 },
  ];

  const getOceanZone = (d) => {
    if (d <= 200) return 'Epipelagic (Sunlight Zone)';
    if (d <= 1000) return 'Mesopelagic (Twilight Zone)';
    return 'Bathypelagic (Midnight Zone)';
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-3.5 py-2 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 text-slate-200 text-xs select-none shadow-lg">

      {/* Slice Enable Toggle */}
      <div className="flex items-center gap-2 border-b sm:border-b-0 sm:border-r border-slate-800 pb-2 sm:pb-0 sm:pr-3 shrink-0">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableSlice}
            onChange={(e) => setEnableSlice(e.target.checked)}
            className="w-4 h-4 rounded accent-sky-400 bg-slate-900 border-slate-700 cursor-pointer"
          />
          <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>2D Depth Slicing Plane</span>
          </span>
        </label>
      </div>

      {/* Slider & Numeric Readout */}
      <div className={`flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 transition-opacity ${enableSlice ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400">Depth:</span>
          <span className="font-mono text-sm font-bold text-sky-300 tabular-nums px-2 py-0.5 bg-slate-900 border border-slate-800 rounded">
            {sliceDepthMeters} m
          </span>
        </div>

        <div className="flex-1 flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-500">0m</span>
          <input
            type="range"
            min="0"
            max="2000"
            step="10"
            value={sliceDepthMeters}
            onChange={(e) => setSliceDepthMeters(Number(e.target.value))}
            className="w-full cursor-pointer accent-sky-400"
          />
          <span className="font-mono text-[10px] text-slate-500">2000m</span>
        </div>

        {/* Ocean Bathymetric Zone */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/80 border border-slate-800 rounded text-[10px] font-mono text-teal-300 shrink-0">
          <span>{getOceanZone(sliceDepthMeters)}</span>
        </div>

        {/* Quick Depth Presets */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {depthPresets.map((p) => (
            <button
              key={p.depth}
              onClick={() => {
                setEnableSlice(true);
                setSliceDepthMeters(p.depth);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                enableSlice && sliceDepthMeters === p.depth
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
