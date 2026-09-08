import React from 'react';
import { X, Radio } from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ShortcutsModal = () => {
  const { isShortcutsModalOpen, toggleShortcutsModal } = useOceanStore();

  if (!isShortcutsModalOpen) return null;

  const categories = [
    {
      name: 'NAVIGATION & VIEWS',
      items: [
        { key: 'H', label: 'Mission Deck', description: 'Global telemetry & situational overview' },
        { key: 'E', label: '3D Explorer', description: 'Volumetric raymarching & Cesium globe' },
        { key: 'A', label: 'Argo Fleet', description: 'In-situ autonomous float profiling array' },
        { key: '1-5', label: 'Camera Locks', description: 'Cinematic, platform lock, ortho, thermocline, iso' },
        { key: 'R', label: 'Reset Camera', description: 'Re-align camera to Indian Ocean basin default' },
      ]
    },
    {
      name: 'TEMPORAL 4D TRANSPORT',
      items: [
        { key: 'Space', label: 'Play / Pause', description: 'Toggle continuous 4D temporal forecast loop' },
        { key: '[', label: 'Step Backward', description: 'Step back to previous 24h forecast timestamp' },
        { key: ']', label: 'Step Forward', description: 'Advance to next 24h forecast timestamp' },
      ]
    },
    {
      name: 'SYSTEM & HUD TOGGLES',
      items: [
        { key: 'C', label: 'Scientific Deck', description: 'Toggle left ocean parameter & colormap rail' },
        { key: 'I', label: 'Data Inspector', description: 'Toggle right telemetry & float inspector rail' },
        { key: 'D', label: 'Diagnostics', description: 'Toggle system health & GPU texture buffer log' },
        { key: 'G', label: 'Lat / Lon Grid', description: 'Toggle geospatial coordinate reference graticule' },
        { key: 'L', label: 'Coordinate Lock', description: 'Open geospatial coordinate targeting dialog' },
        { key: '?', label: 'Help / Keystrokes', description: 'Toggle this key command reference overlay' },
        { key: 'Esc', label: 'Dismiss / Close', description: 'Exit active modal dialog or inspector drawer' },
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleShortcutsModal();
      }}
    >
      <div className="relative w-full max-w-2xl bg-[rgba(4,10,24,0.92)] backdrop-blur-2xl border border-sky-500/25 rounded-2xl p-6 text-white flex flex-col gap-4 shadow-2xl shadow-cyan-950/40 animate-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(6,182,212,0.8)]" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-500/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-white font-mono">
                  HOTKEY & CONTROL MATRIX
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-cyan-300 border border-sky-500/30">
                  SYSTEM READY
                </span>
              </div>
              <p className="text-[11px] text-sky-200/50 mt-0.5 font-sans">
                Quick-access telemetry shortcuts and spatial control keystrokes
              </p>
            </div>
          </div>
          <button
            onClick={toggleShortcutsModal}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-all"
            title="Dismiss overlay (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories */}
        <div className="space-y-4 max-h-[62vh] overflow-y-auto custom-scrollbar pr-1">
          {categories.map((cat) => (
            <div key={cat.name} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300/80">
                  {cat.name}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cat.items.map((sc) => (
                  <div
                    key={sc.key}
                    className="p-2.5 bg-slate-950/60 hover:bg-slate-900/60 transition-colors rounded-xl border border-sky-500/15 flex items-start gap-3 group"
                  >
                    <span className="px-2 py-1 bg-gradient-to-b from-slate-800 to-slate-900 border border-sky-400/30 group-hover:border-cyan-400/60 text-cyan-300 font-mono text-[11px] font-semibold rounded-md shrink-0 min-w-[32px] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.4)]">
                      {sc.key}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-200 group-hover:text-white text-xs transition-colors">
                        {sc.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal leading-tight">
                        {sc.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-sky-500/15 pt-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>OPERATIONAL // INCOIS v4 ENGINE</span>
          </div>
          <span>
            Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-sky-500/30 rounded text-cyan-300 text-[10px]">Esc</kbd> to dismiss
          </span>
        </div>
      </div>
    </div>
  );
};

