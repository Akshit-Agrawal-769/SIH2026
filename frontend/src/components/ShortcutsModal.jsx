import React from 'react';
import { X, Sliders, Radio, Compass } from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ShortcutsModal = () => {
  const { isShortcutsModalOpen, toggleShortcutsModal } = useOceanStore();

  if (!isShortcutsModalOpen) return null;

  const shortcuts = [
    { key: '1', label: 'Cinematic Camera', description: 'Low-horizon perspective across ocean swell' },
    { key: '2', label: 'Platform Camera', description: 'Target lock on moored intelligence station' },
    { key: '3', label: 'Geospatial Camera', description: 'Tactical top-down North-Up geospatial plan' },
    { key: '4', label: 'Subsurface Camera', description: 'Underwater thermocline depth profiling view' },
    { key: '5', label: '3D ISO Camera', description: 'Standard 3D isometric overview' },
    { key: 'Space', label: 'Play / Pause', description: 'Toggle 4D temporal forecast playback' },
    { key: '[', label: 'Step Back', description: 'Step to previous 24h forecast timestamp' },
    { key: ']', label: 'Step Forward', description: 'Step to next 24h forecast timestamp' },
    { key: 'L', label: 'Layers & Controls', description: 'Toggle left scientific controls & layers rail' },
    { key: 'I', label: 'Data Inspector', description: 'Toggle right telemetry & float inspector rail' },
    { key: 'D', label: 'Diagnostics', description: 'Toggle system & NetCDF diagnostics drawer' },
    { key: '?', label: 'Help / Shortcuts', description: 'Toggle this keyboard shortcuts reference' },
    { key: 'Esc', label: 'Close / Deselect', description: 'Dismiss active dialogs or close panels' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 select-none">
      <div className="relative w-full max-w-2xl bg-[#080e1a] border border-[#1e293b] p-4 text-slate-100 flex flex-col gap-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
          <div className="flex items-center gap-2 font-mono">
            <Radio className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              OPERATIONAL KEYBOARD SHORTCUTS & CONTROLS
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
              <span className="px-2 py-0.5 bg-[#070c18] border border-sky-500/60 text-sky-300 font-bold rounded-none shrink-0 min-w-[28px] text-center">
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
          <span>INCOIS 3D Ocean Intelligence Operations Platform</span>
          <span>Press <kbd className="px-1 bg-[#0c1424] border border-[#1e293b] text-slate-300">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
