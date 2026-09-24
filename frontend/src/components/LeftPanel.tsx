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
        return <Waves className="w-3.5 h-3.5 text-ocean-accent" />;
      case 'droplets':
      case 'salinity':
        return <Droplets className="w-3.5 h-3.5 text-teal-400" />;
      case 'wind':
      case 'currents':
        return <Wind className="w-3.5 h-3.5 text-ocean-accent" />;
      case 'activity':
      case 'chlorophyll':
        return <Activity className="w-3.5 h-3.5 text-ocean-accent" />;
      case 'radio':
      case 'argo':
        return <Radio className="w-3.5 h-3.5 text-amber-400" />;
      case 'glider':
        return <Radio className="w-3.5 h-3.5 text-fuchsia-400" />;
      case 'anchor':
      case 'moored_buoy':
        return <Anchor className="w-3.5 h-3.5 text-ocean-accent" />;
      case 'compass':
        return <Compass className="w-3.5 h-3.5 text-teal-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-ocean-muted" />;
    }
  };

  const categories: { key: LayerCategory; title: string }[] = [
    { key: 'model_field', title: '3D Ocean Model Volumes' },
    { key: 'vector_field', title: 'Hydrodynamic Circulation' },
    { key: 'observation', title: 'In-Situ Observation Platforms' },
    { key: 'boundary', title: 'Maritime Jurisdictions' }
  ];

  return (
    <aside className="fixed left-4 top-16 w-72 max-h-[calc(100vh-120px)] overflow-y-auto glass-panel rounded-xl p-3.5 z-20 shadow-2xl flex flex-col gap-3 select-none custom-scrollbar">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-[10px] font-bold text-ocean-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-ocean-accent" />
          Layer Catalog
        </h2>
        <span className="text-[10px] text-ocean-accent font-mono px-2 py-0.5 rounded-full bg-ocean-accent/20 border border-ocean-accent/30 font-semibold">
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
                <span className="text-[10px] font-semibold text-ocean-text-secondary uppercase tracking-wider">
                  {cat.title}
                </span>
                <span className="text-[9px] font-mono text-ocean-muted">
                  {layersInCat.filter((l) => activeLayers.includes(l.id)).length}/{layersInCat.length}
                </span>
              </div>

              <div className="space-y-1">
                {cat.key === 'model_field' && (
                  <div
                    onClick={toggle3DVolumeBlock}
                    className={`p-2 rounded-xl border transition-all duration-[150ms] ease-nasa flex items-center justify-between cursor-pointer select-none mb-1.5 ${
                      is3DVolumeBlockEnabled
                        ? 'bg-ocean-accent/20 border-ocean-accent/50 text-white shadow-sm'
                        : 'glass-card-subtle text-ocean-muted hover:text-ocean-text-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={is3DVolumeBlockEnabled}
                        onChange={() => {}}
                        className="rounded bg-[#0b0f17] border-neutral-600 text-ocean-accent focus:ring-0 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <Box className="w-3.5 h-3.5 text-ocean-accent" />
                        <div>
                          <div className="text-xs font-medium leading-none flex items-center gap-1.5">
                            <span>3D Volumetric Slab</span>
                            <span className="text-[8px] bg-ocean-accent/20 text-ocean-accent px-1 py-0.5 rounded font-mono">0-2000m</span>
                          </div>
                          <span className="text-[8px] text-ocean-muted font-mono">Depth walls &amp; strata</span>
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
                      className="text-[9px] text-ocean-accent hover:text-white px-2 py-0.5 rounded-full bg-ocean-accent/20 hover:bg-ocean-accent/40 border border-ocean-accent/40 font-mono transition-all duration-[150ms] ease-nasa"
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
                      className={`p-2 rounded-xl border transition-all duration-[150ms] ease-nasa flex items-center justify-between cursor-pointer select-none ${
                        isEnabled
                          ? 'bg-white/10 border-ocean-accent/40 text-white shadow-sm'
                          : 'glass-card-subtle text-ocean-muted hover:text-ocean-text-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {}}
                          className="rounded bg-[#0b0f17] border-neutral-600 text-ocean-accent focus:ring-0 cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          {getIcon(layer.iconName, layer.id)}
                          <div>
                            <div className="text-xs font-medium leading-none flex items-center gap-1.5">
                              <span>{layer.name}</span>
                            </div>
                            {layer.units && (
                              <span className="text-[8px] text-ocean-muted font-mono">{layer.units}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1">
                        {layer.badge && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                            isEnabled
                              ? 'bg-ocean-accent/20 text-ocean-accent border border-ocean-accent/30'
                              : 'bg-white/5 text-ocean-muted border border-white/5'
                          }`}>
                            {layer.badge}
                          </span>
                        )}
                        {isEnabled && layer.category === 'model_field' && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                            isSelectedModel
                              ? 'bg-ocean-accent/30 text-ocean-accent border border-ocean-accent/40 font-bold'
                              : 'text-ocean-muted'
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

      <div className="mt-1 pt-2 border-t border-white/10 text-[9px] text-ocean-muted leading-tight">
        Zero-touch plugin architecture: new sensors and models registered via <code className="text-ocean-accent font-mono">registerLayer()</code> populate automatically.
      </div>
    </aside>
  );
};
