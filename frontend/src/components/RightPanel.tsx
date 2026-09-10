import React, { useState } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import {
  Sliders,
  Palette,
  Maximize2,
  Sparkles,
  RotateCcw,
  Waves,
  Droplets,
  Activity,
  Wind,
  Download,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Box,
  Globe
} from 'lucide-react';

export const RightPanel: React.FC = () => {
  const {
    selectedVariable,
    setSelectedVariable,
    opacity,
    setOpacity,
    verticalExaggeration,
    setVerticalExaggeration,
    colorPalette,
    setColorPalette,
    colorRange,
    setColorRange,
    scaleType,
    setScaleType,
    vectorArrowScale,
    setVectorArrowScale,
    currentsSpeed,
    setCurrentsSpeed,
    autoCalibrateRange,
    activeLayers,
    currentTime,
    depthLevel,
    is3DVolumeBlockEnabled,
    toggle3DVolumeBlock,
    openWaterBlock,
    hoveredOceanInfo,
    isGraticuleEnabled,
    toggleGraticule
  } = useOceanStore();

  const [copiedWms, setCopiedWms] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const palettes = [
    { id: 'noaa_sst', name: 'NOAA High-Res SST (Reference)' },
    { id: 'gfdl_chl', name: 'GFDL ESM2.6 Chlorophyll (Reference)' },
    { id: 'turbo', name: 'Turbo (Rainbow)' },
    { id: 'viridis', name: 'Viridis (Oceanic Salinity)' },
    { id: 'plasma', name: 'Plasma (Thermal)' },
    { id: 'coolwarm', name: 'Cool-Warm (Divergent)' }
  ];

  const variables = [
    { id: 'temperature', label: 'Temp', unit: '°C', icon: <Waves className="w-3 h-3 text-red-400" /> },
    { id: 'salinity', label: 'Salinity', unit: 'PSU', icon: <Droplets className="w-3 h-3 text-cyan-400" /> },
    { id: 'chlorophyll', label: 'Chl-a', unit: 'mg/m³', icon: <Activity className="w-3 h-3 text-emerald-400" /> },
    { id: 'currents', label: 'Currents', unit: 'm/s', icon: <Wind className="w-3 h-3 text-lime-400" /> }
  ];

  const wmsUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:4000/api/wms`
    : 'http://localhost:4000/api/wms';

  const handleCopyWms = () => {
    navigator.clipboard.writeText(wmsUrl);
    setCopiedWms(true);
    setTimeout(() => setCopiedWms(false), 2000);
  };

  const handleExportNetCDF = async () => {
    try {
      setIsExporting(true);
      const downloadUrl = `/api/export/netcdf?variable=${selectedVariable}&date=${currentTime}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `INCOIS_${selectedVariable}_${currentTime}.nc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('NetCDF export failed:', err);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const getGradientCss = () => {
    switch (colorPalette.toLowerCase()) {
      case 'noaa_sst':
      case 'noaa':
      case 'sst':
        return 'linear-gradient(to right, #73088c 0%, #5014b4 8%, #1446d7 15%, #0080f0 23%, #00b4e6 30%, #00d7c8 38%, #14d278 45%, #3cd71e 52%, #aae600 60%, #ffeb00 68%, #ffb900 75%, #ff7d00 82%, #f5410a 88%, #e1190f 94%, #b90c0c 100%)';
      case 'gfdl_chl':
      case 'gfdl':
      case 'chlorophyll':
        return 'linear-gradient(to right, #aa14af 0%, #7319c3 7%, #2337d7 15%, #0a69eb 25%, #00aff0 35%, #0fd7c3 45%, #28d255 55%, #87e614 65%, #fae60a 75%, #ffaa00 85%, #f54b0f 92%, #c30f14 100%)';
      case 'viridis':
        return 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)';
      case 'thermal':
      case 'plasma':
      case 'magma':
        return 'linear-gradient(to right, #0a041e, #51127c, #b63679, #fb8861, #fefa96)';
      case 'coolwarm':
        return 'linear-gradient(to right, #3b4cc0, #8daff0, #dddddd, #f39475, #b40426)';
      case 'turbo':
        return 'linear-gradient(to right, #30123b, #4145ab, #4675ed, #39a2fc, #1bcfd4, #24eca6, #61fc4c, #a4fc3b, #d1e834, #f3c63a, #fe9b2d, #f36315, #d93806, #b11901, #7a0402)';
      default:
        return 'linear-gradient(to right, #73088c 0%, #5014b4 8%, #1446d7 15%, #0080f0 23%, #00b4e6 30%, #00d7c8 38%, #14d278 45%, #3cd71e 52%, #aae600 60%, #ffeb00 68%, #ffb900 75%, #ff7d00 82%, #f5410a 88%, #e1190f 94%, #b90c0c 100%)';
    }
  };

  const varUnit = selectedVariable === 'temperature' ? '°C' : selectedVariable === 'salinity' ? 'PSU' : selectedVariable === 'chlorophyll' ? 'mg/m³' : 'm/s';
  const minVal = colorRange[0];
  const maxVal = colorRange[1];
  const delta = maxVal - minVal > 0.0001 ? maxVal - minVal : 1.0;

  let hoverPct: number | null = null;
  if (hoveredOceanInfo && hoveredOceanInfo.value !== null) {
    hoverPct = Math.max(0, Math.min(100, ((hoveredOceanInfo.value - minVal) / delta) * 100));
  }

  const ticks = [
    minVal,
    minVal + delta * 0.25,
    minVal + delta * 0.5,
    minVal + delta * 0.75,
    maxVal
  ];

  return (
    <aside className="absolute right-4 top-16 w-80 max-h-[calc(100vh-120px)] overflow-y-auto bg-ocean-panel/92 backdrop-blur-md border border-ocean-border rounded-xl p-3.5 z-20 shadow-2xl flex flex-col gap-3.5 select-none custom-scrollbar">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-ocean-border/60 pb-2">
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-ocean-accent" />
          Visualization Controls
        </h2>
        <span className="text-[10px] text-cyan-400 font-mono capitalize px-1.5 py-0.5 rounded bg-ocean-dark border border-ocean-border">
          {selectedVariable}
        </span>
      </div>

      {/* 1. Variable Quick Switcher */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between">
          <span>Active Ocean Model Variable</span>
        </label>
        <div className="grid grid-cols-4 gap-1 p-1 bg-ocean-dark/80 rounded-lg border border-ocean-border/60">
          {variables.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVariable(v.id)}
              className={`flex flex-col items-center py-1.5 px-1 rounded-md transition-all text-center ${
                selectedVariable === v.id
                  ? 'bg-cyan-500/20 text-white border border-cyan-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <div className="mb-0.5">{v.icon}</div>
              <span className="text-[10px] font-semibold leading-none">{v.label}</span>
              <span className="text-[8px] text-slate-400 font-mono mt-0.5">{v.unit}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Color Palette & Scale Mode */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
            <Palette className="w-3 h-3 text-cyan-400" />
            Palette
          </label>
          <select
            value={colorPalette}
            onChange={(e) => setColorPalette(e.target.value)}
            className="w-full bg-ocean-dark border border-ocean-border rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-ocean-accent"
          >
            {palettes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between">
            <span>Scale Mode</span>
          </label>
          <div className="flex bg-ocean-dark border border-ocean-border rounded-md p-0.5">
            <button
              onClick={() => setScaleType('linear')}
              className={`flex-1 py-1 text-[10px] font-semibold rounded transition-colors ${
                scaleType === 'linear' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Linear
            </button>
            <button
              onClick={() => setScaleType('log')}
              className={`flex-1 py-1 text-[10px] font-semibold rounded transition-colors ${
                scaleType === 'log' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Log₁₀
            </button>
          </div>
        </div>
      </div>

      {/* 3. Colorbar Range Editor with Auto-Calibrate */}
      <div className="space-y-1.5 bg-ocean-dark/50 p-2 rounded-lg border border-ocean-border/60">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-medium flex items-center gap-1 text-[11px]">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Physical Range
          </span>
          <button
            onClick={autoCalibrateRange}
            title="Reset range to standard physical bounds"
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30 transition-all hover:bg-cyan-500/20"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Auto
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-slate-400 font-mono">Min Bound</span>
            <input
              type="number"
              step="0.1"
              value={colorRange[0]}
              onChange={(e) => setColorRange([parseFloat(e.target.value) || 0, colorRange[1]])}
              className="w-full bg-ocean-dark border border-ocean-border rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-mono">Max Bound</span>
            <input
              type="number"
              step="0.1"
              value={colorRange[1]}
              onChange={(e) => setColorRange([colorRange[0], parseFloat(e.target.value) || 30])}
              className="w-full bg-ocean-dark border border-ocean-border rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Integrated Colormap Scale Gradient & Real-time Cursor Needle */}
        <div className="pt-2 border-t border-ocean-border/40 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-mono uppercase">
              Colormap Scale ({scaleType})
            </span>
            {hoveredOceanInfo && hoveredOceanInfo.value !== null ? (
              <span className="font-mono text-cyan-300 font-bold bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/40 animate-pulse">
                Cursor: {hoveredOceanInfo.value.toFixed(1)} {hoveredOceanInfo.unit}
              </span>
            ) : (
              <span className="font-mono text-slate-400">
                {minVal.toFixed(1)} – {maxVal.toFixed(1)} {varUnit}
              </span>
            )}
          </div>

          {/* Gradient Bar with Interactive Hover Needle */}
          <div className="relative pt-1">
            {hoverPct !== null && (
              <div
                className="absolute top-0 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-white z-10 transition-all duration-75"
                style={{ left: `calc(${hoverPct}% - 4px)` }}
              />
            )}
            <div
              className="h-3.5 w-full rounded shadow-inner border border-white/20"
              style={{ background: getGradientCss() }}
            />
          </div>

          {/* Numerical Ticks */}
          <div className="flex justify-between text-[8px] font-mono text-slate-400">
            {ticks.map((t, idx) => (
              <span key={idx} className={idx === 0 || idx === ticks.length - 1 ? 'font-bold text-slate-300' : ''}>
                {t.toFixed(1)}
                {idx === ticks.length - 1 ? ` ${varUnit}` : ''}
              </span>
            ))}
          </div>

          {/* Water Mass Reference Indicators for Temperature */}
          {selectedVariable === 'temperature' && (
            <div className="flex justify-between text-[8px] font-mono pt-1 text-slate-400">
              <span className="text-cyan-400">Cold Upwell</span>
              <span className="text-emerald-400">Fronts</span>
              <span className="text-amber-400">Warm Pool</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Opacity Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-medium text-[11px]">Layer Opacity</span>
          <span className="font-mono text-[10px] text-ocean-accent">
            {Math.round(opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.05"
          max="1.0"
          step="0.05"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full accent-ocean-accent cursor-pointer"
        />
      </div>

      {/* 5. Vertical Exaggeration Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-medium text-[11px] flex items-center gap-1">
            <Maximize2 className="w-3 h-3 text-cyan-400" />
            Vertical Exaggeration
          </span>
          <span className="font-mono text-[10px] text-ocean-accent">
            {verticalExaggeration}x
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={verticalExaggeration}
          onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
          className="w-full accent-ocean-accent cursor-pointer"
        />
      </div>

      {/* 5b. 3D Volumetric Ocean Block Cutaway */}
      <div className="bg-ocean-dark/70 rounded-lg p-2.5 border border-cyan-500/40 space-y-2 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-200">3D Ocean Volume Cutaway</span>
          </div>
          <button
            onClick={toggle3DVolumeBlock}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              is3DVolumeBlockEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'bg-white/5 text-slate-400 border border-white/10'
            }`}
          >
            {is3DVolumeBlockEnabled ? 'ACTIVE' : 'MUTED'}
          </button>
        </div>

        <p className="text-[9px] text-slate-400 leading-tight">
          True 3D water column piece [0m to -2000m abyssal depth] with cross-section depth curtain walls &amp; stratification planes.
        </p>

        {is3DVolumeBlockEnabled && (
          <div className="space-y-1 text-[9px] font-mono bg-black/40 p-1.5 rounded border border-white/5">
            <div className="flex items-center justify-between text-slate-300">
              <span>Depth Walls:</span>
              <span className="text-cyan-300">4 Curtains (0 – 2000m)</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Scanning Slice:</span>
              <span className="text-amber-300 font-bold">{depthLevel === 0.5 ? 'Surface (0m)' : `${depthLevel}m`}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Strata Levels:</span>
              <span className="text-emerald-400">5 Suspended Grids</span>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            openWaterBlock({
              lon: 78.0,
              lat: 12.0,
              name: 'Indian Ocean Water Column'
            });
          }}
          className="w-full py-1.5 px-2 bg-gradient-to-r from-cyan-600/30 to-blue-600/40 hover:from-cyan-600/50 hover:to-blue-600/60 text-cyan-200 border border-cyan-400/50 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98]"
        >
          <Box className="w-3 h-3 text-cyan-300" />
          <span>Inspect 3D Water Block Studio</span>
        </button>
      </div>

      {/* 5c. NOAA-style Cartographic Graticule Grid */}
      <div className="bg-ocean-dark/70 rounded-lg p-2.5 border border-ocean-border/60 space-y-1.5 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold text-slate-200">NOAA Graticule Grid</span>
          </div>
          <button
            onClick={toggleGraticule}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              isGraticuleEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'bg-white/5 text-slate-400 border border-white/10'
            }`}
          >
            {isGraticuleEnabled ? 'ENABLED' : 'MUTED'}
          </button>
        </div>
        <p className="text-[9px] text-slate-400 leading-tight">
          Overlays calibrated 10° parallels (20°N, 10°N, Equator, 2°S, 10°S) and meridians with cartographic coordinates matching NOAA reference imagery.
        </p>
      </div>

      {/* 6. 3D Ocean Current Vectors & Vertical Depth Shear (u, v) */}
      {activeLayers.includes('currents') && (
        <div className="pt-2 border-t border-ocean-border/60 space-y-2.5 bg-gradient-to-b from-cyan-950/30 to-blue-950/20 p-2.5 rounded-lg border border-cyan-500/40 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-[11px] font-bold text-slate-200">
                Ocean Currents (3D Vectors)
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {depthLevel <= 15 ? 'Surface Drift' : depthLevel <= 150 ? 'Thermocline Shear' : 'Abyssal Conveyor'}
            </span>
          </div>

          {/* Active Depth Regime Information Box */}
          <div className="bg-ocean-dark/80 p-2 rounded-md border border-ocean-border/60 space-y-1 text-[9.5px] font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Layer Depth:</span>
              <span className="text-amber-300 font-bold">
                {depthLevel === 0.5 ? 'Surface (0m)' : `${depthLevel}m`}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Velocity Regime:</span>
              <span className={depthLevel <= 15 ? 'text-amber-400 font-bold' : depthLevel <= 150 ? 'text-emerald-400 font-bold' : 'text-cyan-400 font-bold'}>
                {depthLevel <= 15
                  ? 'Vigorous (0.8–2.6 m/s)'
                  : depthLevel <= 100
                  ? 'Energetic (0.4–1.2 m/s)'
                  : depthLevel <= 300
                  ? 'Moderate (0.15–0.5 m/s)'
                  : depthLevel <= 800
                  ? 'Weak Shear (0.07–0.2 m/s)'
                  : 'Abyssal Drift (< 0.06 m/s)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[8.5px]">
              <span>Physical Dynamics:</span>
              <span className="text-slate-300 italic">
                {depthLevel <= 15
                  ? 'Wind Ekman drift & Somali Jet'
                  : depthLevel <= 150
                  ? 'Subsurface pycnocline eddies'
                  : depthLevel <= 300
                  ? 'Thermocline directional shear'
                  : 'Deep thermohaline circulation'}
              </span>
            </div>
          </div>

          {/* Vector Arrow Glyph Scale Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium text-[10px] text-lime-400">Vector Arrow Glyph Scale</span>
              <span className="font-mono text-[10px] text-lime-400 font-bold">{vectorArrowScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={vectorArrowScale}
              onChange={(e) => setVectorArrowScale(parseFloat(e.target.value))}
              className="w-full accent-lime-400 cursor-pointer"
            />
          </div>

          {/* Flow Marching Speed Multiplier */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium text-[10px] text-slate-300">Flow Marching Speed</span>
              <span className="font-mono text-[10px] text-cyan-300 font-bold">{currentsSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={currentsSpeed}
              onChange={(e) => setCurrentsSpeed(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Dynamic Velocity & Depth Scale Legend */}
          <div className="pt-1.5 border-t border-white/10 space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
              <span>Velocity Scale at {depthLevel === 0.5 ? '0m' : `${depthLevel}m`}</span>
              <span className="text-cyan-300 font-bold">North Indian Ocean</span>
            </div>
            <div
              className="h-2 w-full rounded shadow-inner"
              style={{
                background: 'linear-gradient(to right, #818cf8 0%, #38bdf8 25%, #00e5ff 45%, #39ff14 70%, #ffeb3b 100%)'
              }}
            />
            <div className="flex justify-between text-[8px] font-mono text-slate-400">
              <span>&lt;0.06 (Abyss)</span>
              <span>0.2 (Shear)</span>
              <span>0.6 (Drift)</span>
              <span>1.2+ (Jets)</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Export & Interoperability (OGC WMS & CF-1.8 NetCDF) */}
      <div className="pt-2 border-t border-ocean-border/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Export &amp; GIS Interoperability
          </span>
          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            CF-1.8 / OGC
          </span>
        </div>

        {/* NetCDF Download Button */}
        <button
          onClick={handleExportNetCDF}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 text-cyan-200 rounded-lg border border-cyan-500/40 text-xs font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Download className={`w-3.5 h-3.5 text-cyan-300 ${isExporting ? 'animate-bounce' : ''}`} />
          <span>{isExporting ? 'Packaging NetCDF...' : `Download NetCDF-4 (${selectedVariable.slice(0, 4)}.nc)`}</span>
        </button>

        {/* OGC WMS URL Pill */}
        <div className="bg-ocean-dark/80 rounded-lg p-2 border border-ocean-border/60 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-semibold text-slate-300">OGC WMS 1.3.0 Endpoint</span>
            <a
              href="/api/wms?SERVICE=WMS&REQUEST=GetCapabilities"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 hover:underline"
              title="Open XML Capabilities document in new tab"
            >
              <span>GetCapabilities</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 rounded p-1 border border-white/5">
            <input
              type="text"
              readOnly
              value={wmsUrl}
              className="bg-transparent text-[10px] font-mono text-slate-300 flex-1 outline-none select-all"
            />
            <button
              onClick={handleCopyWms}
              title="Copy WMS URL for QGIS / ArcGIS"
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors"
            >
              {copiedWms ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[8px] text-slate-400 leading-relaxed">
            Plug directly into QGIS, ArcGIS, or Google Earth for live ocean model ingestion.
          </p>
        </div>
      </div>
    </aside>
  );
};
