import React from 'react';
import { useOceanStore, VITAL_SIGNS_CATALOG } from '../store/oceanStore';

export const ActiveLayerPanel = () => {
  const { variable, colormap, metadata } = useOceanStore();

  // Find info from catalog or metadata
  const allSigns = [
    ...VITAL_SIGNS_CATALOG.surface,
    ...VITAL_SIGNS_CATALOG.subsurface,
    ...VITAL_SIGNS_CATALOG.dynamic,
  ];
  const activeSign = allSigns.find((s) => s.id === variable) || allSigns[0];

  // Dynamic range from backend NetCDF metadata or catalog
  const metaVar = metadata?.variables?.[variable];
  const minVal = metaVar?.min !== undefined
    ? Number(metaVar.min).toFixed(1)
    : activeSign.range[0].toFixed(1);
  const maxVal = metaVar?.max !== undefined
    ? Number(metaVar.max).toFixed(1)
    : activeSign.range[1].toFixed(1);
  const units = metaVar?.units || activeSign.units;

  // Colormap gradients
  const gradientStyles = {
    turbo: 'linear-gradient(to right, #30123b, #4145ab, #4675ed, #39a2fc, #1bcfd4, #24eca6, #61fc6c, #a4fc3b, #d1e834, #f3c63a, #fe9b2d, #f36315, #d93806, #b11902, #7a0403)',
    viridis: 'linear-gradient(to right, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
    thermal: 'linear-gradient(to right, #000004, #1b0c41, #4a0c6b, #781c6d, #a52c60, #cf4446, #ed6925, #fb9b06, #f7d13d, #fcffa4)',
    jet: 'linear-gradient(to right, #000080, #0000ff, #00ffff, #ffff00, #ff0000, #800000)',
  };

  const activeGradient = gradientStyles[colormap] || gradientStyles.turbo;

  return (
    <div className="w-72 bg-[rgba(6,12,24,0.82)] backdrop-blur-xl rounded-2xl border border-sky-500/20 shadow-2xl p-4 text-white select-none transition-all">
      <h2 className="text-xs font-semibold tracking-wide text-white mb-2.5">
        Active Layer
      </h2>

      {/* Layer Thumbnail & Info */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg border border-sky-400/30 flex items-center justify-center p-1 shadow-inner overflow-hidden"
          style={{ background: activeGradient }}
        >
          <div className="w-full h-full rounded bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-[9px] font-bold text-white uppercase tracking-wider opacity-90">
              {activeSign.code}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-white truncate">
            {activeSign.name} ({activeSign.code})
          </h3>
          <p className="text-[10px] text-slate-400 truncate">
            ROMS Global
          </p>
        </div>
      </div>

      {/* Colormap Colorbar */}
      <div>
        <div
          className="w-full h-3 rounded-full shadow-inner border border-white/10"
          style={{ background: activeGradient }}
        />
        <div className="flex justify-between items-center text-[10px] font-mono font-medium text-slate-300 mt-1.5 px-0.5">
          <span>{minVal} {units}</span>
          <span>{maxVal} {units}</span>
        </div>
      </div>
    </div>
  );
};
