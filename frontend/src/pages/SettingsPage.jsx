import React, { useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Sliders,
  Layers,
  ShieldCheck,
  Activity,
  CheckCircle2,
  RotateCcw,
  Database,
  Compass,
  ArrowRight
} from '../components/Icons';

export const SettingsPage = () => {
  const {
    showGrid,
    setShowGrid,
    metadata,
    activeDataset,
    setActivePage,
    settings,
    updateSettings,
    resetSettings,
  } = useOceanStore();

  const [highDpi, setHighDpi] = useState(settings?.highDpi ?? true);
  const [antialiasing, setAntialiasing] = useState(settings?.antialiasing ?? true);
  const [bathymetricContours, setBathymetricContours] = useState(settings?.bathymetricContours ?? true);
  const [raymarchingSteps, setRaymarchingSteps] = useState(settings?.raymarchingSteps ?? '256');
  const [fpsCap, setFpsCap] = useState(settings?.fpsCap ?? '60');
  const [volumetricShadows, setVolumetricShadows] = useState(settings?.volumetricShadows ?? true);
  const [qcPolicy, setQcPolicy] = useState(settings?.qcPolicy ?? 'strict');
  const [tempScale, setTempScale] = useState(settings?.tempScale ?? 'C');
  const [interpMode, setInterpMode] = useState(settings?.interpMode ?? 'trilinear');
  const [graticule, setGraticule] = useState(showGrid ?? true);

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    updateSettings({
      highDpi,
      antialiasing,
      bathymetricContours,
      raymarchingSteps,
      fpsCap,
      volumetricShadows,
      qcPolicy,
      tempScale,
      interpMode,
    });
    setShowGrid(graticule);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    resetSettings();
    setGraticule(true);
    setHighDpi(true);
    setAntialiasing(true);
    setBathymetricContours(true);
    setRaymarchingSteps('256');
    setFpsCap('60');
    setVolumetricShadows(true);
    setQcPolicy('strict');
    setTempScale('C');
    setInterpMode('trilinear');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#030712] text-slate-100 font-sans p-4 sm:p-6 md:p-8 select-none custom-scrollbar">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-500/20 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase font-mono">
                SYSTEM CONFIGURATION // HARDWARE & ALGORITHMS
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase font-mono">
              Platform & Rendering Settings
            </h1>
            <p className="text-xs text-sky-200/50 max-w-3xl font-sans">
              Configure WebGL2 3D raymarching parameters, geospatial grid overlays, TEOS-10 scientific QC policies, and rendering fidelity.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActivePage('home')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-cyan-300 text-xs font-semibold font-mono tracking-wider transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>RETURN TO GLOBE</span>
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 bg-slate-950 border border-sky-500/20 hover:border-sky-500/40 rounded-lg text-xs font-bold font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET</span>
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs font-mono rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_20px_rgba(56,189,248,0.5)]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaved ? 'SETTINGS SAVED' : 'APPLY SETTINGS'}</span>
            </button>
          </div>
        </div>

        {/* 4 Settings Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Section 1: Display Options */}
          <div className="p-5 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col gap-4 text-xs shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent" />
            <div className="flex items-center gap-2 border-b border-sky-500/15 pb-2 text-cyan-300 font-bold uppercase tracking-wider text-[11px] font-mono">
              <Layers className="w-4 h-4" />
              <span>Display & Geospatial Overlays</span>
            </div>

            <div className="flex flex-col gap-3.5 font-mono">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-300 group-hover:text-white transition-colors">Show Graticule (Lat/Lon Grid)</span>
                <input
                  type="checkbox"
                  checked={graticule}
                  onChange={(e) => setGraticule(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 bg-slate-950 border border-sky-500/30 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-300 group-hover:text-white transition-colors">Bathymetric Depth Contours</span>
                <input
                  type="checkbox"
                  checked={bathymetricContours}
                  onChange={(e) => setBathymetricContours(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 bg-slate-950 border border-sky-500/30 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-300 group-hover:text-white transition-colors">High-DPI Retina Canvas Scaling</span>
                <input
                  type="checkbox"
                  checked={highDpi}
                  onChange={(e) => setHighDpi(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 bg-slate-950 border border-sky-500/30 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-300 group-hover:text-white transition-colors">WebGL Antialiasing (MSAA 4x)</span>
                <input
                  type="checkbox"
                  checked={antialiasing}
                  onChange={(e) => setAntialiasing(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 bg-slate-950 border border-sky-500/30 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Rendering & Performance */}
          <div className="p-5 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col gap-4 text-xs shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-400 to-transparent" />
            <div className="flex items-center gap-2 border-b border-sky-500/15 pb-2 text-sky-300 font-bold uppercase tracking-wider text-[11px] font-mono">
              <Activity className="w-4 h-4" />
              <span>Rendering & GPU Performance</span>
            </div>

            <div className="flex flex-col gap-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">3D Raymarching Steps:</span>
                <select
                  value={raymarchingSteps}
                  onChange={(e) => setRaymarchingSteps(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="128">Standard (128 steps)</option>
                  <option value="256">High (256 steps)</option>
                  <option value="512">Ultra (512 steps)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Target Frame Rate:</span>
                <select
                  value={fpsCap}
                  onChange={(e) => setFpsCap(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-sky-500/30 rounded-lg text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="30">30 FPS (Power Saver)</option>
                  <option value="60">60 FPS (Smooth)</option>
                  <option value="120">120 FPS / Uncapped</option>
                </select>
              </div>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-300 group-hover:text-white transition-colors">Volumetric Shadowing & Shading</span>
                <input
                  type="checkbox"
                  checked={volumetricShadows}
                  onChange={(e) => setVolumetricShadows(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 bg-slate-950 border border-sky-500/30 rounded cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>GPU Pipeline:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  WebGL2 3D Textures Active
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Data & Scientific QC Policy */}
          <div className="p-5 bg-[rgba(4,10,24,0.85)] border border-amber-500/25 rounded-xl flex flex-col gap-4 text-xs shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-transparent" />
            <div className="flex items-center gap-2 border-b border-amber-500/15 pb-2 text-amber-300 font-bold uppercase tracking-wider text-[11px] font-mono">
              <ShieldCheck className="w-4 h-4" />
              <span>Scientific Data & QC Policy</span>
            </div>

            <div className="flex flex-col gap-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Argo QC Filter Policy:</span>
                <select
                  value={qcPolicy}
                  onChange={(e) => setQcPolicy(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="strict">Strict (Flags 1 & 2 only)</option>
                  <option value="all">Permissive (All Flags)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Temperature Scale:</span>
                <select
                  value={tempScale}
                  onChange={(e) => setTempScale(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="C">Celsius (°C) [ITS-90]</option>
                  <option value="K">Kelvin (K)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">4D Colocation Mode:</span>
                <select
                  value={interpMode}
                  onChange={(e) => setInterpMode(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="trilinear">Tri-linear Spatio-Temporal</option>
                  <option value="nearest">Nearest Neighbor</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Vertical Standard:</span>
                <span className="text-amber-300 font-bold">TEOS-10 (gsw.z_from_p)</span>
              </div>
            </div>
          </div>

          {/* Section 4: System & Provenance */}
          <div className="p-5 bg-[rgba(4,10,24,0.85)] border border-sky-500/20 rounded-xl flex flex-col gap-4 text-xs shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 to-transparent" />
            <div className="flex items-center gap-2 border-b border-sky-500/15 pb-2 text-slate-300 font-bold uppercase tracking-wider text-[11px] font-mono">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>System & Engine Provenance</span>
            </div>

            <div className="flex flex-col gap-2.5 text-[11px] font-mono">
              <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                <span className="text-slate-400">Platform Version:</span>
                <span className="text-cyan-300 font-bold">INCOIS 3D-Ocean v4.0.0</span>
              </div>
              <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                <span className="text-slate-400">Active Numerical Model:</span>
                <span className="text-slate-200 font-bold">{activeDataset || 'INCOIS-BIO-ROMS.nc'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                <span className="text-slate-400">Geographic Grid Bounds:</span>
                <span className="text-amber-300 font-bold">30°E—120°E, 30°S—30°N</span>
              </div>
              <div className="flex items-center justify-between border-b border-sky-500/10 pb-1.5">
                <span className="text-slate-400">Coastline Vector Asset:</span>
                <span className="text-emerald-400 font-bold">Natural Earth 10m Physical</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Spatial Aspect Calibration:</span>
                <span className="text-teal-300 font-bold">1.8× X, 1.2× Z (Aspect 1.5)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

