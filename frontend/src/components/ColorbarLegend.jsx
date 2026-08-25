import React from 'react';
import { useOceanStore } from '../store/oceanStore';

export const ColorbarLegend = () => {
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

  const getVarDetails = () => {
    switch (variable) {
      case 'temp': return { title: 'Potential Temperature', symbol: 'theta', stdName: 'sea_water_potential_temperature' };
      case 'salt': return { title: 'Practical Salinity', symbol: 'S_p', stdName: 'sea_water_practical_salinity' };
      case 'u': return { title: 'Zonal Velocity', symbol: 'u', stdName: 'eastward_sea_water_velocity' };
      case 'v': return { title: 'Meridional Velocity', symbol: 'v', stdName: 'northward_sea_water_velocity' };
      case 'chl': return { title: 'Chlorophyll-a', symbol: 'Chl-a', stdName: 'mass_concentration_of_chlorophyll_a' };
      default: return { title: variable, symbol: variable, stdName: variable };
    }
  };

  const varInfo = getVarDetails();

  return (
    <div className="absolute bottom-3 left-3 z-20 p-2.5 bg-[#080e1a] border border-[#1e293b] text-slate-100 min-w-[260px] max-w-xs select-none shadow-md">

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold font-mono tracking-wide text-slate-200 uppercase">
          {varInfo.title}
        </span>
        <span className="text-xs font-mono font-bold text-sky-300">
          [{volumeMeta.units || 'unitless'}]
        </span>
      </div>

      {/* CF Standard Name */}
      <div className="text-[9px] font-mono text-slate-500 truncate mb-1.5">
        CF: {varInfo.stdName}
      </div>

      {/* Colormap Scale Bar */}
      <div className="relative">
        <div
          className="w-full h-2.5 border border-[#1e293b]"
          style={{ background: getGradient() }}
        />

        {/* Scale Ticks */}
        <div className="flex justify-between mt-1 font-mono text-[10px] text-slate-300 tabular-nums">
          <div className="flex flex-col items-start">
            <span className="font-bold text-slate-200">{minVal}</span>
            <span className="text-[8px] text-slate-500">MIN</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-slate-400">{midVal}</span>
            <span className="text-[8px] text-slate-500">MID</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-bold text-slate-200">{maxVal}</span>
            <span className="text-[8px] text-slate-500">MAX</span>
          </div>
        </div>
      </div>

      {/* Land Mask / Null Indicator */}
      <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-[#1e293b] text-[9px] font-mono text-slate-400">
        <span>CMAP: {colormap.toUpperCase()}</span>
        <span className="text-slate-500">Land: Masked</span>
      </div>

    </div>
  );
};
