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
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Page Title Header */}
        <div className="flex flex-col gap-1 border-b border-[#1e293b] pb-4">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold tracking-widest text-teal-400 uppercase">
              GEOSPATIAL SPATIAL INDEXING
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
            Indian Ocean Coordinate Explorer
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl">
            Input precise geographic coordinates to resolve model grid indices, compute distance to the nearest in-situ Argo profiling float, and inspect localized ocean dynamics.
          </p>
        </div>

        {/* Main 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Presets (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Input Card */}
            <div className="p-5 bg-[#080e1a] border border-teal-500/40 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                  Target Coordinate Entry
                </span>
                <span className="text-[10px] text-slate-400">
                  Domain: [{bounds.minLat.toFixed(0)}°S to {bounds.maxLat.toFixed(0)}°N, {bounds.minLon.toFixed(0)}°E to {bounds.maxLon.toFixed(0)}°E]
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>LATITUDE (°N / °S)</span>
                    {!isValid && !isNaN(parsedLat) && (parsedLat < bounds.minLat || parsedLat > bounds.maxLat) && (
                      <span className="text-red-400 text-[10px]">[{bounds.minLat}° to {bounds.maxLat}°]</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="12.83"
                    className={`w-full px-3 py-2 bg-[#0c1424] border text-slate-100 font-bold text-sm focus:outline-none focus:ring-1 ${
                      isValid || isNaN(parsedLat)
                        ? 'border-[#1e293b] focus:border-teal-500 focus:ring-teal-500'
                        : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    }`}
                  />
                  <span className="text-[9px] text-slate-500">Positive = North, Negative = South</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>LONGITUDE (°E)</span>
                    {!isValid && !isNaN(parsedLon) && (parsedLon < bounds.minLon || parsedLon > bounds.maxLon) && (
                      <span className="text-red-400 text-[10px]">[{bounds.minLon}° to {bounds.maxLon}°]</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={lonInput}
                    onChange={(e) => setLonInput(e.target.value)}
                    placeholder="69.00"
                    className={`w-full px-3 py-2 bg-[#0c1424] border text-slate-100 font-bold text-sm focus:outline-none focus:ring-1 ${
                      isValid || isNaN(parsedLon)
                        ? 'border-[#1e293b] focus:border-teal-500 focus:ring-teal-500'
                        : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    }`}
                  />
                  <span className="text-[9px] text-slate-500">Eastern Hemisphere degrees</span>
                </div>
              </div>

              {/* Validation error if any */}
              {!isValid && validation.error && (
                <div className="text-[11px] text-red-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
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
                className={`w-full py-2.5 px-4 border text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all ${
                  isValid
                    ? 'bg-teal-600 hover:bg-teal-500 border-teal-400 text-white shadow-lg shadow-teal-950/50 cursor-pointer'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>OPEN TARGET IN 3D OCEAN EXPLORER</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Presets List */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
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
                    className="p-3 bg-[#080e1a] border border-[#1e293b] hover:border-teal-500/60 hover:bg-[#0c1424] cursor-pointer transition-all flex flex-col gap-1 group"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200 group-hover:text-teal-300 transition-colors">
                      <span>{p.label}</span>
                      <span className="text-[10px] text-teal-400 font-mono">
                        {p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
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
            <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                <Database className="w-4 h-4 text-sky-400" />
                <span>MODEL GRID INTERPOLATION</span>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
                  <span className="text-slate-400">Target Location:</span>
                  <span className="text-slate-100 font-bold">
                    {isValid ? `${parsedLat.toFixed(2)}°N, ${parsedLon.toFixed(2)}°E` : 'INVALID'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
                  <span className="text-slate-400">Nearest Grid Point:</span>
                  <span className="text-teal-300 font-bold">
                    {isValid ? `${nearestLat.toFixed(2)}°N, ${nearestLon.toFixed(2)}°E` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
                  <span className="text-slate-400">Cell Offset Distance:</span>
                  <span className="text-slate-200 font-bold">
                    {isValid ? `${gridCellDistKm.toFixed(2)} km` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
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
            <div className="p-4 bg-[#080e1a] border border-amber-500/40 flex flex-col gap-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span>NEAREST IN-SITU ARGO PROFILER</span>
                </div>
                {nearestFloat && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-950 border border-amber-500/50 text-amber-300 font-bold">
                    WMO {nearestFloat.platform_number}
                  </span>
                )}
              </div>

              {nearestFloat && isValid ? (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
                    <span className="text-slate-400">Distance to Target:</span>
                    <span className="text-amber-300 font-bold text-sm">
                      {nearestDistKm < 1 ? '< 1 km' : `${Math.round(nearestDistKm)} km`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
                    <span className="text-slate-400">Float Position:</span>
                    <span className="text-slate-200 font-bold">
                      {nearestFloat.latest_position.latitude.toFixed(2)}°N, {nearestFloat.latest_position.longitude.toFixed(2)}°E
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
                    <span className="text-slate-400">Data Assembly Centre:</span>
                    <span className="text-slate-200">{nearestFloat.dac || 'CORIOLIS'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#141e33]">
                    <span className="text-slate-400">Available Cycles:</span>
                    <span className="text-slate-200 font-bold">
                      {nearestFloat.cycle_count || nearestFloat.cycles?.length || 1} Profiles
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400">Quality Control:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>QC Flags 1 & 2 Accepted</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs">
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