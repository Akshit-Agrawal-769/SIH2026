import React, { useState } from 'react';
import {
  Database,
  Activity,
  Sliders,
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Thermometer,
  Droplets,
  Wind,
  Compass,
  Radio,
  Navigation,
  Globe,
  Sparkles,
  Map,
  Flag,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const LeftPanel = () => {
  const {
    datasets,
    activeDataset,
    selectDataset,
    metadata,
    variable,
    setVariable,
    viewMode,
    setViewMode,
    colormap,
    setColormap,
    opacity,
    setOpacity,
    threshold,
    setThreshold,
    verticalExaggeration,
    setVerticalExaggeration,
    depthLevelMeters,
    setDepthLevelMeters,
    enableSlice,
    setEnableSlice,
    layers,
    toggleLayer,
    volumeMeta,
    isLoading,
  } = useOceanStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState({
    dataset: true,
    variable: true,
    depth: true,
    rendering: false,
    layers: false,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Supported model-backed state variables catalog
  const modelVariablesCatalog = [
    { id: 'temp', name: 'Temperature', code: 'TEMP', units: '°C', icon: Thermometer, desc: 'Potential temperature field' },
    { id: 'salt', name: 'Salinity', code: 'SALT', units: 'PSU', icon: Droplets, desc: 'Practical salinity field' },
    { id: 'u', name: 'Zonal Current (u)', code: 'U-VEL', units: 'm/s', icon: Wind, desc: 'Eastward surface ocean current' },
    { id: 'v', name: 'Meridional Current (v)', code: 'V-VEL', units: 'm/s', icon: Compass, desc: 'Northward surface ocean current' },
  ];

  // Active dataset's available variables list
  const availableVars = metadata?.variables || ['temp', 'salt', 'u', 'v'];

  // Colormaps
  const colormaps = [
    { id: 'turbo', label: 'Turbo', gradient: 'linear-gradient(to right, #30123b, #4184f3, #1ae4b6, #a2fc3c, #fb8022, #7a0403)' },
    { id: 'viridis', label: 'Viridis', gradient: 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)' },
    { id: 'thermal', label: 'Thermal', gradient: 'linear-gradient(to right, #0d2673, #19b2cc, #f2d933, #e6331a)' },
    { id: 'jet', label: 'Jet', gradient: 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000)' },
  ];

  // 3D Layers configuration
  const layerItems = [
    { id: 'earthGlobe', label: '3D Earth Globe', icon: Globe, desc: 'Spherical oceanic base', globeOnly: true },
    { id: 'modelCoverage', label: 'ROMS Scalar Field', icon: Activity, desc: 'Hydrodynamic model layer', globeOnly: false },
    { id: 'currentVectors', label: 'Current Streamlines', icon: Wind, desc: 'Particle flow vector field', globeOnly: true },
    { id: 'argoSensors', label: 'Argo In-Situ Array', icon: Radio, desc: 'Coriolis CTD profiling floats', globeOnly: false },
    { id: 'satellites', label: 'Satellite Tracks', icon: Navigation, desc: 'Oceansat / SARAL orbits', globeOnly: true },
    { id: 'events', label: 'Ocean Anomalies', icon: Sparkles, desc: 'Extreme thermal / cyclone events', globeOnly: true },
    { id: 'coastlines', label: 'Coastline Vectors', icon: Map, desc: 'Natural Earth 10m boundaries', globeOnly: true },
    { id: 'graticule', label: 'Lat/Lon Graticule', icon: Compass, desc: 'Parallels and meridians', globeOnly: true },
    { id: 'countryBorders', label: 'Country Boundaries', icon: Flag, desc: 'Geopolitical borders', globeOnly: true },
    { id: 'atmosphere', label: 'Atmospheric Limb', icon: Sparkles, desc: 'Fresnel limb scattering', globeOnly: true },
  ];

  // Actual depth bounds from volume metadata or dataset dimensions
  const maxDepthVal = volumeMeta?.maxDepth || (metadata?.bounds?.max_depth ?? 2000);
  const minDepthVal = volumeMeta?.minDepth || 0;
  const depthStepOptions = [0, 50, 100, 200, 500, 1000, 1500, 2000, 3000].filter((d) => d <= maxDepthVal);

  if (isCollapsed) {
    return (
      <aside className="absolute left-0 top-9.5 bottom-0 z-30 w-10 bg-[var(--surface-rack-backdrop)] backdrop-blur-md border-r border-[var(--border-hairline)] flex flex-col items-center py-2 gap-2 text-slate-400 select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-well)] hover:text-white transition-colors"
          title="Expand Scientific Control Rack (L)"
        >
          <PanelLeftOpen className="w-4 h-4 text-sky-400" strokeWidth={1.75} />
        </button>
        <div className="w-4 h-px bg-[var(--border-hairline)] my-1" />
        <button
          onClick={() => { setIsCollapsed(false); setOpenSections((p) => ({ ...p, dataset: true })); }}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-well)] hover:text-white transition-colors"
          title="Dataset Inspector"
        >
          <Database className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => { setIsCollapsed(false); setOpenSections((p) => ({ ...p, variable: true })); }}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-well)] hover:text-white transition-colors"
          title="Variable Selector"
        >
          <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => { setIsCollapsed(false); setOpenSections((p) => ({ ...p, depth: true })); }}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-well)] hover:text-white transition-colors"
          title="Depth Navigator"
        >
          <Sliders className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => { setIsCollapsed(false); setOpenSections((p) => ({ ...p, layers: true })); }}
          className="p-1.5 rounded-[2px] hover:bg-[var(--surface-well)] hover:text-white transition-colors"
          title="3D Visualization Layers"
        >
          <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="absolute left-0 top-9.5 bottom-0 z-30 w-72 bg-[var(--surface-rack-backdrop)] backdrop-blur-md border-r border-[var(--border-hairline)] flex flex-col text-slate-200 select-none overflow-hidden font-sans shadow-2xl">
      {/* Rack Title Bar */}
      <div className="h-8 px-3 border-b border-[var(--border-hairline)] bg-[var(--surface-header)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-100">
            SCIENTIFIC CONTROLS
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-[2px] text-slate-400 hover:text-white hover:bg-[var(--surface-well)] transition-colors"
          title="Collapse Control Rack"
        >
          <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Scrollable Control Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2">

        {/* SECTION 1: DATASET (Dataset-aware metadata) */}
        <div className="instrument-well overflow-hidden">
          <button
            onClick={() => toggleSection('dataset')}
            className="w-full px-2.5 py-1.5 bg-[var(--surface-elevated)] flex items-center justify-between text-left hover:bg-[var(--surface-well-hover)] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate-200">
                1. Dataset
              </span>
            </div>
            {openSections.dataset ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {openSections.dataset && (
            <div className="p-2.5 flex flex-col gap-2 border-t border-[var(--border-subtle)] text-[11px] font-mono">
              {/* Dataset Selector / Active File */}
              <div>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Active Model File</span>
                {datasets && datasets.length > 1 ? (
                  <select
                    value={activeDataset || ''}
                    onChange={(e) => selectDataset(e.target.value)}
                    disabled={isLoading}
                    className="w-full bg-[var(--surface-base)] border border-[var(--border-hairline)] px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-400 cursor-pointer"
                  >
                    {datasets.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-slate-200 font-bold truncate bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
                    {metadata?.title || activeDataset || 'INCOIS ROMS Ocean Model'}
                  </div>
                )}
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {metadata?.source || 'ROMS 3.9 Hydrodynamic Model Hindcast'}
                </span>
              </div>

              {/* Spatial Domain Bounds from Metadata */}
              <div className="bg-[var(--surface-base)] p-2 border border-[var(--border-hairline)] flex flex-col gap-1">
                <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase">
                  <span>Spatial Domain</span>
                  <span className="text-sky-400">ROMS Grid</span>
                </div>
                {metadata?.bounds ? (
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[8px]">LONGITUDE</span>
                      <span className="tabular-nums font-bold">
                        {metadata.bounds.min_lon?.toFixed(1)}°E — {metadata.bounds.max_lon?.toFixed(1)}°E
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[8px]">LATITUDE</span>
                      <span className="tabular-nums font-bold">
                        {metadata.bounds.min_lat?.toFixed(1)}°N — {metadata.bounds.max_lat?.toFixed(1)}°N
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Bounds: Indian Ocean Basin</span>
                )}
              </div>

              {/* Grid Dimensions from Metadata */}
              {metadata?.dimensions && (
                <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                  <div className="bg-[var(--surface-base)] p-1 border border-[var(--border-hairline)]">
                    <span className="text-slate-500 block text-[8px]">Nx (Lon)</span>
                    <strong className="text-sky-300 tabular-nums">
                      {metadata.dimensions.LON || metadata.dimensions.lon || volumeMeta?.dimX || 64}
                    </strong>
                  </div>
                  <div className="bg-[var(--surface-base)] p-1 border border-[var(--border-hairline)]">
                    <span className="text-slate-500 block text-[8px]">Ny (Lat)</span>
                    <strong className="text-sky-300 tabular-nums">
                      {metadata.dimensions.LAT || metadata.dimensions.lat || volumeMeta?.dimY || 64}
                    </strong>
                  </div>
                  <div className="bg-[var(--surface-base)] p-1 border border-[var(--border-hairline)]">
                    <span className="text-slate-500 block text-[8px]">Levels</span>
                    <strong className="text-sky-300 tabular-nums">
                      {metadata.dimensions.depth || metadata.dimensions.TIME || volumeMeta?.dimZ || 32}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: MODEL VARIABLES (Dataset-filtered) */}
        <div className="instrument-well overflow-hidden">
          <button
            onClick={() => toggleSection('variable')}
            className="w-full px-2.5 py-1.5 bg-[var(--surface-elevated)] flex items-center justify-between text-left hover:bg-[var(--surface-well-hover)] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate-200">
                2. Model Field
              </span>
            </div>
            {openSections.variable ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {openSections.variable && (
            <div className="p-2 flex flex-col gap-1 border-t border-[var(--border-subtle)] font-mono">
              <span className="text-[9px] text-slate-500 uppercase px-1 block mb-0.5">
                Model-Backed State Variables ({availableVars.length} Available)
              </span>
              {modelVariablesCatalog.map((v) => {
                const Icon = v.icon;
                const isSelected = variable === v.id;
                const isAvailable = availableVars.includes(v.id);

                return (
                  <button
                    key={v.id}
                    onClick={() => isAvailable && setVariable(v.id)}
                    disabled={!isAvailable || isLoading}
                    className={`w-full flex items-center justify-between p-2 rounded-[2px] text-left transition-all ${
                      isSelected
                        ? 'bg-[var(--surface-active-tint)] border border-sky-400 text-white shadow-sm'
                        : isAvailable
                          ? 'bg-[var(--surface-base)] border border-[var(--border-hairline)] text-slate-300 hover:border-slate-600 hover:text-white'
                          : 'bg-[var(--surface-base)] border border-[var(--border-subtle)] text-slate-600 opacity-40 cursor-not-allowed'
                    }`}
                    title={isAvailable ? v.desc : `${v.name} is not provided by active dataset`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-[2px] ${isSelected ? 'text-sky-400' : isAvailable ? 'text-slate-400' : 'text-slate-600'}`}>
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold leading-tight">{v.name}</span>
                        <span className="text-[9px] text-slate-500">{isAvailable ? v.desc : 'Unavailable in dataset'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded-[2px] border ${
                        isSelected
                          ? 'text-sky-300 bg-sky-950/60 border-sky-500/40'
                          : isAvailable
                            ? 'text-slate-400 bg-[var(--surface-well)] border-[var(--border-hairline)]'
                            : 'text-slate-600 border-transparent'
                      }`}>
                        {v.units}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: DEPTH & VERTICAL SLICING (Dynamic bounds) */}
        <div className="instrument-well overflow-hidden">
          <button
            onClick={() => toggleSection('depth')}
            className="w-full px-2.5 py-1.5 bg-[var(--surface-elevated)] flex items-center justify-between text-left hover:bg-[var(--surface-well-hover)] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate-200">
                3. Depth Layer
              </span>
            </div>
            {openSections.depth ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {openSections.depth && (
            <div className="p-2.5 flex flex-col gap-2.5 border-t border-[var(--border-subtle)] font-mono text-[11px]">
              {/* Depth Readout */}
              <div className="flex items-center justify-between bg-[var(--surface-base)] p-2 border border-[var(--border-hairline)]">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Selected Level</span>
                  <span className="text-sm font-bold text-sky-300 tabular-nums">
                    {depthLevelMeters === 0 ? 'Surface (0 m)' : `${depthLevelMeters} m Depth`}
                  </span>
                </div>
                <button
                  onClick={() => setDepthLevelMeters(0)}
                  className="px-2 py-0.5 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] text-[10px] text-slate-300 hover:text-white transition-colors"
                  title="Reset to Ocean Surface (0 m)"
                >
                  SURFACE
                </button>
              </div>

              {/* Dynamic Depth Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[9px] text-slate-500 tabular-nums">
                  <span>{minDepthVal}m</span>
                  <span>{((minDepthVal + maxDepthVal) / 2).toFixed(0)}m</span>
                  <span>{maxDepthVal}m</span>
                </div>
                <input
                  type="range"
                  min={minDepthVal}
                  max={maxDepthVal}
                  step="25"
                  value={depthLevelMeters}
                  onChange={(e) => setDepthLevelMeters(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Dynamic Depth Step Nodes */}
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {depthStepOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepthLevelMeters(d)}
                    className={`py-1 rounded-[2px] border text-center transition-all ${
                      depthLevelMeters === d
                        ? 'bg-sky-950 border-sky-400 text-sky-200 font-bold'
                        : 'bg-[var(--surface-base)] border-[var(--border-hairline)] text-slate-400 hover:text-white'
                    }`}
                  >
                    {d === 0 ? '0m' : `${d}m`}
                  </button>
                ))}
              </div>

              {/* Volumetric Slice Clip Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
                <div>
                  <span className="text-[10px] text-slate-400 block">Vertical Slice Clip</span>
                  <span className="text-[8px] text-slate-500">Planar sub-surface section</span>
                </div>
                <button
                  onClick={() => setEnableSlice(!enableSlice)}
                  className={`px-2 py-0.5 rounded-[2px] border text-[10px] font-bold transition-all ${
                    enableSlice
                      ? 'bg-sky-950 border-sky-400 text-sky-300'
                      : 'bg-[var(--surface-base)] border-[var(--border-hairline)] text-slate-500'
                  }`}
                >
                  {enableSlice ? 'CLIPPED' : 'OFF'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: RENDERING & COLORMAPS */}
        <div className="instrument-well overflow-hidden">
          <button
            onClick={() => toggleSection('rendering')}
            className="w-full px-2.5 py-1.5 bg-[var(--surface-elevated)] flex items-center justify-between text-left hover:bg-[var(--surface-well-hover)] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate-200">
                4. Rendering & Mode
              </span>
            </div>
            {openSections.rendering ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {openSections.rendering && (
            <div className="p-2.5 flex flex-col gap-2.5 border-t border-[var(--border-subtle)] font-mono text-[11px]">
              {/* Projection Mode Switcher */}
              <div>
                <span className="text-[9px] text-slate-500 uppercase block mb-1">Projection Mode</span>
                <div className="segmented-control">
                  <button
                    onClick={() => setViewMode('globe')}
                    className={`segmented-option ${viewMode === 'globe' ? 'segmented-option-active text-sky-400' : ''}`}
                  >
                    3D GLOBE
                  </button>
                  <button
                    onClick={() => setViewMode('ocean3d')}
                    className={`segmented-option ${viewMode === 'ocean3d' ? 'segmented-option-active text-sky-400' : ''}`}
                  >
                    VOLUME BOX
                  </button>
                </div>
              </div>

              {/* Colormaps */}
              <div>
                <span className="text-[9px] text-slate-500 uppercase block mb-1">Colormap Palette</span>
                <div className="grid grid-cols-2 gap-1">
                  {colormaps.map((cm) => (
                    <button
                      key={cm.id}
                      onClick={() => setColormap(cm.id)}
                      className={`flex items-center gap-1.5 p-1.5 rounded-[2px] border text-left transition-all ${
                        colormap === cm.id
                          ? 'bg-sky-950/60 border-sky-400 text-white font-bold'
                          : 'bg-[var(--surface-base)] border-[var(--border-hairline)] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="w-3.5 h-2.5 rounded-[1px] border border-white/20 shrink-0" style={{ background: cm.gradient }} />
                      <span className="text-[10px]">{cm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Layer Opacity</span>
                  <span className="text-sky-300 font-bold tabular-nums">{(opacity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Vertical Exaggeration Scale */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Vertical Scale</span>
                  <span className="text-sky-300 font-bold tabular-nums">{verticalExaggeration.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.5"
                  value={verticalExaggeration}
                  onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: 3D VECTOR LAYERS (Globe vs Volume dependency) */}
        <div className="instrument-well overflow-hidden">
          <button
            onClick={() => toggleSection('layers')}
            className="w-full px-2.5 py-1.5 bg-[var(--surface-elevated)] flex items-center justify-between text-left hover:bg-[var(--surface-well-hover)] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate-200">
                5. Planetary Layers
              </span>
            </div>
            {openSections.layers ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {openSections.layers && (
            <div className="p-2 flex flex-col gap-1 border-t border-[var(--border-subtle)] font-mono text-[11px]">
              {layerItems.map((item) => {
                const Icon = item.icon;
                const isEnabled = !!layers[item.id];
                const isApplicable = viewMode === 'globe' || !item.globeOnly;

                return (
                  <button
                    key={item.id}
                    onClick={() => isApplicable && toggleLayer(item.id)}
                    disabled={!isApplicable}
                    className={`w-full flex items-center justify-between p-1.5 rounded-[2px] text-left transition-all ${
                      !isApplicable
                        ? 'bg-[var(--surface-base)] border border-transparent text-slate-600 opacity-40 cursor-not-allowed'
                        : isEnabled
                          ? 'bg-[var(--surface-well)] border border-[var(--border-medium)] text-white'
                          : 'bg-[var(--surface-base)] border border-[var(--border-hairline)] text-slate-500 hover:text-slate-300'
                    }`}
                    title={!isApplicable ? `${item.label} only active in 3D Globe Mode` : item.desc}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${isEnabled && isApplicable ? 'text-sky-400' : 'text-slate-600'}`} strokeWidth={1.75} />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-normal leading-tight">{item.label}</span>
                        <span className="text-[9px] text-slate-500 font-light">
                          {!isApplicable ? 'Globe mode only' : item.desc}
                        </span>
                      </div>
                    </div>
                    {isEnabled && isApplicable ? (
                      <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" strokeWidth={1.75} />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-600 shrink-0" strokeWidth={1.75} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};
