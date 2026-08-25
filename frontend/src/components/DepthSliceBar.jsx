import React from 'react';
import { Layers } from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const DepthSliceBar = () => {
  const {
    enableSlice,
    setEnableSlice,
    sliceDepthMeters,
    setSliceDepthMeters,
  } = useOceanStore();

  const depthPresets = [
    { label: '0m (SURF)', depth: 0 },
    { label: '100m (THERM)', depth: 100 },
    { label: '500m (INT)', depth: 500 },
    { label: '1000m (DEEP)', depth: 1000 },
    { label: '2000m (ABYSS)', depth: 2000 },
  ];

  const getOceanZone = (d) => {
    if (d <= 200) return 'Epipelagic (0—200m)';
    if (d <= 1000) return 'Mesopelagic (200—1000m)';
    return 'Bathypelagic (>1000m)';
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 px-3 py-1.5 bg-[#070c18] border-t border-[#1e293b] text-slate-200 text-xs select-none">

      {/* Slice Enable Toggle */}
      <div className="flex items-center gap-2 border-b sm:border-b-0 sm:border-r border-[#1e293b] pb-1 sm:pb-0 sm:pr-2.5 shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer font-mono font-bold text-[11px] text-slate-200">
          <input
            type="checkbox"
            checked={enableSlice}
            onChange={(e) => setEnableSlice(e.target.checked)}
            className="w-3.5 h-3.5 accent-sky-400 bg-[#0c1424] border-[#1e293b] cursor-pointer"
          />
          <Layers className="w-3 h-3 text-sky-400" />
          <span>DEPTH SLICE (z)</span>
        </label>
      </div>

      {/* Slider & Numeric Readout */}
      <div className={`flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 transition-opacity ${enableSlice ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
          <span className="text-slate-400 text-[11px]">z:</span>
          <span className="font-bold text-sky-300 tabular-nums px-1.5 py-0.2 bg-[#0c1424] border border-[#1e293b]">
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
            className="w-full cursor-pointer"
          />
          <span className="font-mono text-[10px] text-slate-500">2000m</span>
        </div>

        {/* Ocean Bathymetric Zone */}
        <div className="hidden lg:flex items-center px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] text-[10px] font-mono text-teal-300 shrink-0">
          <span>{getOceanZone(sliceDepthMeters)}</span>
        </div>

        {/* Quick Depth Presets */}
        <div className="hidden md:flex items-center gap-1 shrink-0 font-mono">
          {depthPresets.map((p) => (
            <button
              key={p.depth}
              onClick={() => {
                setEnableSlice(true);
                setSliceDepthMeters(p.depth);
              }}
              className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
                enableSlice && sliceDepthMeters === p.depth
                  ? 'bg-[#0f243a] border-sky-400 text-sky-200 font-bold'
                  : 'bg-[#0c1424] border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-700'
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
