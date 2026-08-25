import React from 'react';
import {
  Info,
  Compass,
  Database,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  ChevronRight,
  Crosshair
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const InspectorPanel = () => {
  const {
    activeInspectorTab,
    setActiveInspectorTab,
    selectedFloat,
    argoFloats,
    selectFloat,
    selectFloatAndCompare,
    metadata,
    activeDataset,
    volumeMeta,
    isInspectorOpen,
  } = useOceanStore();

  if (!isInspectorOpen) return null;

  return (
    <aside className="absolute top-16 right-4 z-20 w-80 max-h-[calc(100vh-140px)] overflow-y-auto bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 text-slate-200 shadow-2xl flex flex-col gap-3 text-xs select-none custom-scrollbar">

      {/* Inspector Tabs */}
      <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded-lg">
        <button
          onClick={() => setActiveInspectorTab('argo')}
          className={`py-1.5 rounded text-xs font-semibold tracking-wide transition-all ${
            activeInspectorTab === 'argo'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Argo Floats
        </button>
        <button
          onClick={() => setActiveInspectorTab('metadata')}
          className={`py-1.5 rounded text-xs font-semibold tracking-wide transition-all ${
            activeInspectorTab === 'metadata'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Model Metadata
        </button>
      </div>

      {/* Tab 1: Argo Float Inspector */}
      {activeInspectorTab === 'argo' && (
        <div className="flex flex-col gap-3">
          {selectedFloat ? (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300 rounded">
                  WMO {selectedFloat.platform_number}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedFloat.profiles_count} Profiles
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/60 p-2 rounded border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Latitude</span>
                  <span className="text-slate-200 font-bold">
                    {selectedFloat.latest_position.latitude.toFixed(2)}°N
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Longitude</span>
                  <span className="text-slate-200 font-bold">
                    {selectedFloat.latest_position.longitude.toFixed(2)}°E
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-relaxed">
                <span className="text-slate-300 font-semibold block mb-0.5">Observation Provenance</span>
                INCOIS / Coriolis GDAC. Real profiles with QC flags 1 (Good) and 2 (Probably Good).
              </div>

              <button
                onClick={() => selectFloatAndCompare(selectedFloat)}
                className="w-full mt-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-amber-600/30 to-amber-500/30 hover:from-amber-600/40 hover:to-amber-500/40 border border-amber-500/60 text-amber-200 rounded-lg font-semibold text-xs transition-all shadow-md active:scale-[0.99]"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Compare Model vs Float</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-center text-xs">
              Select an Argo float marker from the 3D viewport or the list below.
            </div>
          )}

          {/* Floats Directory List */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Available Floats ({argoFloats.length})</span>
              <span className="font-mono text-teal-400">IN-SITU</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {argoFloats.map((fl) => {
                const isSelected = selectedFloat?.platform_number === fl.platform_number;
                return (
                  <button
                    key={fl.platform_number}
                    onClick={() => selectFloat(fl)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      <div>
                        <div className="font-mono font-bold text-xs text-slate-200">
                          WMO {fl.platform_number}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {fl.latest_position.latitude.toFixed(2)}°N, {fl.latest_position.longitude.toFixed(2)}°E
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Model Metadata Inspector */}
      {activeInspectorTab === 'metadata' && (
        <div className="flex flex-col gap-3">
          {metadata ? (
            <div className="flex flex-col gap-2.5">
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Model Source</span>
                <div className="font-bold text-slate-100 text-xs">{metadata.title || activeDataset}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{metadata.source || 'ROMS 3.9 / INDOFOS'}</div>
              </div>

              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Spatial Bounding Coordinates</span>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-slate-300">
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 block">Longitudes</span>
                    {metadata.bounds?.min_lon ?? 58.0}°E to {metadata.bounds?.max_lon ?? 96.0}°E
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 block">Latitudes</span>
                    {metadata.bounds?.min_lat ?? 4.0}°N to {metadata.bounds?.max_lat ?? 26.0}°N
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Grid Dimensions</span>
                <div className="grid grid-cols-3 gap-1 font-mono text-center text-[10px]">
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 block">X (Lon)</span>
                    <strong className="text-sky-300">{metadata.dimensions?.lon || volumeMeta?.dimX || 64}</strong>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 block">Y (Lat)</span>
                    <strong className="text-sky-300">{metadata.dimensions?.lat || volumeMeta?.dimY || 64}</strong>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-500 block">Z (Depth)</span>
                    <strong className="text-sky-300">{metadata.dimensions?.depth || volumeMeta?.dimZ || 32}</strong>
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Variables Catalog</span>
                <div className="flex flex-wrap gap-1">
                  {(metadata.variables || ['temp', 'salt', 'u', 'v', 'chl']).map((v) => (
                    <span key={v} className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-sky-300 font-mono text-[10px] rounded">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-center text-xs">
              Loading model metadata from backend...
            </div>
          )}
        </div>
      )}

    </aside>
  );
};
