import React from 'react';
import { useOceanStore } from '../store/oceanStore';

export const ColorbarLegend: React.FC = () => {
  const volumeMeta = useOceanStore((state) => state.volumeMeta);
  const colormap = useOceanStore((state) => state.colormap);
  const variable = useOceanStore((state) => state.variable);

  if (!volumeMeta) return null;

  const minVal = volumeMeta.minVal.toFixed(2);
  const maxVal = volumeMeta.maxVal.toFixed(2);
  const midVal = ((volumeMeta.minVal + volumeMeta.maxVal) / 2).toFixed(2);

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

  const getVarLabel = () => {
    switch (variable) {
      case 'temp': return 'Potential Temperature';
      case 'salt': return 'Practical Salinity';
      case 'u': return 'Zonal Current (u)';
      case 'v': return 'Meridional Current (v)';
      case 'chl': return 'Chlorophyll-a';
      default: return variable;
    }
  };

  return (
    <div className="absolute bottom-6 left-6 z-20 p-3 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-xl text-slate-100 shadow-2xl min-w-[280px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold tracking-wide text-slate-200">{getVarLabel()}</span>
        <span className="text-xs font-mono px-1.5 py-0.5 bg-slate-800 text-sky-400 rounded">
          {volumeMeta.units || 'unitless'}
        </span>
      </div>

      <div 
        className="w-full h-3.5 rounded-md shadow-inner border border-slate-700/50"
        style={{ background: getGradient() }}
      />

      <div className="flex justify-between mt-1 font-mono text-[11px] text-slate-400">
        <span>{minVal}</span>
        <span>{midVal}</span>
        <span>{maxVal}</span>
      </div>
    </div>
  );
};
