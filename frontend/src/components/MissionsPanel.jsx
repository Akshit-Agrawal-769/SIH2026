import React, { useState } from 'react';
import { Radio, X, ChevronRight, Satellite, Anchor, Ship, Navigation } from 'lucide-react';
import { useOceanStore, OBSERVING_MISSIONS } from '../store/oceanStore';

export const MissionsPanel = () => {
  const {
    activeOverlay,
    toggleOverlay,
    activeMissionId,
    selectMission,
    argoFloats,
    selectedFloat,
    selectFloat,
  } = useOceanStore();

  const [filterType, setFilterType] = useState('all'); // 'all' | 'satellite' | 'insitu'

  if (activeOverlay !== 'missions') return null;

  const filteredMissions = OBSERVING_MISSIONS.filter((m) => {
    if (filterType === 'satellite') return m.type === 'satellite';
    if (filterType === 'insitu') return m.type !== 'satellite';
    return true;
  });

  return (
    <aside className="absolute left-3 md:left-4 top-12 md:top-14 z-30 w-72 md:w-80 max-h-[calc(100vh-120px)] glass-panel rounded-xl text-white/90 select-none overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90">Observing Missions</span>
        </div>
        <button
          onClick={() => toggleOverlay('missions')}
          className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
          title="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 p-1 m-2 bg-black/40 rounded-lg border border-white/[0.04] text-[11px]">
        <button
          onClick={() => setFilterType('all')}
          className={`py-1 rounded-md text-center transition-all ${
            filterType === 'all'
              ? 'bg-white/15 text-white font-medium shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterType('satellite')}
          className={`py-1 rounded-md text-center transition-all ${
            filterType === 'satellite'
              ? 'bg-white/15 text-white font-medium shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          Satellites
        </button>
        <button
          onClick={() => setFilterType('insitu')}
          className={`py-1 rounded-md text-center transition-all ${
            filterType === 'insitu'
              ? 'bg-white/15 text-white font-medium shadow-sm'
              : 'text-white/50 hover:text-white/80'
          }`}
        >
          In-Situ
        </button>
      </div>

      {/* Mission Items List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 flex flex-col gap-1">
        {filteredMissions.map((item) => {
          const isActive = activeMissionId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectMission(item.id)}
              className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-white/15 border border-white/20 text-white shadow-sm'
                  : 'bg-black/20 hover:bg-white/5 border border-transparent text-white/70 hover:text-white/95'
              }`}
            >
              {/* Type Icon */}
              <div className="mt-0.5 p-1 rounded bg-white/5 text-white/60 shrink-0">
                {item.type === 'satellite' && <Satellite className="w-3.5 h-3.5" />}
                {item.type === 'insitu_network' && <Navigation className="w-3.5 h-3.5" />}
                {item.type === 'moored_buoys' && <Anchor className="w-3.5 h-3.5" />}
                {item.type === 'moored_station' && <Radio className="w-3.5 h-3.5" />}
                {item.type === 'research_vessel' && <Ship className="w-3.5 h-3.5" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-normal truncate text-white/90">
                    {item.name}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-white/50 shrink-0">
                    {item.agency.split('/')[0]}
                  </span>
                </div>
                <div className="text-[10px] text-white/40 font-mono mt-0.5">
                  {item.status} · {item.lat >= 0 ? `${item.lat.toFixed(1)}°N` : `${Math.abs(item.lat).toFixed(1)}°S`}, {item.lon.toFixed(1)}°E
                </div>
              </div>

              <ChevronRight className={`w-3.5 h-3.5 self-center shrink-0 transition-opacity ${isActive ? 'text-white opacity-80' : 'opacity-20'}`} />
            </button>
          );
        })}

        {/* In-Situ Argo Profilers Section Header */}
        {argoFloats && argoFloats.length > 0 && filterType !== 'satellite' && (
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between px-1 mb-1 text-[10px] text-white/40 font-mono uppercase">
              <span>Active Argo Floats ({argoFloats.length})</span>
              <span>Coriolis</span>
            </div>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
              {argoFloats.map((fl) => {
                const isFlSelected = selectedFloat?.platform_number === fl.platform_number;
                return (
                  <button
                    key={fl.platform_number}
                    onClick={() => selectFloat(fl)}
                    className={`flex items-center justify-between p-1.5 rounded text-left transition-all ${
                      isFlSelected
                        ? 'bg-white/15 border border-white/20 text-white font-normal'
                        : 'bg-black/20 hover:bg-white/5 text-white/60 hover:text-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className={`w-1 h-1 rounded-full ${isFlSelected ? 'bg-white' : 'bg-white/30'}`} />
                      <span>WMO {fl.platform_number}</span>
                    </div>
                    <span className="text-[9px] font-mono text-white/40 tabular-nums">
                      {fl.latest_position.latitude.toFixed(1)}°N, {fl.latest_position.longitude.toFixed(1)}°E
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
