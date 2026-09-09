import React from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { getAllLayers, LayerCategory } from '../layers/registry';
import { Layers, Activity, Droplets, Wind, Waves, Radio, Anchor, Compass } from 'lucide-react';

export const LeftPanel: React.FC = () => {
  const { activeLayers, toggleLayer, selectedVariable, setSelectedVariable } = useOceanStore();
  const allLayers = getAllLayers();

  const getIcon = (iconName?: string, fallbackId?: string) => {
    const key = iconName || fallbackId || '';
    switch (key) {
      case 'waves':
      case 'temperature':
        return <Waves className="w-3.5 h-3.5 text-red-400" />;
      case 'droplets':
      case 'salinity':
        return <Droplets className="w-3.5 h-3.5 text-cyan-400" />;
      case 'wind':
      case 'currents':
        return <Wind className="w-3.5 h-3.5 text-lime-400" />;
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
    <aside className="absolute left-4 top-16 w-72 max-h-[calc(100vh-120px)] overflow-y-auto bg-ocean-panel/92 backdrop-blur-md border border-ocean-border rounded-xl p-3 z-20 shadow-2xl flex flex-col gap-3 select-none custom-scrollbar">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-ocean-border/60 pb-2">
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-ocean-accent" />
          Layer Catalog
        </h2>
        <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-ocean-dark border border-ocean-border">
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
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {cat.title}
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  {layersInCat.filter((l) => activeLayers.includes(l.id)).length}/{layersInCat.length}
                </span>
              </div>

              <div className="space-y-1">
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
                      className={`p-2 rounded-lg border transition-all flex items-center justify-between cursor-pointer select-none ${
                        isEnabled
                          ? 'bg-ocean-border/40 border-ocean-accent/40 text-white shadow-sm'
                          : 'bg-ocean-dark/40 border-ocean-border/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {}} // Handled by outer container click
                          className="rounded bg-ocean-dark border-slate-600 text-ocean-accent focus:ring-0 cursor-pointer"
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
                          <span className={`text-[8px] px-1 py-0.2 rounded font-mono ${
                            isEnabled
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-black/30 text-slate-500 border border-white/5'
                          }`}>
                            {layer.badge}
                          </span>
                        )}
                        {isEnabled && layer.category === 'model_field' && (
                          <span className={`text-[8px] px-1 py-0.2 rounded font-mono ${
                            isSelectedModel
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30 font-bold'
                              : 'text-slate-500'
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

      <div className="mt-1 pt-2 border-t border-ocean-border/60 text-[9px] text-ocean-muted leading-tight">
        Zero-touch plugin architecture: new sensors and models registered via <code className="text-cyan-400">registerLayer()</code> populate automatically.
      </div>
    </aside>
  );
};
