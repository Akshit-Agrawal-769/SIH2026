import React, { useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { Crosshair, X, Compass, Radio, ArrowRight, AlertTriangle, Globe } from 'lucide-react';
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
    metadata,
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

  const bounds = metadata?.bounds
    ? {
        minLon: metadata.bounds.min_lon,
        maxLon: metadata.bounds.max_lon,
        minLat: metadata.bounds.min_lat,
        maxLat: metadata.bounds.max_lat,
      }
    : DEFAULT_INDIAN_OCEAN_BOUNDS;

  const isInsideModel = isValid && isInsideModelDomain(parsedLat, parsedLon, bounds);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleGoToLocationModal();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg bg-[var(--surface-rack-backdrop)] backdrop-blur-md border border-[var(--border-hairline)] rounded-sm shadow-2xl text-slate-200 font-mono text-xs flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface-header)] border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" strokeWidth={1.75} />
            <span className="font-bold tracking-wider uppercase text-xs text-slate-100">
              Target Geographic Coordinates
            </span>
          </div>
          <button
            onClick={toggleGoToLocationModal}
            className="text-slate-400 hover:text-white hover:bg-[var(--surface-well)] p-1 rounded-[2px] transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5">
          {/* Domain Coverage Status Banner */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-well)] border border-[var(--border-hairline)] text-[10px]">
            <span className="text-slate-400">ACTIVE MODEL DOMAIN:</span>
            <span className="text-sky-300 font-bold">
              {bounds.minLon.toFixed(0)}°E—{bounds.maxLon.toFixed(0)}°E, {bounds.minLat.toFixed(0)}°N—{bounds.maxLat.toFixed(0)}°N
            </span>
          </div>

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>LATITUDE (-90° to +90°)</span>
                {!isLatValid && !isNaN(parsedLat) && (
                  <span className="text-rose-400 font-bold">INVALID</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="-90"
                max="90"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="e.g. 12.83"
                className={`w-full px-3 py-1.5 bg-[var(--surface-base)] border font-mono text-xs text-slate-100 font-bold focus:outline-none ${
                  isLatValid || isNaN(parsedLat)
                    ? 'border-[var(--border-hairline)] focus:border-sky-400'
                    : 'border-rose-500 text-rose-300'
                }`}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>LONGITUDE (-180° to +180°)</span>
                {!isLonValid && !isNaN(parsedLon) && (
                  <span className="text-rose-400 font-bold">INVALID</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="-180"
                max="180"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                placeholder="e.g. 69.00"
                className={`w-full px-3 py-1.5 bg-[var(--surface-base)] border font-mono text-xs text-slate-100 font-bold focus:outline-none ${
                  isLonValid || isNaN(parsedLon)
                    ? 'border-[var(--border-hairline)] focus:border-sky-400'
                    : 'border-rose-500 text-rose-300'
                }`}
              />
            </div>
          </div>

          {/* Model Coverage Indicator */}
          {isValid && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-well)] border border-[var(--border-hairline)] text-[10px]">
              <span className="text-slate-400">DOMAIN VERIFICATION:</span>
              {isInsideModel ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  INSIDE ROMS NUMERICAL GRID
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  GLOBAL POINT (OUTSIDE REGIONAL ROMS)
                </span>
              )}
            </div>
          )}

          {/* Standard Oceanographic Presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Standard Indian Ocean Regimes
            </span>
            <div className="grid grid-cols-2 gap-1">
              {INDIAN_OCEAN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setLatInput(p.lat.toFixed(2));
                    setLonInput(p.lon.toFixed(2));
                  }}
                  className="px-2.5 py-1.5 bg-[var(--surface-base)] border border-[var(--border-hairline)] hover:border-sky-400 hover:text-sky-300 text-left text-[10px] text-slate-300 flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{p.label}</span>
                  <span className="text-[9px] text-slate-500 shrink-0 ml-1">
                    {p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Nearest Argo Float Feedback */}
          {nearestFloat && isValid && (
            <div className="p-2 bg-[var(--surface-well)] border border-amber-500/40 text-[10px] flex flex-col gap-1">
              <div className="flex items-center justify-between text-amber-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>NEAREST IN-SITU ARGO PROFILER</span>
                </span>
                <span>{nearestDistKm < 1 ? '< 1 km away' : `${Math.round(nearestDistKm)} km away`}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>WMO {nearestFloat.platform_number} ({nearestFloat.dac || 'CORIOLIS'})</span>
                <span className="text-slate-400 font-mono">
                  {nearestFloat.latest_position?.latitude?.toFixed(2)}°N, {nearestFloat.latest_position?.longitude?.toFixed(2)}°E
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface-header)] border-t border-[var(--border-hairline)]">
          <span className="text-[10px] text-slate-500">Press ENTER to target, ESC to cancel</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleGoToLocationModal}
              className="px-3 py-1 bg-[var(--surface-well)] border border-[var(--border-hairline)] hover:bg-[var(--surface-well-hover)] text-slate-300 text-[11px] rounded-[2px] transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleLocate}
              disabled={!isValid}
              className={`px-3.5 py-1 text-[11px] font-bold rounded-[2px] flex items-center gap-1.5 transition-all ${
                isValid
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-md cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>TARGET COORDINATES</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};