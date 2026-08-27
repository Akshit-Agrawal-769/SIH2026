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
} from 'lucide-react';

export const SettingsPage = () => {
  const {
    showGrid,
    setShowGrid,
    metadata,
    activeDataset,
  } = useOceanStore();

  const [highDpi, setHighDpi] = useState(true);
  const [antialiasing, setAntialiasing] = useState(true);
  const [bathymetricContours, setBathymetricContours] = useState(true);
  const [raymarchingSteps, setRaymarchingSteps] = useState('256');
  const [fpsCap, setFpsCap] = useState('60');
  const [volumetricShadows, setVolumetricShadows] = useState(true);
  const [qcPolicy, setQcPolicy] = useState('strict');
  const [tempScale, setTempScale] = useState('C');
  const [interpMode, setInterpMode] = useState('trilinear');

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    setShowGrid(true);
    setHighDpi(true);
    setAntialiasing(true);
    setBathymetricContours(true);
    setRaymarchingSteps('256');
    setFpsCap('60');
    setVolumetricShadows(true);
    setQcPolicy('strict');
    setTempScale('C');
    setInterpMode('trilinear');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">
                SYSTEM CONFIGURATION
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
              Platform & Rendering Settings
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl">
              Configure WebGL2 3D raymarching parameters, geospatial grid overlays, TEOS-10 scientific QC policies, and rendering fidelity.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 bg-[#080e1a] border border-[#1e293b] hover:border-slate-600 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET DEFAULTS</span>
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-950/50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaved ? 'SETTINGS SAVED' : 'APPLY SETTINGS'}</span>
            </button>
          </div>
        </div>

        {/* 4 Settings Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Section 1: Display Options */}
          <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2 text-cyan-300 font-bold uppercase tracking-wider text-[11px]">
              <Layers className="w-4 h-4" />
              <span>Display Options</span>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Show Graticule (Lat/Lon Grid)</span>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 bg-[#040814] border-[#1e293b] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Show Bathymetric Depth Contours</span>
                <input
                  type="checkbox"
                  checked={bathymetricContours}
                  onChange={(e) => setBathymetricContours(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 bg-[#040814] border-[#1e293b] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">High-DPI Retina Canvas Scaling</span>
                <input
                  type="checkbox"
                  checked={highDpi}
                  onChange={(e) => setHighDpi(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 bg-[#040814] border-[#1e293b] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">WebGL Antialiasing (MSAA 4x)</span>
                <input
                  type="checkbox"
                  checked={antialiasing}
                  onChange={(e) => setAntialiasing(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 bg-[#040814] border-[#1e293b] cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Rendering & Performance */}
          <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2 text-indigo-300 font-bold uppercase tracking-wider text-[11px]">
              <Activity className="w-4 h-4" />
              <span>Rendering & GPU Performance</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">3D Raymarching Steps:</span>
                <select
                  value={raymarchingSteps}
                  onChange={(e) => setRaymarchingSteps(e.target.value)}
                  className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
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
                  className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="30">30 FPS (Power Saver)</option>
                  <option value="60">60 FPS (Smooth)</option>
                  <option value="120">120 FPS / Uncapped</option>
                </select>
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Volumetric Shadowing & Shading</span>
                <input
                  type="checkbox"
                  checked={volumetricShadows}
                  onChange={(e) => setVolumetricShadows(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 bg-[#040814] border-[#1e293b] cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>GPU Acceleration:</span>
                <span className="text-emerald-400 font-bold">WebGL2 3D Textures Active</span>
              </div>
            </div>
          </div>

          {/* Section 3: Data & Scientific QC Policy */}
          <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2 text-amber-300 font-bold uppercase tracking-wider text-[11px]">
              <ShieldCheck className="w-4 h-4" />
              <span>Scientific Data & QC Policy</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Argo QC Filter Policy:</span>
                <select
                  value={qcPolicy}
                  onChange={(e) => setQcPolicy(e.target.value)}
                  className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-amber-300 font-bold focus:outline-none focus:border-amber-500"
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
                  className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="C">Celsius (°C) [ITS-90]</option>
                  <option value="K">Kelvin (K)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">4D Colocation Interpolation:</span>
                <select
                  value={interpMode}
                  onChange={(e) => setInterpMode(e.target.value)}
                  className="px-2 py-1 bg-[#040814] border border-[#1e293b] text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="trilinear">Tri-linear Spatio-Temporal</option>
                  <option value="nearest">Nearest Neighbor</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Vertical Coordinate Standard:</span>
                <span className="text-slate-200 font-bold">TEOS-10 (gsw.z_from_p)</span>
              </div>
            </div>
          </div>

          {/* Section 4: System & Provenance */}
          <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              <Database className="w-4 h-4 text-blue-400" />
              <span>System & Geospatial Engine Provenance</span>
            </div>

            <div className="flex flex-col gap-2.5 text-[11px]">
              <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                <span className="text-slate-400">Platform Version:</span>
                <span className="text-cyan-300 font-bold">INCOIS 3D-Ocean v2.4.0</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                <span className="text-slate-400">Active Numerical Model:</span>
                <span className="text-slate-200 font-bold">{activeDataset || 'INCOIS-BIO-ROMS.nc'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
                <span className="text-slate-400">Geographic Grid Bounds:</span>
                <span className="text-amber-300 font-bold">30°E—120°E, 30°S—30°N</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#141e33] pb-1">
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
