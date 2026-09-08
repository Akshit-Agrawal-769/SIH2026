import React, { useState } from 'react';
import { MapPin, RotateCcw, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ViewRegionPanel = () => {
  const { triggerCameraAction, toggleGoToLocationModal } = useOceanStore();
  const [activeRegion, setActiveRegion] = useState('indian_ocean');
  const [isOpen, setIsOpen] = useState(true);

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
    <div className="w-76 mission-panel rounded-2xl p-3.5 text-white select-none panel-transition animate-fade-slide overflow-hidden relative">
      {/* Subtle Restrained Scanning Line */}
      <div className="absolute inset-0 scan-line pointer-events-none bg-gradient-to-b from-transparent via-cyan-400/[0.05] to-transparent h-8" />

      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left focus:outline-none"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold tracking-wider uppercase font-mono text-white glow-text-cyan">
            VIEW &amp; REGION
          </span>
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold">
            WGS-84
          </span>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
            title={isOpen ? 'Collapse Panel' : 'Expand Panel'}
          >
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-2.5 space-y-2.5 panel-transition">
          {/* Preset Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Fit Earth */}
            <button
              onClick={handleFitEarth}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                activeRegion === 'fit_earth'
                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-semibold'
                  : 'bg-black/40 text-slate-300 hover:text-white border-white/[0.08] hover:border-cyan-500/40 hover:bg-cyan-500/10'
              }`}
            >
              <span>Fit Earth</span>
            </button>

            {/* Indian Ocean */}
            <button
              onClick={handleIndianOcean}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                activeRegion === 'indian_ocean'
                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-semibold'
                  : 'bg-black/40 text-slate-300 hover:text-white border-white/[0.08] hover:border-cyan-500/40 hover:bg-cyan-500/10'
              }`}
            >
              <span>Indian Ocean</span>
            </button>

            {/* Go to Coordinates */}
            <button
              onClick={toggleGoToLocationModal}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-black/40 text-slate-300 hover:text-white border border-white/[0.08] hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Open Coordinates Dialog (Hotkey: L)"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Coordinates</span>
            </button>

            {/* Reset View */}
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-black/40 text-slate-300 hover:text-white border border-white/[0.08] hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Reset Camera (Hotkey: R)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset View</span>
            </button>
          </div>

          {/* Regional Bounding Box Telemetry */}
          <div className="p-2 rounded-xl bg-black/45 border border-white/[0.06] font-mono text-[9px] text-slate-400 space-y-1">
            <div className="flex justify-between items-center">
              <span>DOMAIN BBOX:</span>
              <span className="text-cyan-300 font-semibold">[20°E-120°E, 40°S-30°N]</span>
            </div>
            <div className="flex justify-between items-center">
              <span>PROJECTION:</span>
              <span className="text-slate-300">EPSG:4326 (WGS 84 Ellipsoid)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
