import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Compass,
  Crosshair,
  Split,
  BarChart2,
  Folder,
  FlaskConical,
  Search,
  Layers,
  Settings,
  HelpCircle,
  Globe2,
  Box,
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
  } = useOceanStore();

  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const navMenuRef = useRef(null);

  // Close nav dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target)) {
        setIsNavMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (pageId, overlayName = null) => {
    if (overlayName) {
      toggleOverlay(overlayName);
    } else {
      closeAllOverlays();
      setActivePage(pageId);
    }
  };

  const NAV_ITEMS = [
    { id: 'home', label: 'Explore', icon: Compass },
    { id: 'argo', label: 'Argo Network', icon: Crosshair },
    { id: 'comparison', label: 'Model vs Obs', icon: Split },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'data', label: 'Data Catalog', icon: Folder },
    { id: 'methodology', label: 'Methodology', icon: FlaskConical },
  ];

  return (
    <header className="relative z-40 h-14 px-4 sm:px-6 flex items-center justify-between bg-[rgba(3,7,18,0.6)] backdrop-blur-xl border-b border-sky-500/20 text-white select-none transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      {/* ─── Left Section: Brand Emblem, Navigation Menu Button, & 3D Engine Switcher ─── */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
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

        {/* Navigation Dropdown Menu Button */}
        <div className="relative" ref={navMenuRef}>
          <button
            onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
            className={`p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer ${
              isNavMenuOpen
                ? 'bg-sky-500/25 text-sky-200 border-sky-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-black/40 text-slate-300 hover:text-white hover:bg-white/10 border-white/[0.08] hover:border-cyan-500/40'
            }`}
            title="Navigation Menu"
            aria-label="Navigation Menu"
          >
            <Menu className="w-4 h-4 text-cyan-400" />
          </button>

          {isNavMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-slate-950/95 backdrop-blur-xl border border-sky-500/30 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-1.5 z-50 animate-fade-slide">
              <div className="px-3 py-1.5 border-b border-white/10 text-[9px] font-mono uppercase tracking-wider text-slate-400">
                Navigation Deck
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleNavClick(item.id);
                        setIsNavMenuOpen(false);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left w-full cursor-pointer ${
                        isActive
                          ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-glow-cyan-sm font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-300' : 'text-sky-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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
            aria-label="Search Coordinates & Target Basin (Hotkey: L)"
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
            aria-label="Toggle Visualization Layers (Hotkey: C)"
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
            aria-label="System Settings & Raymarching Tuning"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Keyboard Shortcuts */}
          <button
            onClick={toggleShortcutsModal}
            className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-all"
            title="Keyboard Shortcuts & Diagnostics (Hotkey: ?)"
            aria-label="Keyboard Shortcuts & Diagnostics (Hotkey: ?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
