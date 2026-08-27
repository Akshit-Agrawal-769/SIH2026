import React from 'react';
import { X, Keyboard, HelpCircle } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ShortcutsModal = () => {
  const { isShortcutsModalOpen, toggleShortcutsModal } = useOceanStore();

  if (!isShortcutsModalOpen) return null;

  const shortcuts = [
    { key: 'V', label: 'Cycle Variable', description: 'Cycle through model variables (Temp → Salt → U → V)' },
    { key: '↑ / ↓', label: 'Step Depth Level', description: 'Step vertical depth level up or down' },
    { key: '← / →', label: 'Step Timeline', description: 'Step previous or next model time step' },
    { key: 'Space', label: 'Play / Pause', description: 'Toggle 4D temporal forecast animation playback' },
    { key: '1', label: 'Fit Global Earth', description: 'Center and fit 3D planetary Earth sphere' },
    { key: '2', label: 'Indian Ocean View', description: 'Focus Indian Ocean synoptic basin (10°N, 75°E)' },
    { key: '3', label: 'Arabian Sea', description: 'Zoom to high-resolution Arabian Sea sector' },
    { key: '4', label: 'Bay of Bengal', description: 'Zoom to high-resolution Bay of Bengal sector' },
    { key: '5 / R', label: 'Reset Orientation', description: 'Reset 3D camera to default orientation' },
    { key: 'H / E', label: 'Explore 3D', description: 'Switch to primary 3D Ocean Explorer' },
    { key: 'A', label: 'Argo Observations', description: 'Switch to In-Situ Argo Profiling Float workspace' },
    { key: 'C', label: '4D Comparison', description: 'Switch to Model vs Observation Comparison workspace' },
    { key: 'L', label: 'Go To Location', description: 'Open geospatial coordinate targeting dialog' },
    { key: 'D', label: 'Diagnostics', description: 'Toggle system telemetry and WebGL diagnostics drawer' },
    { key: '?', label: 'Shortcuts Reference', description: 'Toggle this keyboard reference dialog' },
    { key: 'Esc', label: 'Dismiss / Clear', description: 'Dismiss modal dialogs or clear float selection' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleShortcutsModal();
      }}
    >
      <div className="relative w-full max-w-2xl bg-[var(--surface-rack-backdrop)] backdrop-blur-md border border-[var(--border-hairline)] rounded-sm p-4 text-slate-200 flex flex-col gap-3.5 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-sky-400" strokeWidth={1.75} />
            <h2 className="text-xs font-bold tracking-wider uppercase text-slate-100">
              Keyboard Shortcuts & Instrumentation Controls
            </h2>
          </div>
          <button
            onClick={toggleShortcutsModal}
            className="p-1 text-slate-400 hover:text-white hover:bg-[var(--surface-well)] rounded-[2px] transition-colors"
            title="Close Dialog (Esc)"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="p-2 bg-[var(--surface-well)] rounded-[2px] border border-[var(--border-hairline)] flex items-start gap-2.5">
              <span className="px-1.5 py-0.5 bg-[var(--surface-base)] border border-[var(--border-medium)] text-sky-300 font-bold text-[10px] rounded-[2px] shrink-0 min-w-[28px] text-center">
                {sc.key}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-100 text-[11px]">{sc.label}</span>
                <span className="text-[10px] text-slate-400 font-sans">{sc.description}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2 text-[10px] text-slate-500">
          <span>INCOIS Ocean Systems · Scientific Workstation</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-[var(--surface-base)] border border-[var(--border-hairline)] text-slate-300 rounded-[2px]">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
