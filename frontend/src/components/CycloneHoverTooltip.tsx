import React from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { Wind, Calendar, AlertOctagon, MapPin } from 'lucide-react';

export const CycloneHoverTooltip: React.FC = () => {
  const hoveredCyclone = useOceanStore((s) => s.hoveredCyclone);

  if (!hoveredCyclone) return null;

  const { name, location, lat, lon, date, intensity, screenX, screenY, sid, source, landfall_time } = hoveredCyclone;

  // Position slightly offset from cursor, avoiding viewport overflow
  const tooltipWidth = 250;
  const tooltipHeight = 150;
  const tooltipLeft = Math.min(window.innerWidth - tooltipWidth - 16, Math.max(16, screenX + 16));
  const tooltipTop = Math.min(window.innerHeight - tooltipHeight - 16, Math.max(16, screenY + 16));

  return (
    <div
      className="fixed pointer-events-none z-50 glass-panel rounded-2xl p-3.5 shadow-2xl min-w-[240px] max-w-[300px] border border-amber-400/30 flex flex-col gap-2 transition-all duration-75 select-none"
      style={{ left: tooltipLeft, top: tooltipTop }}
      data-testid="cyclone-tooltip"
    >
      {/* Category / Icon Badge & Name */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
            <Wind className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              Historical Cyclone
            </div>
            <h4 className="text-xs font-bold text-white leading-tight">
              {name}
            </h4>
          </div>
        </div>
      </div>

      {/* Date & Location */}
      <div className="pt-1.5 border-t border-white/10 flex flex-col gap-1 text-[10.5px]">
        <div className="flex items-center gap-1.5 text-neutral-300">
          <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="font-mono text-neutral-200">{landfall_time ? `${landfall_time.replace('T', ' ')} landfall` : date}</span>
        </div>

        <div className="flex items-center gap-1.5 text-neutral-300">
          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
          {location && <span className="text-neutral-200">{location}</span>}
          <span className="text-[9.5px] font-mono text-neutral-400">
            ({lat.toFixed(2)}°N, {lon.toFixed(2)}°E)
          </span>
        </div>
      </div>

      {/* Intensity Badge */}
      <div className="pt-1.5 border-t border-white/10 flex items-start gap-1.5">
        <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
            Intensity
          </span>
          <span className="text-[11px] font-bold text-amber-300 font-mono leading-snug">
            {intensity}
          </span>
        </div>
      </div>
      {source && (
        <div className="pt-1 border-t border-white/10 text-[9px] font-mono text-neutral-400 leading-snug">
          {source}{sid ? ` · SID ${sid}` : ''}
        </div>
      )}
    </div>
  );
};
