import React from 'react';
import { X, Layers, RotateCcw, Eye, EyeOff, Globe, Sparkles, Map, Flag, Compass, Radio, Activity, Navigation, Wind } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ControlPanel = () => {
  const {
    activeOverlay,
    toggleOverlay,
    viewMode,
    setViewMode,
    colormap,
    setColormap,
    opacity,
    setOpacity,
    verticalExaggeration,
    setVerticalExaggeration,
    layers,
    toggleLayer,
    setLayer,
  } = useOceanStore();

  if (activeOverlay !== 'layers') return null;

  const layerItems = [
    { id: 'earthGlobe', label: '3D Earth Globe', icon: <Globe className="w-3.5 h-3.5" />, desc: 'Spherical oceanic base' },
    { id: 'modelCoverage', label: 'Scientific Data Layer', icon: <Activity className="w-3.5 h-3.5" />, desc: 'ROMS surface scalar field' },
    { id: 'currentVectors', label: 'Current Streamlines', icon: <Wind className="w-3.5 h-3.5" />, desc: 'Animated particle flow vectors' },
    { id: 'satellites', label: 'Satellite Orbits', icon: <Navigation className="w-3.5 h-3.5" />, desc: 'Oceansat & SARAL paths' },
    { id: 'events', label: 'Ocean Events', icon: <Sparkles className="w-3.5 h-3.5" />, desc: 'Cyclones & Thermal anomalies' },
    { id: 'argoSensors', label: 'Argo In-Situ Array', icon: <Radio className="w-3.5 h-3.5" />, desc: 'Profiling CTD floats' },
    { id: 'coastlines', label: 'High-Res Coastlines', icon: <Map className="w-3.5 h-3.5" />, desc: 'Natural Earth 10m vectors' },
    { id: 'land', label: 'Continental Landmass', icon: <Map className="w-3.5 h-3.5" />, desc: 'Topographic land polygons' },
    { id: 'countryBorders', label: 'Country Boundaries', icon: <Flag className="w-3.5 h-3.5" />, desc: 'Geopolitical borders' },
    { id: 'graticule', label: 'Lat / Lon Graticule', icon: <Compass className="w-3.5 h-3.5" />, desc: 'Spherical parallels & meridians' },
    { id: 'atmosphere', label: 'Atmospheric Glow', icon: <Sparkles className="w-3.5 h-3.5" />, desc: 'Fresnel limb scattering' },
  ];

  const colormaps = [
    { id: 'turbo', label: 'Turbo', gradient: 'linear-gradient(to right, #30123b, #4184f3, #1ae4b6, #a2fc3c, #fb8022, #7a0403)' },
    { id: 'viridis', label: 'Viridis', gradient: 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)' },
    { id: 'thermal', label: 'Thermal', gradient: 'linear-gradient(to right, #0d2673, #19b2cc, #f2d933, #e6331a)' },
    { id: 'jet', label: 'Jet', gradient: 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000)' },
  ];

  return (
    <aside className="absolute right-3 md:right-4 top-12 md:top-14 z-30 w-72 md:w-80 max-h-[calc(100vh-120px)] glass-panel rounded-xl text-white/90 select-none overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90">Visualization Layers</span>
        </div>
        <button
          onClick={() => toggleOverlay('layers')}
          className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
          title="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Layer Toggles */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
        {layerItems.map((item) => {
          const isEnabled = !!layers[item.id];
          return (
            <button
              key={item.id}
              onClick={() => toggleLayer(item.id)}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                isEnabled
                  ? 'bg-white/15 border border-white/20 text-white'
                  : 'bg-black/20 hover:bg-white/5 border border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1 rounded ${isEnabled ? 'text-white' : 'text-white/40'}`}>
                  {item.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-normal leading-tight">{item.label}</span>
                  <span className="text-[10px] text-white/40 font-light">{item.desc}</span>
                </div>
              </div>

              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  isEnabled ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]' : 'bg-white/20'
                }`}
              />
            </button>
          );
        })}

        {/* Colormaps Section */}
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-white/40 font-mono uppercase px-1 block mb-1">
            Colormap Palette
          </span>
          <div className="grid grid-cols-2 gap-1">
            {colormaps.map((cm) => {
              const isSelected = colormap === cm.id;
              return (
                <button
                  key={cm.id}
                  onClick={() => setColormap(cm.id)}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-white/15 border-white/25 text-white'
                      : 'bg-black/20 border-transparent text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-3.5 h-2.5 rounded-sm border border-white/20 shrink-0"
                    style={{ background: cm.gradient }}
                  />
                  <span className="text-[11px] font-normal">{cm.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
