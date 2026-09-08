import React, { useState, useEffect } from 'react';
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
  FlaskConical,
  Activity,
  Globe2,
  Box,
  Clock,
  Waves,
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
    engineMode,
    setEngineMode,
    variable,
    depthLevelMeters,
    timeIndex,
    metadata,
  } = useOceanStore();

  const [utcTime, setUtcTime] = useState('');

  // Live Mission UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = (pageId, overlayName = null) => {
    if (overlayName) {
      toggleOverlay(overlayName);
    } else {
      closeAllOverlays();
      setActivePage(pageId);
    }
  };

  const fieldLabels = {
    temp: 'Sea Surface Temperature (SST)',
    salt: 'Sea Surface Salinity (SSS)',
    chl: 'Chlorophyll-a Biomass (CHLA)',
    currents: 'Surface Velocity Vectors (CURR)',
    waves: 'Significant Wave Height (SWH)',
  };
  const activeFieldName = fieldLabels[variable] || variable.toUpperCase();
  const timeRange = metadata?.time_range || [];
  const currentDateStr = timeRange[timeIndex] ? timeRange[timeIndex].split('T')[0] : '2023-08-15';

  return (
    <header className="relative z-40 h-14 px-4 sm:px-6 flex items-center justify-between bg-[rgba(3,7,18,0.6)] backdrop-blur-xl border-b border-sky-500/20 text-white select-none transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      {/* ─── Left Section: Brand Emblem & 3D Engine Switcher ─── */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={() => {
            setActivePage('home');
            closeAllOverlays();
          }}
          className="flex items-center gap-3 group focus:outline-none text-left"
          title="INCOIS Ocean Intelligence Platform — 3D Synoptic Mission Control"
        >
          {/* Mission Control Radar Emblem */}
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-sky-950/80 to-blue-900/60 border border-sky-400/40 p-1.5 flex items-center justify-center shadow-glow-cyan-sm group-hover:border-sky-300 transition-all overflow-hidden">
            <div className="absolute inset-0 bg-sky-500/10 radar-sweep opacity-40 pointer-events-none" />
            <svg viewBox="0 0 24 24" className="w-full h-full fill-none stroke-sky-300 stroke-[2.2]" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12c3-4 6-4 9 0s6 4 9 0" />
              <path d="M2 17c3-4 6-4 9 0s6 4 9 0" opacity="0.6" />
              <circle cx="12" cy="6" r="2.5" fill="#38bdf8" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-wider text-white font-mono">INCOIS</span>
              <span className="text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-400/30 text-sky-300">
                OCEAN INTEL
              </span>
            </div>
            <span className="text-[9.5px] text-slate-400 block -mt-0.5 tracking-tight font-sans">
              3D Planetary Observation &amp; Numerical Model Colocation
            </span>
          </div>
        </button>

        {/* High-Precision 3D Engine Mode Switcher */}
        <div className="hidden lg:flex items-center bg-black/50 backdrop-blur-md p-0.5 rounded-lg border border-sky-500/20 text-[10px] font-mono shadow-inner">
          <button
            onClick={() => setEngineMode('cesium')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              engineMode === 'cesium'
                ? 'bg-sky-500/25 text-sky-200 font-semibold border border-sky-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Switch to CesiumJS Planetary Mission Control Globe"
          >
            <Globe2 className="w-3 h-3 text-cyan-400" />
            <span>CESIUM GLOBE</span>
          </button>
          <button
            onClick={() => setEngineMode('three')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              engineMode === 'three'
                ? 'bg-sky-500/25 text-sky-200 font-semibold border border-sky-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Switch to 3D Volumetric Raymarching Viewport (Three.js WebGL2)"
          >
            <Box className="w-3 h-3 text-sky-400" />
            <span>3D VOLUMETRIC</span>
          </button>
        </div>
      </div>

      {/* ─── Center Section: Active Ocean Field & Telemetry Hub (Hierarchies #2 & #3) ─── */}
      {activePage === 'home' && (
        <div className="hidden xl:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-black/45 backdrop-blur-md border border-cyan-500/35 shadow-[0_0_20px_rgba(6,182,212,0.15)] data-shimmer">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f2fe]" />
            <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold uppercase">FIELD:</span>
            <span className="text-xs font-semibold text-white tracking-wide glow-text-cyan">{activeFieldName}</span>
            <span className="text-[10px] font-mono text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40">
              σ: {depthLevelMeters}m
            </span>
            <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              <span>QC 1-2 · 99.4% CONF</span>
            </span>
          </div>
          <div className="w-[1px] h-3.5 bg-white/15" />
          <div className="flex items-center gap-2 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-sky-200 font-semibold tabular-nums">{currentDateStr}</span>
            <span className="text-slate-500">·</span>
            <span className="text-cyan-300 font-mono text-[11px] tabular-nums">{utcTime}</span>
          </div>
        </div>
      )}

      {/* ─── Center Section: Navigation Command Deck ─── */}
      <nav className="hidden md:flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-sky-500/20 shadow-inner">
        {/* Explore */}
        <button
          onClick={() => handleNavClick('home')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activePage === 'home' && !activeOverlay
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-glow-cyan-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span>Explore</span>
        </button>

        {/* Argo */}
        <button
          onClick={() => handleNavClick('argo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activePage === 'argo'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-glow-cyan-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5 text-sky-400" />
          <span>Argo Network</span>
        </button>

        {/* Model vs Obs */}
        <button
          onClick={() => handleNavClick('comparison')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activePage === 'comparison'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-glow-cyan-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Split className="w-3.5 h-3.5 text-sky-400" />
          <span>Model vs Obs</span>
        </button>

        {/* Analytics */}
        <button
          onClick={() => handleNavClick('analytics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activePage === 'analytics'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-glow-cyan-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5 text-sky-400" />
          <span>Analytics</span>
        </button>

        {/* Data Catalog */}
        <button
          onClick={() => handleNavClick('data')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activePage === 'data'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-glow-cyan-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-sky-400" />
          <span>Data Catalog</span>
        </button>

        {/* Methodology */}
        <button
          onClick={() => handleNavClick('methodology')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activePage === 'methodology'
              ? 'bg-violet-600/25 text-violet-200 border border-violet-400/40 shadow-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
          <span>Methodology</span>
        </button>

        {/* Missions Overlay Toggle */}
        <button
          onClick={() => handleNavClick('home', 'missions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeOverlay === 'missions'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-glow-cyan-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-sky-400" />
          <span>Missions</span>
        </button>

        {/* Events Overlay Toggle */}
        <button
          onClick={() => handleNavClick('home', 'events')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeOverlay === 'events'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-sm font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Events</span>
        </button>
      </nav>

      {/* ─── Right Section: Live Telemetry Status & Utility Tools ─── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Animated Data-Stream Telemetry Badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono text-emerald-300">
          <div className="flex items-end gap-0.5 h-2.5">
            <div className="w-0.5 bg-emerald-400 rounded-full signal-bar-1" />
            <div className="w-0.5 bg-emerald-400 rounded-full signal-bar-2" />
            <div className="w-0.5 bg-emerald-400 rounded-full signal-bar-3" />
          </div>
          <span className="font-semibold tracking-wide">INGEST: 24 Hz</span>
          <span className="text-slate-600">|</span>
          <span className="text-[9px] text-emerald-400/80">CF-1.6</span>
        </div>

        {/* Utility Icon Actions */}
        <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/[0.08]">
          {/* Coordinates Search (Go To Location) */}
          <button
            onClick={toggleGoToLocationModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-all"
            title="Search Coordinates & Target Basin (Hotkey: L)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Visualization Layers */}
          <button
            onClick={() => toggleOverlay('layers')}
            className={`p-1.5 rounded-md transition-all ${
              activeOverlay === 'layers'
                ? 'text-cyan-300 bg-cyan-500/25 border border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 border border-transparent'
            }`}
            title="Toggle Visualization Layers (Hotkey: C)"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Settings & Quality */}
          <button
            onClick={() => setActivePage('settings')}
            className={`p-1.5 rounded-md transition-all ${
              activePage === 'settings'
                ? 'text-cyan-300 bg-cyan-500/25 border border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 border border-transparent'
            }`}
            title="System Settings & Raymarching Tuning"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Keyboard Shortcuts */}
          <button
            onClick={toggleShortcutsModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-all"
            title="Keyboard Shortcuts & Diagnostics (Hotkey: ?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
