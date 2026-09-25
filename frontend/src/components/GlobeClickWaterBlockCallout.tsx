import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore } from '../store/useOceanStore';
import { Box, X, MapPin, BarChart3 } from 'lucide-react';

export const GlobeClickWaterBlockCallout: React.FC = () => {
  const { clickedGlobePoint, setClickedGlobePoint, openWaterBlock, openAnalyticsModal, selectedVariable } = useOceanStore(
    useShallow((s) => ({
      clickedGlobePoint: s.clickedGlobePoint,
      setClickedGlobePoint: s.setClickedGlobePoint,
      openWaterBlock: s.openWaterBlock,
      openAnalyticsModal: s.openAnalyticsModal,
      selectedVariable: s.selectedVariable
    }))
  );

  if (!clickedGlobePoint) return null;
  const { lon, lat, screenX, screenY, basin } = clickedGlobePoint;
  const name = basin || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;

  return (
    <div
      role="dialog"
      aria-label="Selected point"
      style={{
        left: `${Math.min(window.innerWidth - 280, Math.max(20, screenX - 130))}px`,
        top: `${Math.max(70, screenY - 130)}px`
      }}
      className="fixed z-40 w-64 glass-panel rounded-2xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-white tracking-wide">{basin || 'Selected point'}</span>
        </div>
        <button
          onClick={() => setClickedGlobePoint(null)}
          aria-label="Close"
          className="p-1 text-ocean-muted hover:text-white rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-1 text-[10px] font-mono text-ocean-text-secondary">
        {lat.toFixed(2)}°N, {lon.toFixed(2)}°E <span className="text-ocean-muted">(basin label approximate)</span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => openWaterBlock({ lon, lat, name })}
          className="py-2 px-2 glass-pill text-emerald-300 hover:text-white rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
        >
          <Box className="w-3.5 h-3.5" />
          <span>Water column</span>
        </button>
        <button
          onClick={() => {
            openAnalyticsModal({ lat, lon, depth: 0, variable: selectedVariable, name });
            setClickedGlobePoint(null);
          }}
          className="py-2 px-2 glass-pill text-emerald-300 hover:text-white rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Analyse</span>
        </button>
      </div>
    </div>
  );
};
