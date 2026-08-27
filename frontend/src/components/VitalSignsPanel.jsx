import React, { useState } from 'react';
import { Activity, X, ChevronRight, Waves, Thermometer, Droplets, Wind, Sparkles } from 'lucide-react';
import { useOceanStore, VITAL_SIGNS_CATALOG } from '../store/oceanStore';

export const VitalSignsPanel = () => {
  const {
    activeOverlay,
    toggleOverlay,
    activeVitalSign,
    selectVitalSign,
  } = useOceanStore();

  const [activeTab, setActiveTab] = useState('surface'); // 'surface' | 'subsurface' | 'dynamic'

  if (activeOverlay !== 'vitalSigns') return null;

  const currentList = VITAL_SIGNS_CATALOG[activeTab] || [];

  return (
    <aside className="absolute left-3 md:left-4 top-12 md:top-14 z-30 w-72 md:w-80 max-h-[calc(100vh-120px)] glass-panel rounded-xl text-white/90 select-none overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90">Ocean Vital Signs</span>
        </div>
        <button
          onClick={() => toggleOverlay('vitalSigns')}
          className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
          title="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-3 p-1 m-2 bg-black/40 rounded-lg border border-white/[0.04] text-[11px]">
        <button
          onClick={() => setActiveTab('surface')}
          className={`py-1 rounded-md text-center transition-all ${
            activeTab === 'surface'
              ? 'bg-white/15 text-white font-medium shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          Surface
        </button>
        <button
          onClick={() => setActiveTab('subsurface')}
          className={`py-1 rounded-md text-center transition-all ${
            activeTab === 'subsurface'
              ? 'bg-white/15 text-white font-medium shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          Subsurface
        </button>
        <button
          onClick={() => setActiveTab('dynamic')}
          className={`py-1 rounded-md text-center transition-all ${
            activeTab === 'dynamic'
              ? 'bg-white/15 text-white font-medium shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          Dynamic
        </button>
      </div>

      {/* Dataset Items List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 flex flex-col gap-1">
        {currentList.map((item) => {
          const isActive = activeVitalSign === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectVitalSign(item.id)}
              className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-white/15 border border-white/20 text-white shadow-sm'
                  : 'bg-black/20 hover:bg-white/5 border border-transparent text-white/70 hover:text-white/95'
              }`}
            >
              {/* Status indicator */}
              <div className="mt-1 shrink-0">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]' : 'bg-white/30'
                  }`}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-normal truncate text-white/90">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-mono text-white/40 shrink-0">
                    [{item.units}]
                  </span>
                </div>
                <p className="text-[10px] text-white/40 line-clamp-1 mt-0.5 font-light">
                  {item.description}
                </p>
              </div>

              <ChevronRight className={`w-3.5 h-3.5 self-center shrink-0 transition-opacity ${isActive ? 'text-white opacity-80' : 'opacity-20'}`} />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
