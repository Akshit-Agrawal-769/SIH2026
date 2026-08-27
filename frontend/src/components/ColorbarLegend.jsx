import React from 'react';
import { useOceanStore, VITAL_SIGNS_CATALOG } from '../store/oceanStore';

export const ColorbarLegend = () => {
  const volumeMeta = useOceanStore((state) => state.volumeMeta);
  const colormap = useOceanStore((state) => state.colormap);
  const activeVitalSign = useOceanStore((state) => state.activeVitalSign);

  // Find vital sign details
  const allSigns = [
    ...VITAL_SIGNS_CATALOG.surface,
    ...VITAL_SIGNS_CATALOG.subsurface,
    ...VITAL_SIGNS_CATALOG.dynamic,
  ];
  const sign = allSigns.find((s) => s.id === activeVitalSign) || allSigns[0];

  const minVal = volumeMeta?.minVal !== undefined ? volumeMeta.minVal.toFixed(1) : sign.range[0].toString();
  const maxVal = volumeMeta?.maxVal !== undefined ? volumeMeta.maxVal.toFixed(1) : sign.range[1].toString();
  const units = volumeMeta?.units || sign.units;

  const getGradient = () => {
    switch (colormap) {
      case 'viridis':
        return 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)';
      case 'thermal':
        return 'linear-gradient(to right, #0d2673, #19b2cc, #f2d933, #e6331a)';
      case 'jet':
        return 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000)';
      case 'turbo':
      default:
        return 'linear-gradient(to right, #30123b, #4184f3, #1ae4b6, #a2fc3c, #fb8022, #7a0403)';
    }
  };

  return (
    <div className="absolute bottom-16 left-3 md:left-4 z-20 px-3 py-2 glass-panel rounded-xl text-white/90 select-none shadow-lg max-w-[240px] pointer-events-auto animate-in fade-in duration-300">
      {/* Title & Unit */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-normal truncate text-white/90">
          {sign.name}
        </span>
        <span className="text-[10px] font-mono text-white/40 shrink-0">
          {units}
        </span>
      </div>

      {/* Gradient Bar */}
      <div
        className="w-full h-1.5 rounded-full border border-white/10 shadow-inner"
        style={{ background: getGradient() }}
      />

      {/* Min - Max Scale */}
      <div className="flex justify-between items-center mt-1 font-mono text-[9px] text-white/50 tabular-nums">
        <span>{minVal} {units}</span>
        <span>{maxVal} {units}</span>
      </div>
    </div>
  );
};
