import React from 'react';
import { Activity } from './Icons';
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
    <div className="absolute bottom-20 left-4 z-20 p-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl text-slate-100 shadow-2xl min-w-[280px] max-w-xs select-none">

      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-bold tracking-wide text-slate-200">
            {varInfo.title}
          </span>
        </div>
        <span className="text-xs font-mono font-bold px-1.5 py-0.5 bg-slate-900 border border-slate-700/60 text-sky-300 rounded">
          {volumeMeta.units || 'unitless'}
        </span>
      </div>

      {/* Standard Name */}
      <div className="text-[9px] font-mono text-slate-500 truncate mb-2">
        CF: {varInfo.stdName}
      </div>

      {/* Colormap Scale Bar */}
      <div className="relative">
        <div
          className="w-full h-3 rounded shadow-inner border border-slate-700/50"
          style={{ background: getGradient() }}
        />

        {/* Scale Ticks */}
        <div className="flex justify-between mt-1.5 font-mono text-[11px] text-slate-300 tabular-nums">
          <div className="flex flex-col items-start">
            <span className="font-bold text-slate-200">{minVal}</span>
            <span className="text-[9px] text-slate-500">MIN</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-slate-400">{midVal}</span>
            <span className="text-[9px] text-slate-500">MID</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-bold text-slate-200">{maxVal}</span>
            <span className="text-[9px] text-slate-500">MAX</span>
          </div>
        </div>
      </div>

      {/* Land Mask / Null Indicator */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400">
        <span className="font-mono">Transfer: {colormap.toUpperCase()}</span>
        <span className="text-[9px] text-slate-500">Land: Masked / Discarded</span>
      </div>

    </div>
  );
};
