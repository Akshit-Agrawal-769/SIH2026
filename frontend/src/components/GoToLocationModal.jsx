import React, { useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { Crosshair, X, Compass, Radio, ArrowRight, AlertTriangle, Globe } from './Icons';
import {
  isInsideModelDomain,
  haversineDistanceKm,
  INDIAN_OCEAN_PRESETS,
  DEFAULT_INDIAN_OCEAN_BOUNDS
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm select-none p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleGoToLocationModal();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg bg-[#080e1a] border border-cyan-500/60 shadow-2xl text-slate-200 font-mono flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0c1424] border-b border-[#1e293b]">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="font-bold tracking-wider text-xs text-cyan-300">
              3D EARTH COORDINATE NAVIGATION
            </span>
          </div>
          <button
            onClick={toggleGoToLocationModal}
            className="text-slate-400 hover:text-slate-100 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4 text-xs">
          {/* Domain Coverage Status Banner */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#040814] border border-[#1e293b] text-[11px]">
            <span className="text-slate-400">INCOIS MODEL BOUNDS:</span>
            <span className="text-amber-300 font-bold">
              30°E—120°E, 30°S—30°N
            </span>
          </div>

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>LATITUDE (-90° to +90°)</span>
                {!isLatValid && !isNaN(parsedLat) && (
                  <span className="text-red-400">INVALID LAT</span>
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
                  className={`w-full px-3 py-2 bg-[#0c1424] border text-slate-100 font-bold focus:outline-none focus:ring-1 ${
                    isLatValid || isNaN(parsedLat)
                      ? 'border-[#1e293b] focus:border-cyan-500 focus:ring-cyan-500'
                      : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  }`}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>LONGITUDE (-180° to +180°)</span>
                {!isLonValid && !isNaN(parsedLon) && (
                  <span className="text-red-400">INVALID LON</span>
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
                  className={`w-full px-3 py-2 bg-[#0c1424] border text-slate-100 font-bold focus:outline-none focus:ring-1 ${
                    isLonValid || isNaN(parsedLon)
                      ? 'border-[#1e293b] focus:border-cyan-500 focus:ring-cyan-500'
                      : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Model Coverage Indicator */}
          {isValid && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0c1424] border border-[#1e293b] text-[11px]">
              <span className="text-slate-400">REGIONAL SIMULATION STATUS:</span>
              {isInsideModel ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  INSIDE INCOIS NUMERICAL MODEL COVERAGE
                </span>
              ) : (
                <span className="text-slate-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  GLOBAL EARTH POINT (OUTSIDE INCOIS ROMS)
                </span>
              )}
            </div>
          )}

          {/* Preset Shortcuts */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Standard Indian Ocean Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {INDIAN_OCEAN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setLatInput(p.lat.toFixed(2));
                    setLonInput(p.lon.toFixed(2));
                  }}
                  className="px-2.5 py-1.5 bg-[#0c1424] border border-[#1e293b] hover:border-cyan-500 hover:text-cyan-300 text-left text-[11px] text-slate-300 flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{p.label}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                    {p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Nearest Argo Float Feedback */}
          {nearestFloat && isValid && (
            <div className="p-2.5 bg-[#040814] border border-amber-500/40 text-[11px] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Radio className="w-3.5 h-3.5" />
                <span>NEAREST IN-SITU ARGO PROFILER</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>WMO {nearestFloat.platform_number} ({nearestFloat.dac || 'CORIOLIS'})</span>
                <span className="font-bold text-amber-300">
                  {nearestDistKm < 1 ? '< 1 km' : `${Math.round(nearestDistKm)} km away`}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                Position: {nearestFloat.latest_position.latitude.toFixed(2)}°N, {nearestFloat.latest_position.longitude.toFixed(2)}°E · Cycles: {nearestFloat.cycle_count || nearestFloat.cycles?.length || 1}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0c1424] border-t border-[#1e293b]">
          <span className="text-[10px] text-slate-500">Press ENTER to jump, ESC to cancel</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleGoToLocationModal}
              className="px-3 py-1.5 border border-[#1e293b] hover:bg-[#1e293b] text-slate-400 text-xs transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleLocate}
              disabled={!isValid}
              className={`px-4 py-1.5 border text-xs font-bold flex items-center gap-1.5 transition-all ${
                isValid
                  ? 'bg-cyan-600 border-cyan-400 text-white hover:bg-cyan-500 shadow-md shadow-cyan-900/50 cursor-pointer'
                  : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>ROTATE GLOBE TO COORDINATES</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};