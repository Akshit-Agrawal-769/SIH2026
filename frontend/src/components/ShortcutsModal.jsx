import React from 'react';
import { X, Radio } from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ShortcutsModal = () => {
  const { isShortcutsModalOpen, toggleShortcutsModal } = useOceanStore();

  if (!isShortcutsModalOpen) return null;

  const shortcuts = [
    { key: 'H', label: 'Mission Control', description: 'Switch to Mission Control overview dashboard' },
    { key: 'E', label: '3D Explorer', description: 'Switch to interactive 3D Earth & Ocean Explorer' },
    { key: 'A', label: 'Argo In-Situ', description: 'Switch to Argo Profiling Float Network' },
    { key: '1', label: 'Cinematic View', description: 'Low-horizon camera view across ocean swell' },
    { key: '2', label: 'Platform Lock', description: 'Target camera lock on moored marine station' },
    { key: '3', label: 'Geospatial View', description: 'Tactical top-down North-Up geospatial plan' },
    { key: '4', label: 'Subsurface View', description: 'Underwater thermocline depth profiling view' },
    { key: '5', label: '3D Isometric', description: 'Standard 3D isometric overview' },
    { key: 'Space', label: 'Play / Pause', description: 'Toggle 4D temporal forecast playback' },
    { key: '[', label: 'Step Back', description: 'Step to previous 24h forecast timestep' },
    { key: ']', label: 'Step Forward', description: 'Step to next 24h forecast timestep' },
    { key: 'C', label: 'Controls Panel', description: 'Toggle left scientific controls & layers rail' },
    { key: 'I', label: 'Data Inspector', description: 'Toggle right telemetry & float inspector rail' },
    { key: 'D', label: 'Diagnostics', description: 'Toggle system health & NetCDF diagnostics drawer' },
    { key: 'G', label: 'Lat/Lon Grid', description: 'Toggle geospatial spherical coordinate grid' },
    { key: 'L', label: 'Go To Location', description: 'Open geospatial coordinate targeting dialog' },
    { key: 'R', label: 'Reset Camera', description: 'Reset 3D camera to default orientation' },
    { key: '?', label: 'Help / Shortcuts', description: 'Toggle this keyboard shortcuts reference' },
    { key: 'Esc', label: 'Close / Dismiss', description: 'Dismiss active modal dialogs or drawers' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleShortcutsModal();
      }}
    >
      <div className="relative w-full max-w-2xl bg-[#080e1a] border border-[#1e293b] p-4 text-slate-100 flex flex-col gap-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
          <div className="flex items-center gap-2 font-mono">
            <Radio className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              OPERATIONAL KEYBOARD SHORTCUTS & NAVIGATION
            </h2>
          </div>
          <button
            onClick={toggleShortcutsModal}
            className="p-1 bg-[#0c1424] border border-[#1e293b] text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[65vh] overflow-y-auto custom-scrollbar font-mono text-xs">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="p-2 bg-[#0b1322] border border-[#1e293b] flex items-start gap-2.5">
              <span className="px-2 py-0.5 bg-[#070c18] border border-sky-500/60 text-sky-300 font-bold rounded-none shrink-0 min-w-[32px] text-center text-[11px]">
                {sc.key}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-200 text-[11px]">{sc.label}</span>
                <span className="text-[10px] text-slate-400">{sc.description}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#1e293b] pt-2 text-[10px] font-mono text-slate-500">
          <span>INCOIS 3D Ocean Intelligence Platform</span>
          <span>Press <kbd className="px-1 bg-[#0c1424] border border-[#1e293b] text-slate-300">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
