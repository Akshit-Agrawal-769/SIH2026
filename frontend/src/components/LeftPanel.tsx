import React from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { getAllLayers, LayerCategory } from '../layers/registry';
import {
  Layers,
  Box,
  Droplets,
  Wind,
  Waves,
  Radio,
  Anchor,
  Compass,
  Activity
} from 'lucide-react';

export const LeftPanel: React.FC = () => {
  const {
    activeLayers,
    toggleLayer,
    selectedVariable,
    setSelectedVariable,
    is3DVolumeBlockEnabled,
    toggle3DVolumeBlock,
    openWaterBlock
  } = useOceanStore();

  const allLayers = getAllLayers();

  const getIcon = (iconName?: string, fallbackId?: string) => {
    const key = iconName || fallbackId || '';
    switch (key) {
      case 'waves':
      case 'temperature':
        return <Waves className="w-3.5 h-3.5 text-emerald-400" />;
      case 'droplets':
      case 'salinity':
        return <Droplets className="w-3.5 h-3.5 text-cyan-400" />;
      case 'wind':
      case 'currents':
        return <Wind className="w-3.5 h-3.5 text-emerald-400" />;
      case 'activity':
      case 'chlorophyll':
        return <Activity className="w-3.5 h-3.5 text-emerald-400" />;
      case 'radio':
      case 'argo':
        return <Radio className="w-3.5 h-3.5 text-amber-400" />;
      case 'glider':
        return <Radio className="w-3.5 h-3.5 text-fuchsia-400" />;
      case 'anchor':
      case 'moored_buoy':
        return <Anchor className="w-3.5 h-3.5 text-emerald-400" />;
      case 'compass':
        return <Compass className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const categories: { key: LayerCategory; title: string }[] = [
    { key: 'model_field', title: '3D Ocean Model Volumes' },
    { key: 'vector_field', title: 'Hydrodynamic Circulation' },
    { key: 'observation', title: 'In-Situ Observation Platforms' },
    { key: 'boundary', title: 'Maritime Jurisdictions' }
  ];

  return (
    <aside className="fixed left-4 top-16 w-72 max-h-[calc(100vh-120px)] overflow-y-auto glass-panel rounded-2xl p-3.5 z-20 shadow-2xl flex flex-col gap-3 select-none custom-scrollbar">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Layer Catalog
        </h2>
        <span className="text-[10px] text-emerald-400 font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 font-semibold">
          {activeLayers.length} Active
        </span>
      </div>

      {/* Dynamic Layer Categorization */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const layersInCat = allLayers.filter((l) => l.category === cat.key);
          if (layersInCat.length === 0) return null;

          return (
            <div key={cat.key} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                  {cat.title}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {layersInCat.filter((l) => activeLayers.includes(l.id)).length}/{layersInCat.length}
                </span>
              </div>

              <div className="space-y-1">
                {cat.key === 'model_field' && (
                  <div
                    onClick={toggle3DVolumeBlock}
                    className={`p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none mb-1.5 ${
                      is3DVolumeBlockEnabled
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-white shadow-sm'
                        : 'glass-card-subtle text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={is3DVolumeBlockEnabled}
                        onChange={() => {}}
                        className="rounded bg-[#0b0f17] border-slate-600 text-emerald-400 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <Box className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <div className="text-xs font-medium leading-none flex items-center gap-1.5">
                            <span>3D Volumetric Slab</span>
                            <span className="text-[8px] bg-emerald-400/20 text-emerald-300 px-1 py-0.5 rounded font-mono">0-2000m</span>
                          </div>
                          <span className="text-[8px] text-slate-400 font-mono">Depth walls &amp; strata</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWaterBlock({
                          lon: 78.0,
                          lat: 12.0,
                          name: 'Indian Ocean Water Column'
                        });
                      }}
                      className="text-[9px] text-emerald-300 hover:text-white px-2 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 font-mono transition"
                      title="Open 3D Volumetric Water Block Studio"
                    >
                      3D View
                    </button>
                  </div>
                )}
                {layersInCat.map((layer) => {
                  const isEnabled = activeLayers.includes(layer.id);
                  const isSelectedModel = selectedVariable === layer.id;

                  return (
                    <div
                      key={layer.id}
                      onClick={() => {
                        toggleLayer(layer.id);
                        if (layer.category === 'model_field') {
                          setSelectedVariable(layer.id);
                        }
                      }}
                      className={`p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                        isEnabled
                          ? 'bg-white/10 border-emerald-400/40 text-white shadow-sm'
                          : 'glass-card-subtle text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {}}
                          className="rounded bg-[#0b0f17] border-slate-600 text-emerald-400 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          {getIcon(layer.iconName, layer.id)}
                          <div>
                            <div className="text-xs font-medium leading-none flex items-center gap-1.5">
                              <span>{layer.name}</span>
                            </div>
                            {layer.units && (
                              <span className="text-[8px] text-slate-400 font-mono">{layer.units}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1">
                        {layer.badge && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                            isEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/5'
                          }`}>
                            {layer.badge}
                          </span>
                        )}
                        {isEnabled && layer.category === 'model_field' && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                            isSelectedModel
                              ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 font-bold'
                              : 'text-slate-400'
                          }`}>
                            {isSelectedModel ? 'Rendered' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1 pt-2 border-t border-white/10 text-[9px] text-slate-400 leading-tight">
        Zero-touch plugin architecture: new sensors and models registered via <code className="text-emerald-400 font-mono">registerLayer()</code> populate automatically.
      </div>
    </aside>
  );
};
