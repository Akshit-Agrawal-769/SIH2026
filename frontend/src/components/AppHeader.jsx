import React from 'react';
import {
  Globe,
  Radio,
  BarChart2,
  Database,
  FileText,
  Search,
  Sliders,
  Cpu,
  HelpCircle,
  Activity,
  Layers,
  Compass,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const AppHeader = () => {
  const {
    activePage,
    setActivePage,
    health,
    toggleGoToLocationModal,
    toggleDiagnostics,
    toggleShortcutsModal,
    isLoading,
    loadingMessage,
    triggerCameraAction,
    activeOverlay,
    toggleOverlay,
  } = useOceanStore();

  const isHealthy = health?.status === 'healthy';

  const navItems = [
    { id: 'home', label: 'Explore 3D', icon: Globe },
    { id: 'argo', label: 'Observations', icon: Radio },
    { id: 'comparison', label: '4D Compare', icon: BarChart2 },
    { id: 'data', label: 'Data Catalog', icon: Database },
    { id: 'methodology', label: 'Methodology', icon: FileText },
  ];

  return (
    <header className="relative z-40 h-9.5 px-3 flex items-center justify-between bg-[var(--surface-header)] border-b border-[var(--border-hairline)] text-slate-200 select-none shrink-0 font-sans">
      {/* Loading Radar Sweep Indicator */}
      {isLoading && (
        <div className="radar-sweep-bar" title={loadingMessage || 'Loading oceanographic data...'} />
      )}

      {/* Left: INCOIS Workstation Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActivePage('home')}
          className="flex items-center gap-2 group focus:outline-none"
          title="INCOIS Indian Ocean Operational Visualization System"
        >
          <div className="w-2 h-2 rounded-none bg-sky-400 rotate-45 group-hover:bg-white transition-colors" />
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-xs font-bold tracking-wider text-slate-100 group-hover:text-white">
              INCOIS
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-light">
              OCEAN SYSTEMS
            </span>
          </div>
        </button>

        <span className="h-3 w-px bg-[var(--border-hairline)] hidden sm:block" />

        {/* Live Cursor Probe / Coordinate Telemetry in Header on Explore */}
        {activePage === 'home' && (
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="text-slate-500">PROV:</span>
            <span className="text-sky-300">ROMS 3.9</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-300">CORIOLIS GDAC</span>
          </div>
        )}
      </div>

      {/* Center: Navigation Section Switcher */}
      <nav className="flex items-center gap-0.5 bg-[var(--surface-base)] p-0.5 border border-[var(--border-hairline)] rounded-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-[11px] font-mono transition-all ${
                isActive
                  ? 'bg-[var(--surface-well)] text-sky-400 font-semibold border border-[var(--border-medium)] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--surface-well-hover)] border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Tools & Status Indicators */}
      <div className="flex items-center gap-1.5">
        {/* Quick Camera Presets (Explore view only) */}
        {activePage === 'home' && (
          <div className="hidden xl:flex items-center gap-1 text-[10px] font-mono mr-1">
            <button
              onClick={() => triggerCameraAction('fit_indian_ocean')}
              className="px-2 py-0.5 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] text-slate-300 hover:text-white transition-colors"
              title="Focus Indian Ocean Synoptic View"
            >
              INDIAN OCEAN
            </button>
            <button
              onClick={() => triggerCameraAction('fit_earth')}
              className="px-2 py-0.5 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] text-slate-300 hover:text-white transition-colors"
              title="Fit Global Earth"
            >
              FIT GLOBE
            </button>
          </div>
        )}

        {/* Geographic Search Trigger */}
        <button
          onClick={toggleGoToLocationModal}
          className="p-1.5 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] text-slate-400 hover:text-slate-100 transition-colors"
          title="Search Coordinates or Location (L)"
        >
          <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        {/* System Diagnostics Drawer Toggle */}
        <button
          onClick={toggleDiagnostics}
          className="p-1.5 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] text-slate-400 hover:text-slate-100 transition-colors"
          title="System Diagnostics & WebGL Metrics"
        >
          <Cpu className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        {/* Keyboard Shortcuts Reference */}
        <button
          onClick={toggleShortcutsModal}
          className="p-1.5 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] text-slate-400 hover:text-slate-100 transition-colors text-[10px] font-mono font-bold"
          title="Keyboard Shortcuts Reference (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        <span className="h-3 w-px bg-[var(--border-hairline)] mx-0.5" />

        {/* Operational Status Dot */}
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-[var(--surface-well)] border border-[var(--border-hairline)] text-[10px] font-mono"
          title={`INCOIS Model Backend Status: ${isHealthy ? 'Operational' : 'Active / Connecting'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isHealthy ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-slate-400 hidden sm:inline">{isHealthy ? 'ONLINE' : 'ACTIVE'}</span>
        </div>
      </div>
    </header>
  );
};
