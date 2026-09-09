import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Check,
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
    setVariable,
    depthLevelMeters,
    timeIndex,
    metadata,
  } = useOceanStore();

  const [utcTime, setUtcTime] = useState('');
  const [isFieldDropdownOpen, setIsFieldDropdownOpen] = useState(false);
  const fieldDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(event.target)) {
        setIsFieldDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const OCEAN_FIELDS = [
    {
      id: 'temp',
      label: 'Temperature (SST)',
      fullName: 'Potential Sea Surface Temperature',
      units: 'degC',
      code: 'TEMP',
      badgeColor: 'text-amber-300 bg-amber-500/15 border-amber-400/30',
      description: 'Thermal energy distribution and thermocline stratification',
    },
    {
      id: 'salt',
      label: 'Salinity (SSS)',
      fullName: 'Practical Sea Surface Salinity',
      units: 'PSU',
      code: 'SALT',
      badgeColor: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/30',
      description: 'Haline gradients, river discharge, and evaporation fronts',
    },
    {
      id: 'currents',
      label: 'Current Velocity (CURR)',
      fullName: 'Ocean Current Velocity Field',
      units: 'm/s',
      code: 'CURR',
      badgeColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',
      description: 'Zonal and meridional surface and subsurface transport',
    },
    {
      id: 'chl',
      label: 'Chlorophyll-a (CHLA)',
      fullName: 'Chlorophyll-a Biomass Concentration',
      units: 'mg/m³',
      code: 'CHLA',
      badgeColor: 'text-lime-300 bg-lime-500/15 border-lime-400/30',
      description: 'Phytoplankton blooms, upwelling zones, and biological productivity',
    },
  ];
  const currentField = OCEAN_FIELDS.find(f => f.id === variable || (f.id === 'currents' && (variable === 'u' || variable === 'v' || variable === 'currents'))) || OCEAN_FIELDS[0];

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
          <div className="flex items-center gap-2" ref={fieldDropdownRef}>
            <div className="relative">
              <button
                onClick={() => setIsFieldDropdownOpen(!isFieldDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/35 hover:border-cyan-400/60 transition-all cursor-pointer shadow-sm group"
                title="Select Active Ocean Data Field"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f2fe]" />
                <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold uppercase">FIELD:</span>
                <span className="text-xs font-semibold text-white tracking-wide glow-text-cyan flex items-center gap-1.5">
                  {currentField.label}
                  <ChevronDown className={`w-3.5 h-3.5 text-cyan-400 transition-transform ${isFieldDropdownOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {isFieldDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-1.5 z-50 animate-fade-slide">
                  <div className="px-2.5 py-1.5 border-b border-white/10 text-[9px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Select Ocean Parameter</span>
                    <span className="text-cyan-400">ROMS 1/12°</span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {OCEAN_FIELDS.map((f) => {
                      const isSelected = variable === f.id || (f.id === 'currents' && (variable === 'u' || variable === 'v' || variable === 'currents'));
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setVariable(f.id);
                            setIsFieldDropdownOpen(false);
                          }}
                          className={`flex items-start gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500/20 border border-cyan-400/50 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                              : 'hover:bg-white/5 text-slate-300 hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-cyan-400" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
                            )}
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{f.label}</span>
                              <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${f.badgeColor}`}>
                                {f.units}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 leading-tight mt-0.5 font-light">
                              {f.description}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

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
