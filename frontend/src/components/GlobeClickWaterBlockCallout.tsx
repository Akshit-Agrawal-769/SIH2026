import React from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { Box, X, MapPin } from 'lucide-react';

export const GlobeClickWaterBlockCallout: React.FC = () => {
  const { clickedGlobePoint, setClickedGlobePoint, openWaterBlock } = useOceanStore();

  if (!clickedGlobePoint) return null;

  const { lon, lat, screenX, screenY, basin } = clickedGlobePoint;

  const handleOpen3DBlock = () => {
    openWaterBlock({
      lon,
      lat,
      name: basin || `Ocean Location (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E)`
    });
  };

  return (
    <div
      style={{
        left: `${Math.min(window.innerWidth - 280, Math.max(20, screenX - 130))}px`,
        top: `${Math.max(70, screenY - 110)}px`
      }}
      className="fixed z-40 w-64 glass-panel rounded-2xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-white tracking-wide">
            {basin || 'Ocean Water Column'}
          </span>
        </div>
        <button
          onClick={() => setClickedGlobePoint(null)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-slate-300">
        <span>{lat.toFixed(2)}°N, {lon.toFixed(2)}°E</span>
        <span className="text-emerald-400">•</span>
        <span className="text-slate-400">0–2000m Depth</span>
      </div>

      <button
        onClick={handleOpen3DBlock}
        className="mt-2.5 w-full py-2 px-2.5 glass-pill text-emerald-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition active:scale-[0.98]"
      >
        <Box className="w-3.5 h-3.5 text-emerald-400" />
        <span>Inspect 3D Water Block</span>
      </button>
    </div>
  );
};
