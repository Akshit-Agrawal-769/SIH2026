import React from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Globe,
  Compass,
  Crosshair,
  Layers,
  RefreshCw,
  Search,
  Eye,
  Sliders,
  CheckCircle2,
  AlertCircle
} from './Icons';
import { VISUAL_PRESETS } from '../rendering/VisualPresets';

export const ScientificHUD = () => {
  const {
    sampleProbe,
    cameraOrbit,
    setCameraPresetAction,
    setIsGoToModalOpen,
    activeDataset,
    variable,
    depthMeters,
    timeStep,
    visualPreset,
    setVisualPreset,
    is3DView,
  } = useOceanStore();

  const lat = sampleProbe?.lat !== undefined ? sampleProbe.lat.toFixed(4) : '10.0000';
  const lon = sampleProbe?.lon !== undefined ? sampleProbe.lon.toFixed(4) : '75.0000';
  const isInside = sampleProbe?.isInsideModel ?? true;

  const currentPreset = VISUAL_PRESETS[visualPreset] || VISUAL_PRESETS.STANDARD_OCEAN;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none font-mono">
      {/* Top HUD Bar */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Real-time Cursor Geographic Telemetry & Model Status */}
        <div className="pointer-events-auto flex flex-col gap-2 bg-[#040915]/85 border border-[#1e293b] backdrop-blur-md rounded-lg p-3 shadow-2xl max-w-sm text-xs">
          <div className="flex items-center justify-between border-b border-[#141e33] pb-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span className="font-bold text-slate-200 tracking-wider text-[11px]">SURFACE TARGET</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider flex items-center gap-1 ${
                isInside
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isInside ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>MODEL AVAILABLE</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  <span>OUTSIDE DOMAIN</span>
                </>
              )}
            </span>
          </div>

          {/* Lat / Lon Display */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">LATITUDE</span>
              <span className="font-bold text-white tabular-nums">
                {Math.abs(Number(lat)).toFixed(4)}° {Number(lat) >= 0 ? 'N' : 'S'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">LONGITUDE</span>
              <span className="font-bold text-white tabular-nums">
                {Math.abs(Number(lon)).toFixed(4)}° {Number(lon) >= 0 ? 'E' : 'W'}
              </span>
            </div>
          </div>

          {/* Active Variable & Depth */}
          <div className="border-t border-[#141e33] pt-2 flex items-center justify-between text-[10px] text-slate-400">
            <div>
              <span className="text-slate-500">FIELD: </span>
              <span className="text-sky-300 font-bold uppercase">{variable}</span>
            </div>
            <div>
              <span className="text-slate-500">DEPTH: </span>
              <span className="text-emerald-300 font-bold">{depthMeters} m</span>
            </div>
          </div>
        </div>

        {/* Top-Center: Visual Style Mode Selector */}
        <div className="pointer-events-auto hidden md:flex items-center bg-[#040915]/85 border border-[#1e293b] backdrop-blur-md rounded-lg p-1 shadow-xl text-[10px]">
          {Object.values(VISUAL_PRESETS).map((p) => (
            <button
              key={p.id}
              onClick={() => setVisualPreset(p.id)}
              className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
                visualPreset === p.id
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Top-Right: Camera Navigation Verbs (God's Eye View Style) */}
        <div className="pointer-events-auto flex flex-col gap-2 bg-[#040915]/85 border border-[#1e293b] backdrop-blur-md rounded-lg p-2.5 shadow-2xl text-xs">
          <div className="text-[10px] text-slate-500 font-bold tracking-wider px-1 uppercase flex items-center justify-between">
            <span>CAMERA NAVIGATION</span>
            <Compass className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setCameraPresetAction('fit_earth')}
              className="px-2.5 py-1.5 bg-[#081020] hover:bg-sky-500/20 border border-[#1e293b] hover:border-sky-500/40 rounded text-slate-300 hover:text-white text-[10px] font-bold transition-all text-center"
            >
              FIT EARTH
            </button>
            <button
              onClick={() => setCameraPresetAction('fit_indian_ocean')}
              className="px-2.5 py-1.5 bg-[#081020] hover:bg-sky-500/20 border border-[#1e293b] hover:border-sky-500/40 rounded text-sky-300 hover:text-white text-[10px] font-bold transition-all text-center"
            >
              INDIAN OCEAN
            </button>
            <button
              onClick={() => setIsGoToModalOpen(true)}
              className="px-2.5 py-1.5 bg-[#081020] hover:bg-sky-500/20 border border-[#1e293b] hover:border-sky-500/40 rounded text-slate-300 hover:text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1"
            >
              <Search className="w-3 h-3 text-sky-400" />
              <span>GO TO COORD</span>
            </button>
            <button
              onClick={() => setCameraPresetAction('reset')}
              className="px-2.5 py-1.5 bg-[#081020] hover:bg-sky-500/20 border border-[#1e293b] hover:border-sky-500/40 rounded text-slate-300 hover:text-white text-[10px] font-bold transition-all text-center"
            >
              RESET VIEW
            </button>
          </div>

          {/* Camera Angles Readout */}
          <div className="border-t border-[#141e33] pt-1.5 flex items-center justify-between text-[9px] text-slate-400 px-1">
            <span>AZ: {cameraOrbit?.azimuth ?? 0}°</span>
            <span>EL: {cameraOrbit?.elevation ?? 0}°</span>
            <span>ZOOM: {cameraOrbit?.zoom ?? 2.4}x</span>
          </div>
        </div>
      </div>

      {/* Bottom HUD Strip */}
      <div className="flex items-end justify-between pointer-events-none">
        {/* Left Provenance Badge */}
        <div className="pointer-events-auto p-2 bg-[#040915]/80 border border-[#1e293b] backdrop-blur-md rounded text-[10px] text-slate-400 flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>INCOIS 3D OCEAN SYSTEM · CORIOLIS GDAC · TEOS-10 CALIBRATED</span>
        </div>
      </div>
    </div>
  );
};
