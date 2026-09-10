import React from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { Thermometer, Droplets, Activity, Compass, Wind } from 'lucide-react';

export const OceanHoverHUD: React.FC = () => {
  const { hoveredOceanInfo } = useOceanStore();

  if (!hoveredOceanInfo) return null;

  const { lon, lat, variable, depth, value, unit, screenX, screenY, currentSpeed, currentHeading } = hoveredOceanInfo;

  // Determine geographic basin name from coordinates
  const getBasinName = (lonVal: number, latVal: number): string => {
    if (latVal > 8.0 && lonVal < 77.0) return 'Arabian Sea Basin';
    if (latVal > 8.0 && lonVal >= 77.0 && lonVal <= 93.0) return 'Bay of Bengal Basin';
    if (lonVal > 93.0) return 'Andaman Sea Basin';
    if (latVal <= 8.0 && latVal >= 0.0 && lonVal >= 68.0 && lonVal <= 82.0) return 'Laccadive / India EEZ';
    if (latVal < 0.0) return 'Southern Indian Ocean';
    return 'Equatorial Indian Ocean';
  };

  const getVariableColor = () => {
    switch (variable) {
      case 'salinity':
        return { icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" />, text: 'text-cyan-400' };
      case 'chlorophyll':
        return { icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />, text: 'text-emerald-400' };
      case 'temperature':
      default:
        return { icon: <Thermometer className="w-3.5 h-3.5 text-red-400" />, text: 'text-amber-400' };
    }
  };

  const styleMeta = getVariableColor();
  const basin = getBasinName(lon, lat);

  // Position slightly offset from cursor, preventing off-screen overflow
  const hudLeft = Math.min(window.innerWidth - 220, screenX + 18);
  const hudTop = Math.min(window.innerHeight - 120, screenY + 18);

  return (
    <div
      className="fixed pointer-events-none z-50 bg-ocean-dark/94 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3 shadow-2xl shadow-cyan-950/50 min-w-[200px] flex flex-col gap-1.5 transition-all duration-75"
      style={{ left: hudLeft, top: hudTop }}
    >
      {/* Variable & Depth Tag */}
      <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-300">
        <div className="flex items-center gap-1">
          {styleMeta.icon}
          <span>{variable}</span>
        </div>
        <span className="font-mono text-cyan-400">
          {depth === 0.5 ? '0m (Surface)' : `${depth}m`}
        </span>
      </div>

      {/* Numerical Temperature Value */}
      <div className="flex items-baseline gap-1 my-0.5">
        <span className="font-mono text-2xl font-black text-white tracking-tight">
          {value.toFixed(1)}
        </span>
        <span className={`font-mono text-sm font-bold ${styleMeta.text}`}>
          {unit}
        </span>
      </div>

      {/* Geolocation & Basin info */}
      <div className="pt-1.5 border-t border-ocean-border/60 flex flex-col gap-0.5 text-[10px] text-slate-400">
        <div className="flex items-center gap-1 font-mono text-slate-300">
          <Compass className="w-3 h-3 text-cyan-500" />
          <span>{Math.abs(lat).toFixed(2)}°{lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(2)}°{lon >= 0 ? 'E' : 'W'}</span>
        </div>
        <div className="text-[9.5px] text-slate-400 font-medium">
          {basin}
        </div>
      </div>

      {/* Ocean Current Telemetry if available */}
      {currentSpeed !== undefined && (
        <div className="pt-1.5 border-t border-cyan-500/20 flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1 text-cyan-300">
            <Wind className="w-3 h-3 text-cyan-400" />
            <span>Current:</span>
          </div>
          <span className="font-bold text-white">
            {currentSpeed.toFixed(2)} m/s
            {currentHeading !== undefined && (
              <span className="text-cyan-400 text-[9px] ml-1 font-normal">({currentHeading}°)</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};
