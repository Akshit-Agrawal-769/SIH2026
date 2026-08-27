import React from 'react';
import { Sliders, X, Layers, ChevronDown } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const DepthNavigator = () => {
  const {
    activeOverlay,
    toggleOverlay,
    depthLevelMeters,
    setDepthLevelMeters,
    enableSlice,
    setEnableSlice,
  } = useOceanStore();

  const depthLevels = [
    { depth: 0, label: 'Surface', zone: 'Epipelagic (Sunlit)', tempFactor: 1.0, salFactor: 1.0 },
    { depth: 50, label: '50 m', zone: 'Upper Mixed Layer', tempFactor: 0.96, salFactor: 1.01 },
    { depth: 100, label: '100 m', zone: 'Main Thermocline', tempFactor: 0.82, salFactor: 1.02 },
    { depth: 250, label: '250 m', zone: 'Intermediate Thermocline', tempFactor: 0.65, salFactor: 1.01 },
    { depth: 500, label: '500 m', zone: 'Oxygen Minimum Zone', tempFactor: 0.45, salFactor: 0.99 },
    { depth: 1000, label: '1000 m', zone: 'Mesopelagic (Twilight)', tempFactor: 0.28, salFactor: 0.98 },
    { depth: 2000, label: '2000 m', zone: 'Bathypelagic (Midnight)', tempFactor: 0.12, salFactor: 0.97 },
    { depth: 3000, label: 'Deep Ocean', zone: 'Abyssal Plain (>3000m)', tempFactor: 0.05, salFactor: 0.96 },
  ];

  if (activeOverlay !== 'depth') return null;

  const currentLevel = depthLevels.find((d) => d.depth === depthLevelMeters) || depthLevels[0];

  return (
    <aside className="absolute left-3 md:left-4 top-12 md:top-14 z-30 w-72 md:w-80 max-h-[calc(100vh-120px)] glass-panel rounded-xl text-white/90 select-none overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90">Depth Exploration</span>
        </div>
        <button
          onClick={() => toggleOverlay('depth')}
          className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
          title="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Active Depth Status Callout */}
      <div className="p-3 bg-black/30 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="text-[10px] text-white/40 font-mono uppercase tracking-wide">
            CURRENT DEPTH
          </div>
          <div className="text-base font-normal text-white">
            {currentLevel.label} <span className="text-xs text-white/40 font-mono">({depthLevelMeters} m)</span>
          </div>
          <div className="text-[10px] text-white/50 font-light mt-0.5">
            {currentLevel.zone}
          </div>
        </div>

        <button
          onClick={() => setDepthLevelMeters(0)}
          className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-mono transition-colors"
          title="Reset to Surface"
        >
          Surface
        </button>
      </div>

      {/* Depth Slider */}
      <div className="px-4 py-3 bg-black/20 border-b border-white/[0.04] flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
          <span>0 m</span>
          <span>1000 m</span>
          <span>3000 m</span>
        </div>
        <input
          type="range"
          min="0"
          max="3000"
          step="50"
          value={depthLevelMeters}
          onChange={(e) => setDepthLevelMeters(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
      </div>

      {/* Depth Stepper Nodes */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
        {depthLevels.map((lvl) => {
          const isSelected = depthLevelMeters === lvl.depth;
          return (
            <button
              key={lvl.depth}
              onClick={() => setDepthLevelMeters(lvl.depth)}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'bg-white/15 border border-white/20 text-white font-medium shadow-sm'
                  : 'bg-black/20 hover:bg-white/5 border border-transparent text-white/60 hover:text-white/90'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]' : 'bg-white/20'
                  }`}
                />
                <span className="text-xs font-normal text-white/90">{lvl.label}</span>
              </div>
              <span className="text-[10px] text-white/40 font-mono">
                {lvl.zone.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
