import React from 'react';
import { useOceanStore, VITAL_SIGNS_CATALOG } from '../store/oceanStore';

export const ColorbarLegend = () => {
  const volumeMeta = useOceanStore((state) => state.volumeMeta);
  const colormap = useOceanStore((state) => state.colormap);
  const activeVitalSign = useOceanStore((state) => state.activeVitalSign);

  const isLogScale = useOceanStore((state) => state.isLogScale);
  const toggleLogScale = useOceanStore((state) => state.toggleLogScale);

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
    <div className="absolute bottom-20 left-6 z-20 px-3.5 py-2.5 bg-[rgba(4,10,24,0.85)] backdrop-blur-2xl rounded-xl border border-sky-500/25 shadow-panel-dark text-white select-none max-w-[260px] pointer-events-auto animate-fade-slide">
      {/* Title & Unit */}
      <div className="flex items-center justify-between gap-2 mb-2 font-mono">
        <span className="text-[11px] font-bold truncate text-white uppercase tracking-wider">
          {sign.name}
        </span>
        <span className="text-[10px] text-sky-300 font-mono px-1 py-0.2 rounded bg-sky-500/15 border border-sky-400/30 shrink-0">
          {units}
        </span>
      </div>

      {/* Gradient Bar */}
      <div
        className="w-full h-2 rounded-full border border-white/10 shadow-inner"
        style={{ background: getGradient() }}
      />

      {/* Min - Max Scale & Log/Linear Mode */}
      <div className="flex justify-between items-center mt-1.5 font-mono text-[10px] text-slate-300 tabular-nums">
        <span>{minVal}</span>
        <button
          onClick={toggleLogScale}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-mono transition-all cursor-pointer ${
            isLogScale
              ? 'bg-sky-500/30 text-sky-300 border border-sky-400/50 shadow-glow-cyan-sm'
              : 'bg-black/40 text-slate-400 hover:text-white border border-white/[0.08]'
          }`}
          title="Toggle Logarithmic / Linear scale transfer function"
        >
          {isLogScale ? 'LOG SCALE' : 'LIN SCALE'}
        </button>
        <span>{maxVal} {units}</span>
      </div>
    </div>
  );
};
