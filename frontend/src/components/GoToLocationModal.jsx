import React, { useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { Crosshair, X, Compass, Radio, ArrowRight, AlertTriangle, Globe } from './Icons';
import {
  isInsideModelDomain,
  haversineDistanceKm,
  INDIAN_OCEAN_PRESETS,
  DEFAULT_INDIAN_OCEAN_BOUNDS,
} from '../utils/geography';

export const GoToLocationModal = () => {
  const {
    isGoToLocationOpen,
    toggleGoToLocationModal,
    focusCoordinateInExplorer,
    argoFloats,
  } = useOceanStore();

  const [latInput, setLatInput] = useState('12.83');
  const [lonInput, setLonInput] = useState('69.00');

  if (!isGoToLocationOpen) return null;

  const parsedLat = parseFloat(latInput);
  const parsedLon = parseFloat(lonInput);

  // Global Earth Coordinate Validation: Lat [-90, +90], Lon [-180, +180]
  const isLatValid = !isNaN(parsedLat) && parsedLat >= -90.0 && parsedLat <= 90.0;
  const isLonValid = !isNaN(parsedLon) && parsedLon >= -180.0 && parsedLon <= 180.0;
  const isValid = isLatValid && isLonValid;

  const isInsideModel = isValid && isInsideModelDomain(parsedLat, parsedLon, DEFAULT_INDIAN_OCEAN_BOUNDS);

  // Find nearest Argo float if valid
  let nearestFloat = null;
  let nearestDistKm = Infinity;
  if (isValid && argoFloats && argoFloats.length > 0) {
    argoFloats.forEach((f) => {
      if (f.latest_position) {
        const d = haversineDistanceKm(
          parsedLat,
          parsedLon,
          f.latest_position.latitude,
          f.latest_position.longitude
        );
        if (d < nearestDistKm) {
          nearestDistKm = d;
          nearestFloat = f;
        }
      }
    });
  }

  const handleLocate = () => {
    if (!isValid) return;
    const label = `${parsedLat >= 0 ? `${parsedLat.toFixed(2)}°N` : `${Math.abs(parsedLat).toFixed(2)}°S`}, ${
      parsedLon >= 0 ? `${parsedLon.toFixed(2)}°E` : `${Math.abs(parsedLon).toFixed(2)}°W`
    }`;
    focusCoordinateInExplorer(parsedLat, parsedLon, label);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isValid) {
      handleLocate();
    } else if (e.key === 'Escape') {
      toggleGoToLocationModal();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleGoToLocationModal();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg bg-[rgba(4,10,24,0.92)] backdrop-blur-2xl rounded-2xl border border-sky-500/25 shadow-panel-dark text-white font-mono flex flex-col overflow-hidden animate-fade-slide">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-black/40 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-sky-400 pulse-beacon" />
            <h2 className="text-xs font-bold tracking-wider uppercase text-white">
              GEOSPATIAL COORDINATE TARGETING
            </h2>
          </div>
          <button
            onClick={toggleGoToLocationModal}
            className="text-slate-400 hover:text-white hover:bg-white/10 p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Domain Coverage Status Banner */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-black/40 border border-sky-500/20 rounded-xl text-[11px]">
            <span className="text-slate-400">NUMERICAL DOMAIN BOUNDS:</span>
            <span className="text-amber-300 font-bold">
              30°E — 120°E, 30°S — 30°N
            </span>
          </div>

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 flex items-center justify-between font-semibold">
                <span>LATITUDE (-90° to +90°)</span>
                {!isLatValid && !isNaN(parsedLat) && (
                  <span className="text-rose-400">OUT OF BOUNDS</span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="-90"
                  max="90"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="e.g. 12.83"
                  className={`w-full px-3 py-2 bg-black/40 border rounded-xl text-white font-bold focus:outline-none transition-all ${
                    isLatValid || isNaN(parsedLat)
                      ? 'border-sky-500/30 focus:border-sky-400 focus:ring-1 focus:ring-sky-400'
                      : 'border-rose-500 focus:border-rose-500'
                  }`}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 flex items-center justify-between font-semibold">
                <span>LONGITUDE (-180° to +180°)</span>
                {!isLonValid && !isNaN(parsedLon) && (
                  <span className="text-rose-400">OUT OF BOUNDS</span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="-180"
                  max="180"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  placeholder="e.g. 69.00"
                  className={`w-full px-3 py-2 bg-black/40 border rounded-xl text-white font-bold focus:outline-none transition-all ${
                    isLonValid || isNaN(parsedLon)
                      ? 'border-sky-500/30 focus:border-sky-400 focus:ring-1 focus:ring-sky-400'
                      : 'border-rose-500 focus:border-rose-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Model Coverage Indicator */}
          {isValid && (
            <div className="flex items-center justify-between px-3.5 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-[11px]">
              <span className="text-slate-400">SIMULATION COVERAGE:</span>
              {isInsideModel ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-beacon" />
                  WITHIN INCOIS ROMS MODEL DOMAIN
                </span>
              ) : (
                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  GLOBAL EARTH POINT (EXTERIOR)
                </span>
              )}
            </div>
          )}

          {/* Preset Shortcuts */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Standard Indian Ocean Basin Presets
            </span>
            <div className="grid grid-cols-2 gap-2">
              {INDIAN_OCEAN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setLatInput(p.lat.toFixed(2));
                    setLonInput(p.lon.toFixed(2));
                  }}
                  className="px-3 py-2 bg-black/30 border border-white/[0.08] hover:border-sky-400/50 hover:bg-sky-500/10 rounded-xl text-left text-[11px] text-slate-300 hover:text-white flex items-center justify-between transition-all group"
                >
                  <span className="truncate font-sans font-medium">{p.label}</span>
                  <span className="text-[10px] text-sky-400 font-mono shrink-0 ml-1">
                    {p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Nearest Argo Float Feedback */}
          {nearestFloat && isValid && (
            <div className="p-3 bg-black/40 border border-amber-500/30 rounded-xl text-[11px] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Radio className="w-3.5 h-3.5" />
                <span>NEAREST IN-SITU ARGO PROFILER</span>
              </div>
              <div className="flex items-center justify-between text-slate-200">
                <span>WMO {nearestFloat.platform_number} ({nearestFloat.dac || 'CORIOLIS'})</span>
                <span className="font-bold text-amber-300">
                  {nearestDistKm < 1 ? '< 1 km' : `${Math.round(nearestDistKm)} km away`}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Position: {nearestFloat.latest_position.latitude.toFixed(2)}°N, {nearestFloat.latest_position.longitude.toFixed(2)}°E · Cycles: {nearestFloat.cycle_count || nearestFloat.cycles?.length || 1}
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer Actions ─── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-black/50 border-t border-white/[0.08]">
          <span className="text-[10px] text-slate-400 font-sans">Press ENTER to jump, ESC to cancel</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleGoToLocationModal}
              className="px-3.5 py-1.5 border border-white/[0.08] hover:bg-white/10 rounded-xl text-slate-300 text-xs transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleLocate}
              disabled={!isValid}
              className={`px-4 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                isValid
                  ? 'bg-sky-500/30 border-sky-400/60 text-sky-200 hover:bg-sky-500/40 hover:text-white shadow-glow-cyan-sm cursor-pointer'
                  : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <span>NAVIGATE GLOBE</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};