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
      case 'cyclone': return <Wind className="w-3.5 h-3.5 text-white/80" />;
      case 'heatwave': return <Flame className="w-3.5 h-3.5 text-white/80" />;
      case 'upwelling': return <Droplet className="w-3.5 h-3.5 text-white/80" />;
      case 'eddy': return <Disc className="w-3.5 h-3.5 text-white/80" />;
      case 'bloom': return <Eye className="w-3.5 h-3.5 text-white/80" />;
      default: return <AlertTriangle className="w-3.5 h-3.5 text-white/80" />;
    }
  };

  return (
    <aside className="absolute left-3 md:left-4 top-12 md:top-14 z-30 w-72 md:w-80 max-h-[calc(100vh-120px)] glass-panel rounded-xl text-white/90 select-none overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90">Extreme Ocean Events</span>
        </div>
        <button
          onClick={() => toggleOverlay('events')}
          className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
          title="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-1.5 bg-black/30 border-b border-white/[0.04] text-[10px] text-white/50 font-light flex items-center justify-between">
        <span>Active & Historic Phenomena</span>
        <span className="font-mono text-white/70">{OCEAN_EVENTS.length} Events</span>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1.5">
        {OCEAN_EVENTS.map((item) => {
          const isActive = activeEventId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectOceanEvent(item.id)}
              className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-white/15 border border-white/20 text-white shadow-sm'
                  : 'bg-black/20 hover:bg-white/5 border border-transparent text-white/70 hover:text-white/95'
              }`}
            >
              {/* Event Icon */}
              <div className="mt-0.5 p-1.5 rounded-md bg-white/5 shrink-0">
                {getEventIcon(item.type)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-normal truncate text-white/90">
                    {item.name}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-white/50 shrink-0 font-mono">
                    {item.status.split(' ')[0]}
                  </span>
                </div>
                <div className="text-[10px] text-white/50 font-light mt-0.5">
                  {item.category} · {item.basin}
                </div>
                <div className="text-[10px] font-mono text-white/70 mt-1 flex items-center justify-between">
                  <span>{item.maxWinds || item.anomaly || item.sstDepression || item.chlPeak}</span>
                  <span className="text-white/40">{item.lat.toFixed(1)}°N, {item.lon.toFixed(1)}°E</span>
                </div>
              </div>

              <ChevronRight className={`w-3.5 h-3.5 self-center shrink-0 transition-opacity ${isActive ? 'text-white opacity-80' : 'opacity-20'}`} />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
