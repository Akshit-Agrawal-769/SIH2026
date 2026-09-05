import React, { useState } from 'react';
import { X, Info, ExternalLink, ChevronDown, ChevronUp, MapPin, Database, Activity, Radio, Zap, Anchor } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ContextualInfoPanel = () => {
  const {
    selectedEntity,
    setSelectedEntity,
    cursorProbe,
    metadata,
    timeIndex,
    selectFloatAndCompare,
    selectedFloat,
  } = useOceanStore();

  const [isExpanded, setIsExpanded] = useState(true);

  if (!selectedEntity && !cursorProbe) return null;

  const entity = selectedEntity || {
    type: 'probe',
    title: 'Ocean Geographic Probe',
    subtitle: 'Point Coordinates',
    range: cursorProbe ? `${cursorProbe.lat.toFixed(2)}°N, ${cursorProbe.lon.toFixed(2)}°E` : '',
    source: 'INCOIS Spatial Grid Sample',
    description: 'Real-time spherical coordinate intersection on the 3D ocean model domain.',
  };

  const currentDateStr = metadata?.time_range?.[timeIndex]
    ? metadata.time_range[timeIndex].replace('T', ' ').replace(':00Z', ' UTC')
    : '27 Aug 2026';

  return (
    <aside className="absolute right-3 md:right-4 top-32 md:top-36 z-30 w-72 md:w-80 glass-panel rounded-xl text-white/90 select-none overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2 truncate">
          <Info className="w-3.5 h-3.5 text-white/70 shrink-0" />
          <span className="text-xs font-medium text-white/90 truncate">
            {entity.title}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setSelectedEntity(null)}
            className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
            title="Dismiss Info Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      {isExpanded && (
        <div className="p-3.5 flex flex-col gap-2.5 text-xs">
          {/* Subtitle & Date */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-white/60 font-light leading-tight">
              {entity.subtitle}
            </span>
            <span className="text-[10px] text-white/40 font-mono mt-0.5">
              {currentDateStr} · {entity.source}
            </span>
          </div>

          {/* Key Metrics / Attributes */}
          <div className="py-2 border-y border-white/[0.06] grid grid-cols-2 gap-2 text-[11px] font-mono">
            {entity.range && (
              <div className="flex flex-col">
                <span className="text-[9px] text-white/40 uppercase">Range / Anomaly</span>
                <span className="text-white/90 font-normal tabular-nums">{entity.range}</span>
              </div>
            )}

            {entity.resolution && (
              <div className="flex flex-col">
                <span className="text-[9px] text-white/40 uppercase">Resolution</span>
                <span className="text-white/70 font-normal">{entity.resolution}</span>
              </div>
            )}

            {entity.coordinates && (
              <div className="flex flex-col col-span-2">
                <span className="text-[9px] text-white/40 uppercase">Coordinates</span>
                <span className="text-white/90 font-normal tabular-nums">{entity.coordinates}</span>
              </div>
            )}

            {entity.details && (
              <div className="flex flex-col col-span-2">
                <span className="text-[9px] text-white/40 uppercase">Telemetry / Sensors</span>
                <span className="text-white/80 font-normal">{entity.details}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {entity.description && (
            <p className="text-[11px] text-white/60 font-light leading-relaxed">
              {entity.description}
            </p>
          )}

          {/* Contextual Action for Argo Floats */}
          {entity.type === 'float' && selectedFloat && (
            <button
              onClick={() => selectFloatAndCompare(selectedFloat)}
              className="w-full mt-1 py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-normal transition-colors flex items-center justify-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Compute 4D Residual Profile</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
