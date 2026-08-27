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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleShortcutsModal();
      }}
    >
      <div className="relative w-full max-w-2xl glass-panel rounded-2xl p-5 text-white/90 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-white/70" />
            <h2 className="text-xs font-medium tracking-wide uppercase text-white">
              Keyboard Shortcuts & Controls
            </h2>
          </div>
          <button
            onClick={toggleShortcutsModal}
            className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[65vh] overflow-y-auto custom-scrollbar text-xs">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="p-2.5 bg-black/30 rounded-xl border border-white/[0.05] flex items-start gap-3">
              <span className="px-2 py-0.5 bg-white/10 border border-white/15 text-white font-mono text-[11px] rounded-md shrink-0 min-w-[28px] text-center shadow-inner">
                {sc.key}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-normal text-white/90 text-xs">{sc.label}</span>
                <span className="text-[10px] text-white/40 font-light">{sc.description}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-2 text-[10px] font-mono text-white/40">
          <span>INCOIS 3D Ocean Intelligence Platform</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/15 rounded text-white/80">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
