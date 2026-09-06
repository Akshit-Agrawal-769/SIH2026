import React, { useState } from 'react';
import { MapPin, RotateCcw, Globe, Compass } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ViewRegionPanel = () => {
  const { triggerCameraAction, toggleGoToLocationModal } = useOceanStore();
  const [activeRegion, setActiveRegion] = useState('indian_ocean');

  const handleFitEarth = () => {
    setActiveRegion('fit_earth');
    triggerCameraAction('fit_earth');
  };

  const handleIndianOcean = () => {
    setActiveRegion('indian_ocean');
    triggerCameraAction('fit_indian_ocean');
  };

  const handleReset = () => {
    setActiveRegion('indian_ocean');
    triggerCameraAction('reset');
  };

  return (
    <div className="w-72 bg-[rgba(6,12,24,0.82)] backdrop-blur-xl rounded-2xl border border-sky-500/20 shadow-2xl p-4 text-white select-none transition-all">
      <h2 className="text-xs font-semibold tracking-wide text-white mb-3 flex items-center justify-between">
        <span>View &amp; Region</span>
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {/* Fit Earth */}
        <button
          onClick={handleFitEarth}
          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
            activeRegion === 'fit_earth'
              ? 'bg-[#0072ce] text-white border-sky-400/50 shadow-[0_0_12px_rgba(0,114,206,0.4)]'
              : 'bg-[#0a1526]/80 text-slate-300 hover:text-white border-white/[0.08] hover:border-sky-500/30 hover:bg-sky-500/10'
          }`}
        >
          <span>Fit Earth</span>
        </button>

        {/* Indian Ocean */}
        <button
          onClick={handleIndianOcean}
          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
            activeRegion === 'indian_ocean'
              ? 'bg-[#0072ce] text-white border-sky-400/50 shadow-[0_0_12px_rgba(0,114,206,0.5)]'
              : 'bg-[#0a1526]/80 text-slate-300 hover:text-white border-white/[0.08] hover:border-sky-500/30 hover:bg-sky-500/10'
          }`}
        >
          <span>Indian Ocean</span>
        </button>

        {/* Go to Coordinates */}
        <button
          onClick={toggleGoToLocationModal}
          className="px-3 py-2 rounded-xl text-xs font-medium bg-[#0a1526]/80 text-slate-300 hover:text-white border border-white/[0.08] hover:border-sky-500/30 hover:bg-sky-500/10 transition-all flex items-center justify-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5 text-sky-400" />
          <span>Go to Coordinates</span>
        </button>

        {/* Reset View */}
        <button
          onClick={handleReset}
          className="px-3 py-2 rounded-xl text-xs font-medium bg-[#0a1526]/80 text-slate-300 hover:text-white border border-white/[0.08] hover:border-sky-500/30 hover:bg-sky-500/10 transition-all flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset View</span>
        </button>
      </div>
    </div>
  );
};
