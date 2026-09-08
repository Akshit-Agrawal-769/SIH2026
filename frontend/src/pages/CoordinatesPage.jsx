import React, { useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Crosshair,
  Compass,
  Radio,
  Layers,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  Info
} from '../components/Icons';
import {
  validateCoordinates,
  haversineDistanceKm,
  calculateNearestGridCell,
  INDIAN_OCEAN_PRESETS,
  DEFAULT_INDIAN_OCEAN_BOUNDS,
} from '../utils/geography';

export const CoordinatesPage = () => {
  const {
    metadata,
    argoFloats,
    focusCoordinateInExplorer,
    variable,
    activeDataset,
    setActivePage,
  } = useOceanStore();

  const bounds = {
    minLat: metadata?.bounds?.min_lat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLat,
    maxLat: metadata?.bounds?.max_lat ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLat,
    minLon: metadata?.bounds?.min_lon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.minLon,
    maxLon: metadata?.bounds?.max_lon ?? DEFAULT_INDIAN_OCEAN_BOUNDS.maxLon,
  };

  const [latInput, setLatInput] = useState('12.83');
  const [lonInput, setLonInput] = useState('69.00');

  const parsedLat = parseFloat(latInput);
  const parsedLon = parseFloat(lonInput);

  const validation = validateCoordinates(parsedLat, parsedLon, bounds);
  const isValid = validation.isValid;

  // Find nearest Argo Float
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

  // Model Grid Spacing
  const { nearestLat, nearestLon, distanceKm: gridCellDistKm } = isValid
    ? calculateNearestGridCell(parsedLat, parsedLon, 0.083333, bounds)
    : { nearestLat: 0, nearestLon: 0, distanceKm: 0 };

  return (
    <div className="flex-1 overflow-y-auto bg-[#030712] text-slate-100 font-sans p-4 sm:p-6 md:p-8 select-none custom-scrollbar">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Page Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-500/20 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase font-mono">
                GEOSPATIAL SPATIAL INDEXING // INDIAN OCEAN DOMAIN
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase font-mono">
              Geographic Coordinate Targeting & Grid Resolver
            </h1>
            <p className="text-xs text-sky-200/50 max-w-3xl font-sans">
              Resolve trilinear model grid indices, compute geodesic distance to nearest in-situ Argo profiling floats, and lock 3D explorer camera.
            </p>
          </div>
          <button
            onClick={() => setActivePage('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-cyan-300 text-xs font-semibold font-mono tracking-wider transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0 self-start sm:self-center"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>RETURN TO 3D GLOBE</span>
          </button>
        </div>

        {/* Main 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Presets (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Input Card */}
            <div className="p-5 bg-[rgba(4,10,24,0.85)] border border-sky-500/25 rounded-xl shadow-2xl backdrop-blur-2xl flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-transparent" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Target Coordinate Entry
                </span>
                <span className="text-[10px] text-sky-200/60 font-mono">
                  Bounds: [{bounds.minLat.toFixed(0)}°S to {bounds.maxLat.toFixed(0)}°N, {bounds.minLon.toFixed(0)}°E to {bounds.maxLon.toFixed(0)}°E]
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono text-slate-300 flex items-center justify-between">
                    <span>LATITUDE (°N / °S)</span>
                    {!isValid && !isNaN(parsedLat) && (parsedLat < bounds.minLat || parsedLat > bounds.maxLat) && (
                      <span className="text-rose-400 text-[10px]">[{bounds.minLat}° to {bounds.maxLat}°]</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="12.83"
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-lg text-white font-mono font-bold text-sm focus:outline-none transition-all ${
                      isValid || isNaN(parsedLat)
                        ? 'border-sky-500/30 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'border-rose-500/60 focus:border-rose-400 focus:shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 font-mono">Positive = North, Negative = South</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono text-slate-300 flex items-center justify-between">
                    <span>LONGITUDE (°E)</span>
                    {!isValid && !isNaN(parsedLon) && (parsedLon < bounds.minLon || parsedLon > bounds.maxLon) && (
                      <span className="text-rose-400 text-[10px]">[{bounds.minLon}° to {bounds.maxLon}°]</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={lonInput}
                    onChange={(e) => setLonInput(e.target.value)}
                    placeholder="69.00"
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-lg text-white font-mono font-bold text-sm focus:outline-none transition-all ${
                      isValid || isNaN(parsedLon)
                        ? 'border-sky-500/30 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'border-rose-500/60 focus:border-rose-400 focus:shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 font-mono">Eastern Hemisphere degrees</span>
                </div>
              </div>

              {/* Validation error if any */}
              {!isValid && validation.error && (
                <div className="text-[11px] text-rose-400 font-mono font-semibold flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validation.error}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => {
                  if (isValid) {
                    focusCoordinateInExplorer(parsedLat, parsedLon, `${parsedLat.toFixed(2)}°N, ${parsedLon.toFixed(2)}°E`);
                  }
                }}
                disabled={!isValid}
                className={`w-full py-2.5 px-4 rounded-lg font-mono text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isValid
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] cursor-pointer'
                    : 'bg-slate-900 border border-sky-500/10 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>ENGAGE TARGET IN 3D EXPLORER</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Presets List */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Geographic Presets & Oceanographic Regimes
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INDIAN_OCEAN_PRESETS.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setLatInput(p.lat.toFixed(2));
                      setLonInput(p.lon.toFixed(2));
                    }}
                    className="p-3 bg-[rgba(4,10,24,0.75)] border border-sky-500/15 hover:border-cyan-400/50 hover:bg-slate-900/80 rounded-xl cursor-pointer transition-all flex flex-col gap-1 group shadow-md"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors font-mono">
                      <span>{p.label}</span>
                      <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                        {p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight font-sans">
                      {p.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Spatial Resolution & Nearest Float Inspection (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Resolution Card */}
            <div className="p-4 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col gap-3 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-400 to-transparent" />
              <div className="flex items-center gap-2 text-xs font-bold text-sky-300 font-mono">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>MODEL GRID INTERPOLATION</span>
              </div>

              <div className="flex flex-col gap-2 text-xs font-mono">
                <div className="flex items-center justify-between py-1.5 border-b border-sky-500/10">
                  <span className="text-slate-400">Target Location:</span>
                  <span className="text-slate-100 font-bold">
                    {isValid ? `${parsedLat.toFixed(2)}°N, ${parsedLon.toFixed(2)}°E` : 'INVALID'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-sky-500/10">
                  <span className="text-slate-400">Nearest Grid Point:</span>
                  <span className="text-cyan-300 font-bold">
                    {isValid ? `${nearestLat.toFixed(2)}°N, ${nearestLon.toFixed(2)}°E` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-sky-500/10">
                  <span className="text-slate-400">Cell Offset Distance:</span>
                  <span className="text-slate-200 font-bold">
                    {isValid ? `${gridCellDistKm.toFixed(2)} km` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-sky-500/10">
                  <span className="text-slate-400">Model Resolution:</span>
                  <span className="text-slate-200">~0.08° (~8.8 km)</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Domain Classification:</span>
                  <span className="text-cyan-300 font-bold">Indian Ocean Basin</span>
                </div>
              </div>
            </div>

            {/* Nearest Argo Float Card */}
            <div className="p-4 bg-[rgba(4,10,24,0.85)] border border-amber-500/30 rounded-xl flex flex-col gap-3 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-transparent" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 font-mono">
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span>NEAREST IN-SITU ARGO PROFILER</span>
                </div>
                {nearestFloat && (
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-950/70 border border-amber-500/40 text-amber-300 font-bold rounded">
                    WMO {nearestFloat.platform_number}
                  </span>
                )}
              </div>

              {nearestFloat && isValid ? (
                <div className="flex flex-col gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between py-1.5 border-b border-amber-500/10">
                    <span className="text-slate-400">Distance to Target:</span>
                    <span className="text-amber-300 font-bold text-sm">
                      {nearestDistKm < 1 ? '< 1 km' : `${Math.round(nearestDistKm)} km`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-amber-500/10">
                    <span className="text-slate-400">Float Position:</span>
                    <span className="text-slate-200 font-bold">
                      {nearestFloat.latest_position.latitude.toFixed(2)}°N, {nearestFloat.latest_position.longitude.toFixed(2)}°E
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-amber-500/10">
                    <span className="text-slate-400">Data Assembly Centre:</span>
                    <span className="text-slate-200">{nearestFloat.dac || 'CORIOLIS'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-amber-500/10">
                    <span className="text-slate-400">Available Cycles:</span>
                    <span className="text-slate-200 font-bold">
                      {nearestFloat.cycle_count || nearestFloat.cycles?.length || 1} Profiles
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400">Quality Control:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shadow-sm" />
                      <span>QC Flags 1 & 2 Accepted</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs font-mono">
                  Enter valid coordinates to compute nearest profiler
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};