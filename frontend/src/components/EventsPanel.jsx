import React from 'react';
import { Zap, X, ChevronRight, AlertTriangle, Wind, Flame, Eye, Droplet, Disc } from 'lucide-react';
import { useOceanStore, OCEAN_EVENTS } from '../store/oceanStore';

export const EventsPanel = () => {
  const {
    activeOverlay,
    toggleOverlay,
    activeEventId,
    selectOceanEvent,
  } = useOceanStore();

  if (activeOverlay !== 'events') return null;

  const getEventIcon = (type) => {
    switch (type) {
      case 'cyclone': return <Wind className="w-4 h-4 text-sky-400" />;
      case 'heatwave': return <Flame className="w-4 h-4 text-amber-400" />;
      case 'upwelling': return <Droplet className="w-4 h-4 text-cyan-400" />;
      case 'eddy': return <Disc className="w-4 h-4 text-purple-400" />;
      case 'bloom': return <Eye className="w-4 h-4 text-emerald-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <aside className="absolute left-6 top-20 z-30 w-80 max-h-[calc(100vh-140px)] bg-[rgba(4,10,24,0.88)] backdrop-blur-2xl rounded-2xl border border-sky-500/25 shadow-panel-dark text-white select-none overflow-hidden flex flex-col animate-fade-slide">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-black/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 pulse-beacon" />
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-white uppercase">
              EXTREME OCEAN PHENOMENA
            </h2>
            <span className="text-[9px] text-slate-400 block -mt-0.5">
              CYCLONES, ANOMALIES &amp; UPWELLING
            </span>
          </div>
        </div>
        <button
          onClick={() => toggleOverlay('events')}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3.5 py-2 bg-black/40 border-b border-white/[0.04] text-[10px] text-slate-400 font-mono flex items-center justify-between">
        <span>ACTIVE &amp; BENCHMARK EVENTS</span>
        <span className="text-sky-300 font-semibold">{OCEAN_EVENTS.length} IDENTIFIED</span>
      </div>

      {/* ─── Events List ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-1.5">
        {OCEAN_EVENTS.map((item) => {
          const isActive = activeEventId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectOceanEvent(item.id)}
              className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-sky-500/20 border border-sky-400/50 text-white shadow-glow-cyan-sm'
                  : 'bg-black/30 hover:bg-sky-500/10 border border-white/[0.05] hover:border-sky-500/30 text-slate-300 hover:text-white'
              }`}
            >
              {/* Event Icon */}
              <div className="mt-0.5 p-1.5 rounded-lg bg-black/40 border border-white/[0.08] shrink-0">
                {getEventIcon(item.type)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold truncate text-white">
                    {item.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-400/30 text-amber-300 shrink-0 font-mono">
                    {item.status.split(' ')[0]}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                  {item.category} · {item.basin}
                </div>
                <div className="text-[10px] font-mono text-sky-200 mt-1 flex items-center justify-between tabular-nums">
                  <span className="font-semibold">{item.maxWinds || item.anomaly || item.sstDepression || item.chlPeak}</span>
                  <span className="text-slate-400">{item.lat.toFixed(1)}°N, {item.lon.toFixed(1)}°E</span>
                </div>
              </div>

              <ChevronRight className={`w-3.5 h-3.5 self-center shrink-0 transition-opacity ${isActive ? 'text-sky-300 opacity-100' : 'opacity-30'}`} />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
