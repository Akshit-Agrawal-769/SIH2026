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
      className="fixed z-40 w-64 bg-ocean-panel/95 backdrop-blur-xl border border-cyan-400/60 rounded-xl p-3 shadow-2xl shadow-cyan-500/20 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-xs font-bold text-white tracking-wide">
            {basin || 'Ocean Water Column'}
          </span>
        </div>
        <button
          onClick={() => setClickedGlobePoint(null)}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-slate-300">
        <span>{lat.toFixed(2)}°N, {lon.toFixed(2)}°E</span>
        <span className="text-cyan-400">•</span>
        <span className="text-ocean-muted">Depth: 0–2000m</span>
      </div>

      <button
        onClick={handleOpen3DBlock}
        className="mt-2.5 w-full py-1.5 px-2 bg-gradient-to-r from-cyan-600/40 to-blue-600/40 hover:from-cyan-600/60 hover:to-blue-600/60 text-cyan-200 border border-cyan-400/60 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 transition active:scale-[0.98]"
      >
        <Box className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
        <span>Inspect 3D Water Block</span>
      </button>
    </div>
  );
};
