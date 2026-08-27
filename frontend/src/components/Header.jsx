import React from 'react';
import {
  Search,
  Layers,
  Activity,
  Radio,
  Zap,
  Sliders,
  Menu,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const Header = () => {
  const {
    activeOverlay,
    toggleOverlay,
    health,
    toggleGoToLocationModal,
    toggleShortcutsModal,
    setActivePage,
  } = useOceanStore();

  const isHealthy = health?.status === 'healthy';

  return (
    <header className="absolute top-0 left-0 right-0 z-40 h-9 md:h-10 px-3 md:px-4 flex items-center justify-between bg-[rgba(6,8,12,0.55)] backdrop-blur-md border-b border-white/[0.06] text-white/90 select-none transition-opacity duration-300">
      {/* Left: INCOIS Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setActivePage('home');
            useOceanStore.getState().closeAllOverlays();
          }}
          className="flex items-center gap-2 group focus:outline-none"
          title="Eyes on the Ocean · INCOIS Ocean Systems"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          <span className="text-[13px] font-normal tracking-wide text-white/90 group-hover:text-white transition-colors">
            INCOIS <span className="text-white/40 font-light">·</span> Ocean Systems
          </span>
        </button>
      </div>

      {/* Center: Contextual Floating Overlay Pills */}
      <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-0.5 rounded-full border border-white/[0.06] shadow-sm">
        <button
          onClick={() => toggleOverlay('vitalSigns')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal transition-all ${
            activeOverlay === 'vitalSigns'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/60 hover:text-white/90 hover:bg-white/5'
          }`}
          title="Ocean Vital Signs"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Vital Signs</span>
        </button>

        <button
          onClick={() => toggleOverlay('missions')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal transition-all ${
            activeOverlay === 'missions'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/60 hover:text-white/90 hover:bg-white/5'
          }`}
          title="Observing Missions & In-Situ Fleet"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Missions</span>
        </button>

        <button
          onClick={() => toggleOverlay('events')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal transition-all ${
            activeOverlay === 'events'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/60 hover:text-white/90 hover:bg-white/5'
          }`}
          title="Extreme Ocean Events & Anomalies"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Events</span>
        </button>

        <button
          onClick={() => toggleOverlay('depth')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal transition-all ${
            activeOverlay === 'depth'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/60 hover:text-white/90 hover:bg-white/5'
          }`}
          title="Subsurface Depth Exploration"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Depth</span>
        </button>
      </div>

      {/* Right Tools & Status Icons */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Search Location */}
        <button
          onClick={toggleGoToLocationModal}
          className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          title="Search Geographic Location or Coordinates (L)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Layer Visibility Stack */}
        <button
          onClick={() => toggleOverlay('layers')}
          className={`p-1.5 rounded transition-colors ${
            activeOverlay === 'layers'
              ? 'text-white bg-white/15'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Toggle Planetary 3D Layers"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        {/* Workspaces & Scientific Tools Menu */}
        <button
          onClick={() => toggleOverlay('workspaces')}
          className={`p-1.5 rounded transition-colors ${
            activeOverlay === 'workspaces'
              ? 'text-white bg-white/15'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Scientific Workspaces & Data Tools"
        >
          <Menu className="w-3.5 h-3.5" />
        </button>

        {/* System Health Dot */}
        <div
          className="flex items-center px-1 py-1"
          title={`INCOIS Model & Telemetry Status: ${isHealthy ? 'Operational' : 'Active'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isHealthy
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]'
            }`}
          />
        </div>

        {/* Shortcuts / Help */}
        <button
          onClick={toggleShortcutsModal}
          className="p-1 text-white/40 hover:text-white/80 transition-colors text-[11px] font-mono"
          title="Keyboard Shortcuts (?)"
        >
          ?
        </button>
      </div>
    </header>
  );
};
