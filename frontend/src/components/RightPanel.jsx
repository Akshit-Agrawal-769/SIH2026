import React, { useState } from 'react';
import {
  Radio,
  Activity,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  X,
  PanelRightClose,
  PanelRightOpen,
  Search,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';
import { useArgoTrajectory } from '../hooks/useArgoTrajectory';
import { ArgoCycleNavigator } from './ArgoCycleNavigator';
import { ArgoProfile } from './ArgoProfile';

export const RightPanel = () => {
  const {
    selectedFloat,
    selectFloat,
    argoFloats,
    selectedEntity,
    setSelectedEntity,
    cursorProbe,
    depthLevelMeters,
    variable,
  } = useOceanStore();

  const { activeCycle } = useArgoTrajectory();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // If nothing is selected, remain completely hidden
  const hasContent = !!selectedFloat || !!selectedEntity || !!cursorProbe;
  if (!hasContent) return null;

  const filteredFloats = (argoFloats || []).filter((f) => {
    const term = searchTerm.toLowerCase();
    const wmo = String(f.platform_number || '').toLowerCase();
    const src = String(f.source || '').toLowerCase();
    return wmo.includes(term) || src.includes(term);
  });

  if (isCollapsed) {
    return (
      <aside className="absolute right-0 top-9.5 bottom-0 z-30 w-10 bg-[var(--surface-rack-backdrop)] backdrop-blur-md border-l border-[var(--border-hairline)] flex flex-col items-center py-2 gap-2 text-slate-400 select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-well)] hover:text-white transition-colors"
          title="Expand Dossier Inspector Rack (I)"
        >
          <PanelRightOpen className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="absolute right-0 top-9.5 bottom-0 z-30 w-80 bg-[var(--surface-rack-backdrop)] backdrop-blur-md border-l border-[var(--border-hairline)] flex flex-col text-slate-200 select-none overflow-hidden font-sans shadow-2xl">
      {/* Dossier Header */}
      <div className="h-8 px-3 border-b border-[var(--border-hairline)] bg-[var(--surface-header)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 truncate">
          <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={1.75} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-100 truncate">
            {selectedFloat ? `ARGO WMO ${selectedFloat.platform_number}` : (selectedEntity?.title || 'SPATIAL PROBE')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-[2px] text-slate-400 hover:text-white hover:bg-[var(--surface-well)] transition-colors"
            title="Collapse Dossier"
          >
            <PanelRightClose className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => {
              selectFloat(null);
              setSelectedEntity(null);
            }}
            className="p-1 rounded-[2px] text-slate-400 hover:text-white hover:bg-[var(--surface-well)] transition-colors"
            title="Dismiss Inspector (Esc)"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Main Dossier Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 flex flex-col gap-2.5 font-mono text-[11px]">

        {/* Argo Float Dossier Experience */}
        {selectedFloat ? (
          <div className="flex flex-col gap-2.5">
            {/* 1. Cycle Stepper & Telemetry Navigator */}
            <ArgoCycleNavigator />

            {/* 2. Vertical CTD Profile Visualizer */}
            <ArgoProfile activeCycle={activeCycle} />

            {/* 3. In-Situ Array Float Search & Quick Selector */}
            <div className="instrument-well p-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-wider">
                <span>INDEXED PLATFORMS ({filteredFloats.length})</span>
                <span className="text-amber-400">CORIOLIS GDAC</span>
              </div>

              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search WMO or provider..."
                  className="w-full pl-6 pr-2 py-0.5 bg-[var(--surface-base)] border border-[var(--border-hairline)] text-slate-200 text-[10px] focus:outline-none focus:border-amber-400 rounded-[2px]"
                />
              </div>

              <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto custom-scrollbar">
                {filteredFloats.slice(0, 20).map((fl) => {
                  const isSelected = selectedFloat?.platform_number === fl.platform_number;
                  return (
                    <button
                      key={fl.platform_number}
                      onClick={() => selectFloat(fl)}
                      className={`flex items-center justify-between p-1 rounded-[2px] text-left transition-all ${
                        isSelected
                          ? 'bg-amber-950/60 border border-amber-400 text-amber-200 font-bold'
                          : 'bg-[var(--surface-base)] border border-[var(--border-hairline)] text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="truncate">WMO {fl.platform_number}</span>
                      <span className="text-[9px] text-slate-500 shrink-0">
                        {fl.profiles_count || fl.cycles?.length || 1} cyc
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* General Spatial Entity / Crosshair Probe Dossier */
          <div className="instrument-well p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1">
              <span className="font-bold text-sky-300">
                {selectedEntity?.title || 'OCEAN SPATIAL PROBE'}
              </span>
            </div>

            {cursorProbe && (
              <div className="grid grid-cols-2 gap-1.5 bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)] text-[10px]">
                <div>
                  <span className="text-slate-500 block text-[8px]">PROBE LATITUDE</span>
                  <span className="font-bold text-slate-100 tabular-nums">
                    {Math.abs(cursorProbe.lat).toFixed(4)}°{cursorProbe.lat >= 0 ? 'N' : 'S'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[8px]">PROBE LONGITUDE</span>
                  <span className="font-bold text-slate-100 tabular-nums">
                    {Math.abs(cursorProbe.lon).toFixed(4)}°{cursorProbe.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              </div>
            )}

            {selectedEntity?.description && (
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                {selectedEntity.description}
              </p>
            )}

            <div className="text-[9px] text-slate-500 pt-1 border-t border-[var(--border-subtle)]">
              Provenance: {selectedEntity?.source || 'INCOIS Hydrodynamic Spatial Grid'}
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};
