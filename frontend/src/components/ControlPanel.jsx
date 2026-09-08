import React from 'react';
import { X, Layers, RotateCcw, Globe, Sparkles, Map, Flag, Compass, Radio, Activity, Navigation, Wind } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ControlPanel = () => {
  const {
    activeOverlay,
    toggleOverlay,
    colormap,
    setColormap,
    layers,
    toggleLayer,
  } = useOceanStore();

  if (activeOverlay !== 'layers') return null;

  const layerItems = [
    { id: 'earthGlobe', label: '3D Planetary Globe', icon: <Globe className="w-3.5 h-3.5" />, desc: 'Spherical oceanic base surface' },
    { id: 'modelCoverage', label: 'Numerical Ocean Field', icon: <Activity className="w-3.5 h-3.5" />, desc: 'ROMS surface scalar field' },
    { id: 'currentVectors', label: 'Current Velocity Streamlines', icon: <Wind className="w-3.5 h-3.5" />, desc: 'Eulerian velocity field vectors' },
    { id: 'satellites', label: 'Satellite Orbital Tracks', icon: <Navigation className="w-3.5 h-3.5" />, desc: 'Oceansat-3 & SARAL altimetry' },
    { id: 'events', label: 'Extreme Ocean Events', icon: <Sparkles className="w-3.5 h-3.5" />, desc: 'Cyclones & thermal anomalies' },
    { id: 'argoSensors', label: 'Argo In-Situ Float Array', icon: <Radio className="w-3.5 h-3.5" />, desc: 'Autonomous CTD profiling floats' },
    { id: 'coastlines', label: 'High-Res Natural Coastlines', icon: <Map className="w-3.5 h-3.5" />, desc: 'Natural Earth 10m vectors' },
    { id: 'land', label: 'Continental Topography', icon: <Map className="w-3.5 h-3.5" />, desc: 'Topographic land polygons' },
    { id: 'countryBorders', label: 'Geopolitical Boundaries', icon: <Flag className="w-3.5 h-3.5" />, desc: 'International maritime borders' },
    { id: 'graticule', label: 'Lat / Lon Coordinate Graticule', icon: <Compass className="w-3.5 h-3.5" />, desc: 'Spherical parallels & meridians' },
    { id: 'atmosphere', label: 'Atmospheric Limb Scattering', icon: <Sparkles className="w-3.5 h-3.5" />, desc: 'Fresnel limb atmospheric glow' },
  ];

  const colormaps = [
    { id: 'turbo', label: 'Turbo', gradient: 'linear-gradient(to right, #30123b, #4184f3, #1ae4b6, #a2fc3c, #fb8022, #7a0403)' },
    { id: 'viridis', label: 'Viridis', gradient: 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)' },
    { id: 'thermal', label: 'Thermal', gradient: 'linear-gradient(to right, #0d2673, #19b2cc, #f2d933, #e6331a)' },
    { id: 'jet', label: 'Jet', gradient: 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000)' },
  ];

  return (
    <aside className="absolute right-6 top-20 z-30 w-80 max-h-[calc(100vh-140px)] bg-[rgba(4,10,24,0.88)] backdrop-blur-2xl rounded-2xl border border-sky-500/25 shadow-panel-dark text-white select-none overflow-hidden flex flex-col animate-fade-slide">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-black/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 pulse-beacon" />
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-white uppercase">
              VISUALIZATION LAYERS
            </h2>
            <span className="text-[9px] text-slate-400 block -mt-0.5">
              GRAPHICAL OVERLAYS &amp; SENSORS
            </span>
          </div>
        </div>
        <button
          onClick={() => toggleOverlay('layers')}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Layer Toggles ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-1">
        {layerItems.map((item) => {
          const isEnabled = !!layers[item.id];
          return (
            <button
              key={item.id}
              onClick={() => toggleLayer(item.id)}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                isEnabled
                  ? 'bg-sky-500/15 border border-sky-400/40 text-white shadow-sm'
                  : 'bg-black/30 hover:bg-sky-500/10 border border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg bg-black/40 border border-white/[0.08] ${isEnabled ? 'text-sky-300' : 'text-slate-500'}`}>
                  {item.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                  <span className="text-[9.5px] text-slate-400 font-sans">{item.desc}</span>
                </div>
              </div>

              {/* Glowing Switch Pill */}
              <div
                className={`w-8 h-4 rounded-full p-0.5 transition-all flex items-center ${
                  isEnabled
                    ? 'bg-sky-500 justify-end shadow-glow-cyan-sm'
                    : 'bg-slate-800 justify-start'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
              </div>
            </button>
          );
        })}

        {/* ─── Colormaps Section ─── */}
        <div className="mt-2 pt-2.5 border-t border-white/[0.08]">
          <span className="text-[10px] text-slate-400 font-mono uppercase px-1 block mb-2 font-semibold">
            Colormap Scientific Transfer Function
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {colormaps.map((cm) => {
              const isSelected = colormap === cm.id;
              return (
                <button
                  key={cm.id}
                  onClick={() => setColormap(cm.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400/50 text-white shadow-glow-cyan-sm'
                      : 'bg-black/30 border-white/[0.06] text-slate-400 hover:text-white hover:bg-sky-500/10'
                  }`}
                >
                  <div
                    className="w-4 h-3 rounded-md border border-white/20 shrink-0 shadow-inner"
                    style={{ background: cm.gradient }}
                  />
                  <span className="text-xs font-mono font-medium">{cm.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
