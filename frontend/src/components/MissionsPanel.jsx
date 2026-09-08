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
    <aside className="absolute left-6 top-20 z-30 w-80 max-h-[calc(100vh-140px)] bg-[rgba(4,10,24,0.88)] backdrop-blur-2xl rounded-2xl border border-sky-500/25 shadow-panel-dark text-white select-none overflow-hidden flex flex-col animate-fade-slide">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-black/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 pulse-beacon" />
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-white uppercase">
              OBSERVING MISSIONS
            </h2>
            <span className="text-[9px] text-slate-400 block -mt-0.5">
              SATELLITE ORBITS &amp; IN-SITU NETWORKS
            </span>
          </div>
        </div>
        <button
          onClick={() => toggleOverlay('missions')}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="grid grid-cols-3 p-1 m-3 bg-black/40 rounded-xl border border-white/[0.06] text-[11px] font-mono">
        <button
          onClick={() => setFilterType('all')}
          className={`py-1 rounded-lg text-center transition-all ${
            filterType === 'all'
              ? 'bg-sky-500/25 text-sky-200 font-semibold border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ALL
        </button>
        <button
          onClick={() => setFilterType('satellite')}
          className={`py-1 rounded-lg text-center transition-all ${
            filterType === 'satellite'
              ? 'bg-sky-500/25 text-sky-200 font-semibold border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          SATELLITES
        </button>
        <button
          onClick={() => setFilterType('insitu')}
          className={`py-1 rounded-lg text-center transition-all ${
            filterType === 'insitu'
              ? 'bg-sky-500/25 text-sky-200 font-semibold border border-sky-400/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          IN-SITU
        </button>
      </div>

      {/* ─── Mission Items List ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 flex flex-col gap-1.5">
        {filteredMissions.map((item) => {
          const isActive = activeMissionId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectMission(item.id)}
              className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-sky-500/20 border border-sky-400/50 text-white shadow-glow-cyan-sm'
                  : 'bg-black/30 hover:bg-sky-500/10 border border-white/[0.05] hover:border-sky-500/30 text-slate-300 hover:text-white'
              }`}
            >
              {/* Type Icon */}
              <div className="mt-0.5 p-1.5 rounded-lg bg-black/40 text-sky-400 border border-sky-500/20 shrink-0">
                {item.type === 'satellite' && <Satellite className="w-3.5 h-3.5" />}
                {item.type === 'insitu_network' && <Navigation className="w-3.5 h-3.5" />}
                {item.type === 'moored_buoys' && <Anchor className="w-3.5 h-3.5" />}
                {item.type === 'moored_station' && <Radio className="w-3.5 h-3.5" />}
                {item.type === 'research_vessel' && <Ship className="w-3.5 h-3.5" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold truncate text-white">
                    {item.name}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-400/30 shrink-0">
                    {item.agency.split('/')[0]}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 tabular-nums">
                  {item.status} · {item.lat >= 0 ? `${item.lat.toFixed(1)}°N` : `${Math.abs(item.lat).toFixed(1)}°S`}, {item.lon.toFixed(1)}°E
                </div>
              </div>

              <ChevronRight className={`w-3.5 h-3.5 self-center shrink-0 transition-opacity ${isActive ? 'text-sky-300 opacity-100' : 'opacity-30'}`} />
            </button>
          );
        })}

        {/* In-Situ Argo Profilers Section */}
        {argoFloats && argoFloats.length > 0 && filterType !== 'satellite' && (
          <div className="mt-2 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] text-slate-400 font-mono uppercase">
              <span>Active Argo Floats ({argoFloats.length})</span>
              <span className="text-sky-400 font-semibold">CORIOLIS / INCOIS</span>
            </div>
            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto custom-scrollbar">
              {argoFloats.map((fl) => {
                const isFlSelected = selectedFloat?.platform_number === fl.platform_number;
                return (
                  <button
                    key={fl.platform_number}
                    onClick={() => selectFloat(fl)}
                    className={`flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                      isFlSelected
                        ? 'bg-sky-500/20 border border-sky-400/50 text-white font-medium shadow-sm'
                        : 'bg-black/30 hover:bg-sky-500/10 border border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${isFlSelected ? 'bg-sky-400 pulse-beacon' : 'bg-slate-500'}`} />
                      <span>WMO {fl.platform_number}</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 tabular-nums">
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
