import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore, DEFAULT_OCEAN_POINT } from '../store/useOceanStore';
import { getAllLayers, LayerCategory } from '../layers/registry';
import { Layers, Box, Droplets, Wind, Waves, Radio, Activity } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  waves: <Waves className="w-3.5 h-3.5 text-ocean-accent" />,
  droplets: <Droplets className="w-3.5 h-3.5 text-teal-400" />,
  wind: <Wind className="w-3.5 h-3.5 text-amber-400" />,
  activity: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
  radio: <Radio className="w-3.5 h-3.5 text-amber-400" />,
  layers: <Layers className="w-3.5 h-3.5 text-ocean-muted" />
};

const CATEGORIES: { key: LayerCategory; title: string }[] = [
  { key: 'model_field', title: 'Gridded fields (one rendered at a time)' },
  { key: 'vector_field', title: 'Currents' },
  { key: 'observation', title: 'In-situ observations' },
  { key: 'boundary', title: 'Boundaries' }
];

export const LeftPanel: React.FC = () => {
  const {
    activeLayers, toggleLayer, selectedVariable, setSelectedVariable,
    is3DVolumeBlockEnabled, toggle3DVolumeBlock, openWaterBlock, clickedGlobePoint, layerStatus, catalog
  } = useOceanStore(useShallow((s) => ({
    activeLayers: s.activeLayers,
    toggleLayer: s.toggleLayer,
    selectedVariable: s.selectedVariable,
    setSelectedVariable: s.setSelectedVariable,
    is3DVolumeBlockEnabled: s.is3DVolumeBlockEnabled,
    toggle3DVolumeBlock: s.toggle3DVolumeBlock,
    openWaterBlock: s.openWaterBlock,
    clickedGlobePoint: s.clickedGlobePoint,
    layerStatus: s.layerStatus,
    catalog: s.catalog
  })));

  const allLayers = getAllLayers().filter((l) => l.category !== 'model_field' || !catalog || catalog.variables[l.id]);

  const onLayerClick = (id: string, category: LayerCategory) => {
    if (category === 'model_field') {
      if (selectedVariable === id) toggleLayer(id);
      else setSelectedVariable(id);
    } else {
      toggleLayer(id);
    }
  };

  const open3D = () => {
    const p = clickedGlobePoint ?? DEFAULT_OCEAN_POINT;
    openWaterBlock({ lon: p.lon, lat: p.lat, name: clickedGlobePoint?.basin ?? DEFAULT_OCEAN_POINT.name });
  };

  return (
    <aside aria-label="Layers" className="fixed left-4 top-16 w-72 max-h-[calc(100vh-240px)] overflow-y-auto glass-panel rounded-xl p-3.5 z-20 shadow-2xl flex flex-col gap-3 select-none custom-scrollbar">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-[10px] font-bold text-ocean-muted uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-ocean-accent" />
          Layers
        </h2>
        <span className="text-[10px] text-ocean-accent font-mono px-2 py-0.5 rounded-full bg-ocean-accent/20 border border-ocean-accent/30 font-semibold">
          {activeLayers.length} on
        </span>
      </div>

      {CATEGORIES.map((cat) => {
        const layers = allLayers.filter((l) => l.category === cat.key);
        if (!layers.length) return null;
        return (
          <div key={cat.key} className="space-y-1.5">
            <h3 className="px-1 text-[10px] font-semibold text-ocean-text-secondary uppercase tracking-wider">{cat.title}</h3>
            {cat.key === 'model_field' && (
              <div className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                is3DVolumeBlockEnabled ? 'bg-ocean-accent/15 border-ocean-accent/40' : 'glass-card-subtle'
              }`}>
                <button
                  onClick={toggle3DVolumeBlock}
                  aria-pressed={is3DVolumeBlockEnabled}
                  className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent rounded"
                >
                  <Box className="w-3.5 h-3.5 text-ocean-accent" />
                  <span>
                    <span className="block text-xs font-medium text-white">3D depth frame</span>
                    <span className="block text-[9px] text-ocean-muted font-mono">0–2000 m reference geometry</span>
                  </span>
                </button>
                <button
                  onClick={open3D}
                  className="text-[9px] text-ocean-accent hover:text-white px-2 py-0.5 rounded-full bg-ocean-accent/20 hover:bg-ocean-accent/40 border border-ocean-accent/40 font-mono focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
                  title="Open the Three.js water-column view at the last clicked ocean point"
                >
                  3D view
                </button>
              </div>
            )}
            {layers.map((layer) => {
              const isEnabled = activeLayers.includes(layer.id);
              const isRendered = layer.category === 'model_field' && selectedVariable === layer.id && isEnabled;
              const status = layer.id === 'currents' ? layerStatus.currents : isRendered ? layerStatus.slice : undefined;
              const warn = status && (status.state === 'nodata' || status.state === 'error');
              return (
                <button
                  key={layer.id}
                  onClick={() => onLayerClick(layer.id, layer.category)}
                  aria-pressed={isEnabled}
                  title={layer.description}
                  className={`w-full text-left p-2 rounded-xl border flex items-center justify-between gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent ${
                    isEnabled ? 'bg-white/10 border-ocean-accent/40 text-white' : 'glass-card-subtle text-ocean-muted hover:text-ocean-text-secondary'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span aria-hidden="true" className={`w-3 h-3 rounded-sm border ${isEnabled ? 'bg-ocean-accent border-ocean-accent' : 'border-neutral-500'}`} />
                    {ICONS[layer.iconName ?? 'layers']}
                    <span className="min-w-0">
                      <span className="block text-xs font-medium leading-tight truncate">{layer.name}</span>
                      <span className="block text-[9px] text-ocean-muted font-mono truncate">
                        {warn ? 'no data for current selection' : layer.units ?? layer.description}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {layer.badge && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full font-mono bg-white/5 text-ocean-muted border border-white/5">{layer.badge}</span>
                    )}
                    {isRendered && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full font-mono bg-ocean-accent/30 text-ocean-accent border border-ocean-accent/40 font-bold">shown</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
};
