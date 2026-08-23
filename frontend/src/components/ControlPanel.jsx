import React, { useEffect } from 'react';
import { 
  Thermometer, 
  Droplet, 
  Wind, 
  Activity, 
  Layers, 
  Play, 
  Pause, 
  Sparkles,
  Maximize2
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const ControlPanel = () => {
  const {
    datasets,
    activeDataset,
    selectDataset,
    variable,
    setVariable,
    renderMode,
    setRenderMode,
    colormap,
    setColormap,
    timeIndex,
    setTimeIndex,
    opacity,
    setOpacity,
    threshold,
    setThreshold,
    isoValue,
    setIsoValue,
    sliceDepthMeters,
    setSliceDepthMeters,
    enableSlice,
    setEnableSlice,
    verticalExaggeration,
    setVerticalExaggeration,
    isPlayingTimeline,
    toggleTimelinePlayback,
    argoFloats,
    selectFloat,
    metadata
  } = useOceanStore();

  useEffect(() => {
    if (!isPlayingTimeline) return;
    const interval = setInterval(() => {
      const maxTime = metadata?.time_range?.length || 5;
      setTimeIndex((timeIndex + 1) % maxTime);
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlayingTimeline, timeIndex, metadata, setTimeIndex]);

  const variables = [
    { id: 'temp', label: 'Temp', icon: <Thermometer className="w-3.5 h-3.5" />, units: '°C' },
    { id: 'salt', label: 'Salinity', icon: <Droplet className="w-3.5 h-3.5" />, units: 'PSU' },
    { id: 'u', label: 'u-Vel', icon: <Wind className="w-3.5 h-3.5" />, units: 'm/s' },
    { id: 'v', label: 'v-Vel', icon: <Wind className="w-3.5 h-3.5 rotate-90" />, units: 'm/s' },
    { id: 'chl', label: 'Chl-a', icon: <Activity className="w-3.5 h-3.5" />, units: 'mg/m³' },
  ];

  const colormaps = [
    { id: 'turbo', label: 'Turbo', preview: 'bg-gradient-to-r from-indigo-600 via-emerald-400 to-rose-600' },
    { id: 'viridis', label: 'Viridis', preview: 'bg-gradient-to-r from-purple-800 via-teal-500 to-yellow-300' },
    { id: 'thermal', label: 'Thermal', preview: 'bg-gradient-to-r from-blue-900 via-cyan-400 to-orange-500' },
    { id: 'jet', label: 'Jet', preview: 'bg-gradient-to-r from-blue-700 via-yellow-400 to-red-600' },
  ];

  return (
    <div className="absolute top-20 right-6 z-20 w-80 max-h-[calc(100vh-120px)] overflow-y-auto bg-slate-900/85 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 text-slate-200 shadow-2xl flex flex-col gap-4 text-xs select-none custom-scrollbar">
      
      <div>
        <label className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
          Model Dataset (ROMS / INDOFOS)
        </label>
        <select
          value={activeDataset}
          onChange={(e) => selectDataset(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
        >
          {datasets.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
          Physical / BGC Variable
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {variables.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariable(v.id)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border font-medium transition-all ${
                variable === v.id
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm'
                  : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
              }`}
            >
              {v.icon}
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
          3D Rendering Mode
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setRenderMode('volume')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium transition-all ${
              renderMode === 'volume'
                ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3D Volume Raymarch</span>
          </button>
          <button
            onClick={() => setRenderMode('iso')}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium transition-all ${
              renderMode === 'iso'
                ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Iso-Surface (3D)</span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
          Colormap Transfer Function
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {colormaps.map((cm) => (
            <button
              key={cm.id}
              onClick={() => setColormap(cm.id)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${
                colormap === cm.id
                  ? 'bg-slate-700 border-sky-400 text-slate-100'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-750'
              }`}
            >
              <div className={`w-4 h-3 rounded ${cm.preview}`} />
              <span className="font-medium">{cm.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-2.5 bg-slate-800/50 border border-slate-700/60 rounded-xl flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">2D Depth Slicing Plane</span>
          <input
            type="checkbox"
            checked={enableSlice}
            onChange={(e) => setEnableSlice(e.target.checked)}
            className="w-4 h-4 accent-sky-500 cursor-pointer"
          />
        </div>
        {enableSlice && (
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Depth Plane</span>
              <span className="font-mono text-sky-400 font-bold">{sliceDepthMeters} m</span>
            </div>
            <input
              type="range"
              min="0"
              max="2000"
              step="25"
              value={sliceDepthMeters}
              onChange={(e) => setSliceDepthMeters(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 p-2.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
        {renderMode === 'volume' ? (
          <>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Raymarch Opacity</span>
                <span className="font-mono text-slate-300">{opacity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Vertical Exaggeration</span>
                <span className="font-mono text-slate-300">{verticalExaggeration.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={verticalExaggeration}
                onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
            </div>
          </>
        ) : (
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Iso-Surface Threshold</span>
              <span className="font-mono text-slate-300">{(isoValue * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.02"
              value={isoValue}
              onChange={(e) => setIsoValue(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>
        )}
      </div>

      <div className="p-2.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-300">Forecast Time Step</span>
          <button
            onClick={toggleTimelinePlayback}
            className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/20 border border-sky-500/50 text-sky-300 rounded font-semibold hover:bg-sky-500/30 transition-all"
          >
            {isPlayingTimeline ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isPlayingTimeline ? 'Pause' : 'Play'}</span>
          </button>
        </div>
        <input
          type="range"
          min="0"
          max={(metadata?.time_range?.length || 5) - 1}
          step="1"
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
          <span>T+00h</span>
          <span>T+{timeIndex * 24}h</span>
          <span>T+{((metadata?.time_range?.length || 5) - 1) * 24}h</span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
          In-Situ Argo Floats (Click to Validate)
        </label>
        <div className="flex flex-col gap-1.5">
          {argoFloats.map((fl) => (
            <button
              key={fl.platform_number}
              onClick={() => selectFloat(fl)}
              className="flex items-center justify-between px-3 py-2 bg-slate-800/70 border border-slate-700/70 hover:border-amber-400 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-125 transition-all animate-pulse" />
                <div>
                  <div className="font-bold text-slate-200">WMO {fl.platform_number}</div>
                  <div className="text-[10px] text-slate-400">
                    {fl.latest_position.latitude.toFixed(2)}°N, {fl.latest_position.longitude.toFixed(2)}°E
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] bg-slate-700/80 text-amber-300 font-mono rounded">
                {fl.profiles_count} Profiles
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
