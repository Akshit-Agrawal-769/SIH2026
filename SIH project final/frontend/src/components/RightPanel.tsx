import React, { useState } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import {
  Sliders,
  Palette,
  Maximize2,
  Sparkles,
  RotateCcw,
  Compass,
  Waves,
  Droplets,
  Activity,
  Wind,
  Download,
  Copy,
  Check,
  ExternalLink,
  Layers
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
    autoCalibrateRange,
    activeLayers,
    currentTime
  } = useOceanStore();

  const [copiedWms, setCopiedWms] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const palettes = [
    { id: 'turbo', name: 'Turbo (Rainbow)' },
    { id: 'viridis', name: 'Viridis (Oceanic)' },
    { id: 'plasma', name: 'Plasma (Thermal)' },
    { id: 'coolwarm', name: 'Cool-Warm (Divergent)' },
    { id: 'chlorophyll', name: 'Chlorophyll (BGC)' }
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

      {/* 6. Current Vectors Controls (conditionally active when currents layer is toggled) */}
      {activeLayers.includes('currents') && (
        <div className="pt-2 border-t border-ocean-border/60 space-y-1 bg-cyan-950/20 p-2 rounded-lg border border-cyan-500/30">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-medium text-[11px] flex items-center gap-1 text-lime-400">
              <Compass className="w-3 h-3 text-lime-400" />
              Vector Arrow Scale
            </span>
            <span className="font-mono text-[10px] text-lime-400">
              {vectorArrowScale.toFixed(1)}x
            </span>
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
