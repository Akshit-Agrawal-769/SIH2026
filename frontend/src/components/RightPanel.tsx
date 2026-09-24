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
    openWaterBlock,
    hoveredOceanInfo,
    isGraticuleEnabled,
    toggleGraticule
  } = useOceanStore();

  const [copiedWms, setCopiedWms] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const palettes = [
    { id: 'noaa_sst', name: 'NOAA High-Res SST' },
    { id: 'gfdl_chl', name: 'GFDL ESM2.6 Chlorophyll' },
    { id: 'turbo', name: 'Turbo (Rainbow)' },
    { id: 'viridis', name: 'Viridis (Oceanic Salinity)' },
    { id: 'plasma', name: 'Plasma (Thermal)' },
    { id: 'coolwarm', name: 'Cool-Warm (Divergent)' }
  ];

  const variables = [
    { id: 'temperature', label: 'Temp', unit: '°C', icon: <Waves className="w-3 h-3 text-ocean-accent" /> },
    { id: 'salinity', label: 'Salinity', unit: 'PSU', icon: <Droplets className="w-3 h-3 text-teal-400" /> },
    { id: 'chlorophyll', label: 'Chl-a', unit: 'mg/m³', icon: <Activity className="w-3 h-3 text-ocean-accent" /> },
    { id: 'currents', label: 'Currents', unit: 'm/s', icon: <Wind className="w-3 h-3 text-ocean-accent" /> }
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
    <aside className="fixed right-4 top-16 w-80 max-h-[calc(100vh-120px)] overflow-y-auto glass-panel rounded-xl p-4 flex flex-col gap-4 select-none z-20 shadow-2xl custom-scrollbar">
      {/* 1. Header & Active Variable Indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-ocean-muted uppercase tracking-wider">
          <Sliders className="w-3.5 h-3.5 text-ocean-accent" />
          <span>Visualization Controls</span>
        </div>
        <span className="text-[10px] text-ocean-accent font-mono capitalize px-2 py-0.5 rounded-full bg-ocean-accent/20 border border-ocean-accent/30 font-semibold">
          {selectedVariable}
        </span>
      </div>

      {/* 2. Model Variable Switcher */}
      <div className="space-y-1.5">
        <span className="text-[11px] text-ocean-text-secondary font-medium">Rendered Parameter</span>
        <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
          {variables.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVariable(v.id)}
              className={`flex flex-col items-center py-1.5 px-1 rounded-lg transition-all duration-[150ms] ease-nasa text-center ${
                selectedVariable === v.id
                  ? 'bg-white text-ocean-solid font-bold shadow-md'
                  : 'text-ocean-muted hover:text-white'
              }`}
            >
              <div className="mb-0.5">{v.icon}</div>
              <span className="text-[10px] leading-none">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Colormap & Palette Configuration */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] text-ocean-text-secondary font-medium flex items-center gap-1">
            <Palette className="w-3 h-3 text-ocean-accent" />
            Palette
          </label>
          <select
            value={colorPalette}
            onChange={(e) => setColorPalette(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-ocean-text-secondary focus:outline-none focus:border-ocean-accent"
          >
            {palettes.map((p) => (
              <option key={p.id} value={p.id} className="bg-ocean-solid text-white">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] text-ocean-text-secondary font-medium">Scale Mode</span>
          <div className="flex bg-black/50 border border-white/10 rounded-xl p-0.5">
            <button
              onClick={() => setScaleType('linear')}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg transition-colors duration-[150ms] ease-nasa ${
                scaleType === 'linear' ? 'bg-white text-ocean-solid' : 'text-ocean-muted hover:text-white'
              }`}
            >
              Linear
            </button>
            <button
              onClick={() => setScaleType('log')}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg transition-colors duration-[150ms] ease-nasa ${
                scaleType === 'log' ? 'bg-white text-ocean-solid' : 'text-ocean-muted hover:text-white'
              }`}
            >
              Log₁₀
            </button>
          </div>
        </div>
      </div>

      {/* 4. Physical Range Editor & Colormap Gradient */}
      <div className="space-y-2 p-2.5 rounded-xl bg-black/40 border border-white/5">
        <div className="flex items-center justify-between text-xs text-ocean-text-secondary">
          <span className="font-medium flex items-center gap-1 text-[11px]">
            <Sparkles className="w-3 h-3 text-ocean-accent" />
            Physical Range
          </span>
          <button
            onClick={autoCalibrateRange}
            className="flex items-center gap-1 text-[10px] text-ocean-accent hover:text-ocean-accent bg-emerald-500/10 px-2 py-0.5 rounded-full border border-ocean-accent/30 transition-all duration-[150ms] ease-nasa"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Auto
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-ocean-muted font-mono">Min Bound</span>
            <input
              type="number"
              step="0.1"
              value={colorRange[0]}
              onChange={(e) => setColorRange([parseFloat(e.target.value) || 0, colorRange[1]])}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-ocean-text-secondary focus:outline-none focus:border-ocean-accent"
            />
          </div>
          <div>
            <span className="text-[9px] text-ocean-muted font-mono">Max Bound</span>
            <input
              type="number"
              step="0.1"
              value={colorRange[1]}
              onChange={(e) => setColorRange([colorRange[0], parseFloat(e.target.value) || 30])}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-ocean-text-secondary focus:outline-none focus:border-ocean-accent"
            />
          </div>
        </div>

        {/* Gradient Bar with Interactive Hover Needle */}
        <div className="pt-1.5 space-y-1">
          <div className="relative pt-1">
            {hoverPct !== null && (
              <div
                className="absolute top-0 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-white z-10 transition-all duration-[150ms] ease-nasa duration-75"
                style={{ left: `calc(${hoverPct}% - 4px)` }}
              />
            )}
            <div
              className="h-3 w-full rounded shadow-inner border border-white/20"
              style={{ background: getGradientCss() }}
            />
          </div>
          <div className="flex justify-between text-[8px] font-mono text-ocean-muted">
            {ticks.map((t, idx) => (
              <span key={idx}>{t.toFixed(1)}{idx === ticks.length - 1 ? ` ${varUnit}` : ''}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Sliders: Opacity & Vertical Exaggeration */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-ocean-text-secondary">
            <span className="font-medium text-[11px]">Layer Opacity</span>
            <span className="font-mono text-[10px] text-ocean-accent font-bold">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-ocean-text-secondary">
            <span className="font-medium text-[11px] flex items-center gap-1">
              <Maximize2 className="w-3 h-3 text-ocean-accent" />
              Bathymetric Exaggeration
            </span>
            <span className="font-mono text-[10px] text-ocean-accent font-bold">{verticalExaggeration.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="15.0"
            step="0.5"
            value={verticalExaggeration}
            onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>
      </div>

      {/* 6. 3D Volumetric Water Block Studio Trigger & NOAA Graticule */}
      <div className="space-y-2 pt-1 border-t border-white/10">
        <button
          onClick={() => {
            openWaterBlock({
              lon: 78.0,
              lat: 12.0,
              name: 'Indian Ocean Water Column'
            });
          }}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500/25 to-teal-500/25 hover:from-emerald-500/35 hover:to-teal-500/35 border border-ocean-accent/40 text-ocean-accent hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-[150ms] ease-nasa shadow-md active:scale-[0.98]"
        >
          <Box className="w-3.5 h-3.5 text-ocean-accent" />
          <span>Inspect 3D Water Block Studio</span>
        </button>

        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-ocean-accent" />
            <span className="text-[11px] font-bold text-ocean-text-secondary">NOAA Graticule Grid</span>
          </div>
          <button
            onClick={toggleGraticule}
            className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full transition-all duration-[150ms] ease-nasa ${
              isGraticuleEnabled
                ? 'bg-ocean-accent/20 text-ocean-accent border border-ocean-accent/40'
                : 'bg-white/5 text-ocean-muted'
            }`}
          >
            {isGraticuleEnabled ? 'ENABLED' : 'MUTED'}
          </button>
        </div>
      </div>

      {/* 7. Ocean Currents Dynamics Controls (When Currents Active) */}
      {activeLayers.includes('currents') && (
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-ocean-text-secondary">
            <div className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-ocean-accent animate-pulse" />
              <span className="text-[11px] font-bold text-ocean-text-secondary">Currents Vectors ({depthLevel === 0.5 ? '0m' : `${depthLevel}m`})</span>
            </div>
            <span className="font-mono text-[10px] text-ocean-accent font-bold">{currentsSpeed.toFixed(1)}x speed</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-ocean-muted font-mono">
              <span>Arrow Glyph Scale: {vectorArrowScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={vectorArrowScale}
              onChange={(e) => setVectorArrowScale(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-ocean-muted font-mono">
              <span>Flow Speed: {currentsSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={currentsSpeed}
              onChange={(e) => setCurrentsSpeed(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* 8. NetCDF Export & OGC WMS Interoperability */}
      <div className="pt-2 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-ocean-accent" />
            Export &amp; GIS
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-ocean-accent/20 text-ocean-accent border border-ocean-accent/30">
            CF-1.8 / OGC
          </span>
        </div>

        <button
          onClick={handleExportNetCDF}
          disabled={isExporting}
          className="w-full py-2 px-3 glass-pill text-ocean-accent hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-[150ms] ease-nasa active:scale-[0.98] disabled:opacity-50"
        >
          <Download className={`w-3.5 h-3.5 text-ocean-accent ${isExporting ? 'animate-bounce' : ''}`} />
          <span>{isExporting ? 'Packaging NetCDF...' : `Download NetCDF-4 (${selectedVariable.slice(0, 4)}.nc)`}</span>
        </button>

        <div className="p-2 rounded-xl bg-black/50 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-ocean-muted">
            <span className="font-semibold text-ocean-text-secondary">OGC WMS 1.3.0 Endpoint</span>
            <a
              href="/api/wms?SERVICE=WMS&REQUEST=GetCapabilities"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ocean-accent hover:underline flex items-center gap-0.5"
            >
              <span>Capabilities</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="flex items-center gap-1 bg-black/40 rounded p-1">
            <input
              type="text"
              readOnly
              value={wmsUrl}
              className="bg-transparent text-[9px] font-mono text-ocean-text-secondary flex-1 outline-none select-all"
            />
            <button onClick={handleCopyWms} className="p-1 hover:text-ocean-accent">
              {copiedWms ? <Check className="w-3 h-3 text-ocean-accent" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
