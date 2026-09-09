import React from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { Thermometer, Droplets, Activity, Wind } from 'lucide-react';

export const ColorbarLegend: React.FC = () => {
  const {
    selectedVariable,
    depthLevel,
    colorPalette,
    colorRange,
    scaleType,
    hoveredOceanInfo,
    activeLayers
  } = useOceanStore();

  const isLayerActive = activeLayers.includes(selectedVariable);
  if (!isLayerActive) return null;

  const getGradientCss = () => {
    switch (colorPalette.toLowerCase()) {
      case 'viridis':
        return 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)';
      case 'chlorophyll':
        return 'linear-gradient(to right, #0f172a, #0e7490, #10b981, #84cc16, #facc15)';
      case 'thermal':
      case 'plasma':
      case 'magma':
        return 'linear-gradient(to right, #0a041e, #51127c, #b63679, #fb8861, #fefa96)';
      case 'coolwarm':
        return 'linear-gradient(to right, #3b4cc0, #8daff0, #dddddd, #f39475, #b40426)';
      case 'turbo':
      default:
        return 'linear-gradient(to right, #30123b, #4145ab, #4675ed, #39a2fc, #1bcfd4, #24eca6, #61fc4c, #a4fc3b, #d1e834, #f3c63a, #fe9b2d, #f36315, #d93806, #b11901, #7a0402)';
    }
  };

  const getVariableMeta = () => {
    switch (selectedVariable) {
      case 'salinity':
        return {
          title: 'Ocean Practical Salinity',
          unit: 'PSU',
          icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" />,
          defaultMin: 30.0,
          defaultMax: 37.5
        };
      case 'chlorophyll':
        return {
          title: 'Chlorophyll-a (Phytoplankton)',
          unit: 'mg/m³',
          icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
          defaultMin: 0.05,
          defaultMax: 10.0
        };
      case 'currents':
        return {
          title: 'Ocean Current Velocity',
          unit: 'm/s',
          icon: <Wind className="w-3.5 h-3.5 text-lime-400" />,
          defaultMin: 0.0,
          defaultMax: 2.2
        };
      case 'temperature':
      default:
        return {
          title: 'Ocean Potential Temperature',
          unit: '°C',
          icon: <Thermometer className="w-3.5 h-3.5 text-red-400" />,
          defaultMin: colorRange ? colorRange[0] : 20.0,
          defaultMax: colorRange ? colorRange[1] : 32.0
        };
    }
  };

  const meta = getVariableMeta();
  const minVal = colorRange ? colorRange[0] : meta.defaultMin;
  const maxVal = colorRange ? colorRange[1] : meta.defaultMax;
  const delta = maxVal - minVal > 0.0001 ? maxVal - minVal : 1.0;

  // Calculate position of current hovered value on the colorbar
  let hoverPct: number | null = null;
  if (hoveredOceanInfo && hoveredOceanInfo.value !== null) {
    hoverPct = Math.max(0, Math.min(100, ((hoveredOceanInfo.value - minVal) / delta) * 100));
  }

  // Generate 5 tick mark values
  const ticks = [
    minVal,
    minVal + delta * 0.25,
    minVal + delta * 0.5,
    minVal + delta * 0.75,
    maxVal
  ];

  return (
    <div className="absolute bottom-24 right-4 bg-ocean-panel/92 backdrop-blur-md border border-ocean-border rounded-xl p-3 shadow-2xl z-20 w-80 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          {meta.icon}
          <span>{meta.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono uppercase px-1 py-0.5 rounded bg-ocean-dark border border-ocean-border text-slate-400">
            {scaleType}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ocean-dark border border-ocean-border text-cyan-400">
            {depthLevel === 0.5 ? 'Surface (0m)' : `${depthLevel}m`}
          </span>
        </div>
      </div>

      {/* Live Sampled Value Banner */}
      <div className="bg-ocean-dark/80 rounded-lg px-2.5 py-1.5 mb-2.5 border border-ocean-border/60 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
          {hoveredOceanInfo ? 'Sampled at Cursor' : 'Calibrated Scale Range'}
        </span>
        <div className="text-right">
          {hoveredOceanInfo ? (
            <span className="font-mono text-sm font-bold text-cyan-300">
              {hoveredOceanInfo.value.toFixed(1)} {hoveredOceanInfo.unit}
            </span>
          ) : (
            <span className="font-mono text-xs text-slate-300">
              {minVal.toFixed(1)} — {maxVal.toFixed(1)} {meta.unit}
            </span>
          )}
        </div>
      </div>

      {/* Colorbar with Interactive Needle */}
      <div className="relative mb-2">
        {/* Animated needle / indicator */}
        {hoverPct !== null && (
          <div
            className="absolute -top-1.5 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white z-10 transition-all duration-75"
            style={{ left: `calc(${hoverPct}% - 5px)` }}
          />
        )}
        <div
          className="h-3.5 w-full rounded-md shadow-inner border border-white/20"
          style={{ background: getGradientCss() }}
        />
      </div>

      {/* Ticks and scale labels */}
      <div className="flex justify-between text-[9px] font-mono text-slate-400">
        {ticks.map((t, idx) => (
          <span key={idx} className={idx === 0 || idx === ticks.length - 1 ? 'font-bold text-slate-300' : ''}>
            {t.toFixed(1)}
            {idx === ticks.length - 1 ? meta.unit : ''}
          </span>
        ))}
      </div>

      {/* Water Mass Thermal Reference Labels */}
      {selectedVariable === 'temperature' && (
        <div className="flex justify-between text-[8px] font-mono mt-1.5 pt-1.5 border-t border-ocean-border/40">
          <span className="text-cyan-400 font-semibold">Cold Upwell</span>
          <span className="text-emerald-400 font-semibold">Frontal / Eddies</span>
          <span className="text-amber-400 font-semibold">Warm Pool</span>
        </div>
      )}
    </div>
  );
};
