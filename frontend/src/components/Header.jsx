import React from 'react';
import {
  Compass,
  Crosshair,
  Split,
  BarChart2,
  Folder,
  Radio,
  Zap,
  Search,
  Layers,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const Header = () => {
  const {
    activePage,
    setActivePage,
    activeOverlay,
    toggleOverlay,
    closeAllOverlays,
    toggleGoToLocationModal,
    toggleShortcutsModal,
  } = useOceanStore();

  const handleNavClick = (pageId, overlayName = null) => {
    if (overlayName) {
      toggleOverlay(overlayName);
    } else {
      closeAllOverlays();
      setActivePage(pageId);
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-40 h-14 px-5 flex items-center justify-between bg-[rgba(6,12,24,0.75)] backdrop-blur-md border-b border-sky-500/15 text-white select-none transition-all">
      {/* Left: INCOIS Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setActivePage('home');
            closeAllOverlays();
          }}
          className="flex items-center gap-2.5 group focus:outline-none text-left"
          title="INCOIS Ocean Systems — 3D Ocean Data Visualization & Analysis"
        >
          {/* Oceanic Emblem */}
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-[#0052a3] to-[#00a3ff] flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(0,163,255,0.4)] border border-sky-400/40 group-hover:border-sky-300 transition-all">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-none stroke-white stroke-[2.2]" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12c3-4 6-4 9 0s6 4 9 0" />
              <path d="M2 17c3-4 6-4 9 0s6 4 9 0" opacity="0.6" />
              <circle cx="12" cy="6" r="2" fill="white" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wide text-white">INCOIS</span>
              <span className="font-light text-xs text-slate-300">Ocean Systems</span>
            </div>
            <span className="text-[10px] text-slate-400 block -mt-0.5 tracking-tight">
              3D Ocean Data Visualization &amp; Analysis
            </span>
          </div>
        </button>
      </div>

      {/* Center: Navigation Pills */}
      <nav className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-full border border-sky-500/20 shadow-inner">
        {/* Explore */}
        <button
          onClick={() => handleNavClick('home')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
            activePage === 'home' && !activeOverlay
              ? 'bg-[#0072ce] text-white shadow-[0_0_12px_rgba(0,114,206,0.6)] border border-sky-300/40'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Explore</span>
        </button>

        {/* Argo */}
        <button
          onClick={() => handleNavClick('argo')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-normal transition-all ${
            activePage === 'argo'
              ? 'bg-[#0072ce] text-white shadow-[0_0_12px_rgba(0,114,206,0.6)] border border-sky-300/40'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Argo</span>
        </button>

        {/* Model vs Obs */}
        <button
          onClick={() => handleNavClick('comparison')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-normal transition-all ${
            activePage === 'comparison'
              ? 'bg-[#0072ce] text-white shadow-[0_0_12px_rgba(0,114,206,0.6)] border border-sky-300/40'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          <span>Model vs Obs</span>
        </button>

        {/* Analytics */}
        <button
          onClick={() => handleNavClick('analytics')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-normal transition-all ${
            activePage === 'analytics'
              ? 'bg-[#0072ce] text-white shadow-[0_0_12px_rgba(0,114,206,0.6)] border border-sky-300/40'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Analytics</span>
        </button>

        {/* Data Catalog */}
        <button
          onClick={() => handleNavClick('data')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-normal transition-all ${
            activePage === 'data'
              ? 'bg-[#0072ce] text-white shadow-[0_0_12px_rgba(0,114,206,0.6)] border border-sky-300/40'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>Data Catalog</span>
        </button>

        {/* Missions */}
        <button
          onClick={() => handleNavClick('home', 'missions')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-normal transition-all ${
            activeOverlay === 'missions'
              ? 'bg-[#0072ce] text-white shadow-[0_0_12px_rgba(0,114,206,0.6)] border border-sky-300/40'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Missions</span>
        </button>

        {/* Events */}
        <button
          onClick={() => handleNavClick('home', 'events')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-normal transition-all ${
            activeOverlay === 'events'
              ? 'bg-[#0072ce] text-white shadow-[0_0_12px_rgba(0,114,206,0.6)] border border-sky-300/40'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Events</span>
        </button>
      </nav>

      {/* Right: Utility Tools */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          onClick={toggleGoToLocationModal}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Search Coordinates or Locations"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Layers */}
        <button
          onClick={() => toggleOverlay('layers')}
          className={`p-2 rounded-lg transition-colors ${
            activeOverlay === 'layers'
              ? 'text-white bg-sky-600/30 border border-sky-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Data Layers"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={() => setActivePage('settings')}
          className={`p-2 rounded-lg transition-colors ${
            activePage === 'settings'
              ? 'text-white bg-sky-600/30 border border-sky-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Settings & System Configuration"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Help */}
        <button
          onClick={toggleShortcutsModal}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Keyboard Shortcuts & System Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
