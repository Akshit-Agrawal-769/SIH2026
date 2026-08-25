import React, { useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { Crosshair, X, Compass, Radio, ArrowRight, AlertTriangle } from './Icons';

// Haversine distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const GoToLocationModal = () => {
  const {
    isGoToLocationOpen,
    toggleGoToLocationModal,
    focusCoordinateInExplorer,
    metadata,
    argoFloats,
  } = useOceanStore();

  const minLat = metadata?.bounds?.min_lat ?? -30.0;
  const maxLat = metadata?.bounds?.max_lat ?? 30.0;
  const minLon = metadata?.bounds?.min_lon ?? 30.0;
  const maxLon = metadata?.bounds?.max_lon ?? 120.0;

  const [latInput, setLatInput] = useState('12.83');
  const [lonInput, setLonInput] = useState('69.00');

  if (!isGoToLocationOpen) return null;

  const parsedLat = parseFloat(latInput);
  const parsedLon = parseFloat(lonInput);
  const isLatValid = !isNaN(parsedLat) && parsedLat >= minLat && parsedLat <= maxLat;
  const isLonValid = !isNaN(parsedLon) && parsedLon >= minLon && parsedLon <= maxLon;
  const isValid = isLatValid && isLonValid;

  // Find nearest Argo float if valid
  let nearestFloat = null;
  let nearestDistKm = Infinity;
  if (isValid && argoFloats && argoFloats.length > 0) {
    argoFloats.forEach((f) => {
      if (f.latest_position) {
        const d = haversineDistance(
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

  const presets = [
    { label: 'Arabian Sea (High Resolution)', lat: 12.83, lon: 69.00 },
    { label: 'Bay of Bengal Deep Basin', lat: 13.69, lon: 88.07 },
    { label: 'Equatorial Indian Ocean', lat: 0.00, lon: 80.00 },
    { label: 'SW Domain Boundary', lat: -30.00, lon: 30.00 },
    { label: 'NE Domain Boundary', lat: 30.00, lon: 120.00 },
    { label: 'Somali Current / Horn of Africa', lat: 8.50, lon: 52.00 },
  ];

  const handleLocate = () => {
    if (!isValid) return;
    focusCoordinateInExplorer(parsedLat, parsedLon, `${parsedLat.toFixed(2)}°N, ${parsedLon.toFixed(2)}°E`);
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
      <div className="w-full max-w-lg bg-[#080e1a] border border-sky-500/60 shadow-2xl text-slate-200 font-mono flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0c1424] border-b border-[#1e293b]">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-sky-400" />
            <span className="font-bold tracking-wider text-xs text-sky-300">
              GEOSPATIAL COORDINATE TARGETING
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
          {/* Domain Notice */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#040814] border border-[#1e293b] text-[11px] text-slate-400">
            <span>DOMAIN LIMITS:</span>
            <span className="text-slate-200 font-bold">
              Lat [{minLat.toFixed(1)}°, {maxLat.toFixed(1)}°] · Lon [{minLon.toFixed(1)}°, {maxLon.toFixed(1)}°]
            </span>
          </div>

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>LATITUDE (°N / °S)</span>
                {!isLatValid && <span className="text-red-400">OUT OF BOUNDS</span>}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="e.g. 12.83"
                  className={`w-full px-3 py-2 bg-[#0c1424] border text-slate-100 font-bold focus:outline-none focus:ring-1 ${
                    isLatValid
                      ? 'border-[#1e293b] focus:border-sky-500 focus:ring-sky-500'
                      : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  }`}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>LONGITUDE (°E)</span>
                {!isLonValid && <span className="text-red-400">OUT OF BOUNDS</span>}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  placeholder="e.g. 69.00"
                  className={`w-full px-3 py-2 bg-[#0c1424] border text-slate-100 font-bold focus:outline-none focus:ring-1 ${
                    isLonValid
                      ? 'border-[#1e293b] focus:border-sky-500 focus:ring-sky-500'
                      : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Preset Shortcuts */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Standard Indian Ocean Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setLatInput(p.lat.toFixed(2));
                    setLonInput(p.lon.toFixed(2));
                  }}
                  className="px-2.5 py-1.5 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-left text-[11px] text-slate-300 flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{p.label}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                    {p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Nearest Argo Float Calculated Feedback */}
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
                  ? 'bg-sky-600 border-sky-400 text-white hover:bg-sky-500 shadow-md shadow-sky-900/50 cursor-pointer'
                  : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>LOCATE IN 3D EXPLORER</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};