import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore } from '../store/useOceanStore';
import { formatTick, scalePosition, scaleTicks } from '../rendering/scale';
import { Thermometer, Droplets, Activity, Wind, X } from 'lucide-react';

export const ColorbarLegend: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const {
    selectedVariable,
    depthLevel,
    colorPalette,
    colorRange,
    scaleType,
    hoveredOceanInfo,
    activeLayers,
    catalog
  } = useOceanStore(useShallow((s) => ({
    selectedVariable: s.selectedVariable, depthLevel: s.depthLevel, colorPalette: s.colorPalette,
    colorRange: s.colorRange, scaleType: s.scaleType, hoveredOceanInfo: s.hoveredOceanInfo,
    activeLayers: s.activeLayers, catalog: s.catalog
  })));

  const isLayerActive = activeLayers.includes(selectedVariable);
  if (!isLayerActive || isDismissed) return null;

  const getGradientCss = () => {
    switch (colorPalette.toLowerCase()) {
      case 'noaa_sst':
      case 'noaa':
      case 'sst':
        return 'linear-gradient(to right, #73088c 0%, #5014b4 8%, #1446d7 15%, #0080f0 23%, #00b4e6 30%, #00d7c8 38%, #14d278 45%, #3cd71e 52%, #aae600 60%, #ffeb00 68%, #ffb900 75%, #ff7d00 82%, #f5410a 88%, #e1190f 94%, #b90c0c 100%)';
      case 'gfdl_chl':
      case 'gfdl':
      case 'chlorophyll':
        return 'linear-gradient(to right, #aa14af 0%, #7319c3 7%, #2337d7 15%, #0a69eb 25%, #00aff0 35%, #0fd7c3 45%, #28d255 55%, #87e614 65%, #fae60a 75%, #ffaa00 85%, #f54b0f 92%, #c30f14 100%)';
      case 'viridis':
        return 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)';
      case 'thermal':
      case 'plasma':
      case 'magma':
        return 'linear-gradient(to right, #0a041e, #51127c, #b63679, #fb8861, #fefa96)';
      case 'coolwarm':
        return 'linear-gradient(to right, #3b4cc0, #8daff0, #dddddd, #f39475, #b40426)';
      case 'turbo':
        return 'linear-gradient(to right, #30123b, #4145ab, #4675ed, #39a2fc, #1bcfd4, #24eca6, #61fc4c, #a4fc3b, #d1e834, #f3c63a, #fe9b2d, #f36315, #d93806, #b11901, #7a0402)';
      default:
        return 'linear-gradient(to right, #73088c 0%, #5014b4 8%, #1446d7 15%, #0080f0 23%, #00b4e6 30%, #00d7c8 38%, #14d278 45%, #3cd71e 52%, #aae600 60%, #ffeb00 68%, #ffb900 75%, #ff7d00 82%, #f5410a 88%, #e1190f 94%, #b90c0c 100%)';
    }
  };

  const getVariableMeta = () => {
    switch (selectedVariable) {
      case 'salinity':
        return {
          title: 'Ocean Practical Salinity',
          unit: 'PSU',
          icon: <Droplets className="w-3.5 h-3.5 text-teal-400" />,
          defaultMin: 30.0,
          defaultMax: 37.5
        };
      case 'chlorophyll':
        return {
          title: 'Chlorophyll-a (Phytoplankton)',
          unit: 'mg/m³',
          icon: <Activity className="w-3.5 h-3.5 text-ocean-accent" />,
          defaultMin: 0.05,
          defaultMax: 10.0
        };
      case 'currents':
        return {
          title: 'Ocean Current Velocity',
          unit: 'm/s',
          icon: <Wind className="w-3.5 h-3.5 text-ocean-accent" />,
          defaultMin: 0.0,
          defaultMax: 2.2
        };
      case 'temperature':
      default:
        return {
          title: 'Ocean Potential Temperature',
          unit: '°C',
          icon: <Thermometer className="w-3.5 h-3.5 text-ocean-accent" />,
          defaultMin: colorRange ? colorRange[0] : 20.0,
          defaultMax: colorRange ? colorRange[1] : 32.0
        };
    }
  };

  const meta = getVariableMeta();
  const catMeta = catalog?.variables[selectedVariable];
  const title = catMeta?.long_name ?? meta.title;
  const unit = catMeta?.units ?? meta.unit;
  const minVal = colorRange[0];
  const maxVal = colorRange[1];
  const isLog = scaleType === 'log';
  const pos = hoveredOceanInfo ? scalePosition(hoveredOceanInfo.value, minVal, maxVal, isLog) : null;
  const hoverPct = pos === null ? null : pos * 100;
  const ticks = scaleTicks(minVal, maxVal, isLog, 5);

  return (
    <div className="fixed bottom-24 right-5 glass-panel rounded-xl p-4 shadow-2xl z-20 w-80 select-none border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          {meta.icon}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-ocean-muted">
            {scaleType}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ocean-accent/20 border border-ocean-accent/40 text-ocean-accent font-semibold">
            {depthLevel === 0 ? 'Surface' : `${depthLevel} m`}
          </span>
          <button
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss legend"
            className="p-1 rounded-full hover:bg-white/10 text-ocean-muted hover:text-white transition-all duration-[150ms] ease-nasa ml-1"
            title="Dismiss legend"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Sampled Value Banner */}
      <div className="bg-black/40 rounded-xl px-2.5 py-2 mb-2.5 border border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-ocean-muted uppercase tracking-wider font-medium">
          {hoveredOceanInfo ? 'Sampled at Cursor' : 'Scale Range'}
        </span>
        <div className="text-right">
          {hoveredOceanInfo ? (
            <span className="font-mono text-sm font-bold text-ocean-accent">
              {formatTick(hoveredOceanInfo.value)} {hoveredOceanInfo.unit}
            </span>
          ) : (
            <span className="font-mono text-xs text-white font-semibold">
              {formatTick(minVal)} — {formatTick(maxVal)} {unit}
            </span>
          )}
        </div>
      </div>

      {/* Colorbar with Interactive Needle */}
      <div className="relative mb-2">
        {hoverPct !== null && (
          <div
            className="absolute -top-1.5 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white z-10 transition-all duration-[150ms] ease-nasa duration-75"
            style={{ left: `calc(${hoverPct}% - 5px)` }}
          />
        )}
        <div
          className="h-3.5 w-full rounded-md shadow-inner border border-white/20"
          style={{ background: getGradientCss() }}
        />
      </div>

      {/* Ticks and scale labels */}
      <div className="flex justify-between text-[9px] font-mono text-ocean-muted">
        {ticks.map((t, idx) => (
          <span key={idx} className={idx === 0 || idx === ticks.length - 1 ? 'font-bold text-white' : ''}>
            {formatTick(t)}
            {idx === ticks.length - 1 ? ` ${unit}` : ''}
          </span>
        ))}
      </div>

    </div>
  );
};
