import React, { useState } from 'react';
import {
  TrendingUp,
  Activity,
  Droplets,
  Thermometer,
  RotateCcw,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ArgoProfile = ({ activeCycle }) => {
  const {
    selectedFloat,
    activeArgoProfile,
    selectFloatAndCompare,
    fetchArgoProfile,
    isLoading,
  } = useOceanStore();

  const [profileVar, setProfileVar] = useState('temp'); // 'temp' | 'salt'

  if (!selectedFloat) return null;

  // Extract depths and corresponding values
  const profileDepths = activeArgoProfile?.depths || [];
  const profileTemps = activeArgoProfile?.temperature || [];
  const profileSalts = activeArgoProfile?.salinity || [];

  const activeVals = profileVar === 'temp' ? profileTemps : profileSalts;
  const validPairs = [];
  for (let i = 0; i < profileDepths.length; i++) {
    const d = profileDepths[i];
    const v = activeVals[i];
    if (d !== undefined && v !== null && v !== undefined && !isNaN(v)) {
      validPairs.push({ depth: d, val: v });
    }
  }

  const maxDepth = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.depth), 100) : 2000;
  const minVal = validPairs.length > 0 ? Math.min(...validPairs.map((p) => p.val)) : 0;
  const maxVal = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.val)) : 30;
  const valRange = maxVal - minVal || 1;

  const svgWidth = 290;
  const svgHeight = 175;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 20;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const valToSvgX = (v) => padLeft + ((v - minVal) / valRange) * plotW;
  const depthToSvgY = (d) => padTop + (d / maxDepth) * plotH;

  let profileSvgPath = '';
  if (validPairs.length > 0) {
    profileSvgPath = validPairs.reduce((acc, pt, idx) => {
      const x = valToSvgX(pt.val);
      const y = depthToSvgY(pt.depth);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }

  const unit = profileVar === 'temp' ? '°C' : 'PSU';
  const varLabel = profileVar === 'temp' ? 'Potential Temperature' : 'Practical Salinity';

  return (
    <div className="instrument-well p-2.5 flex flex-col gap-2 font-mono text-xs select-none">
      {/* Variable Switcher */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
          CTD Water Column ({unit})
        </span>
        <div className="segmented-control">
          <button
            onClick={() => setProfileVar('temp')}
            className={`segmented-option ${profileVar === 'temp' ? 'segmented-option-active text-sky-400 font-bold' : ''}`}
          >
            TEMP
          </button>
          <button
            onClick={() => setProfileVar('salt')}
            className={`segmented-option ${profileVar === 'salt' ? 'segmented-option-active text-emerald-400 font-bold' : ''}`}
          >
            SAL
          </button>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-hairline)] rounded-[2px] p-1 flex items-center justify-center relative overflow-hidden">
        {validPairs.length > 0 ? (
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
            {/* Grid Depth Lines */}
            {[0, 0.33, 0.66, 1.0].map((frac, idx) => {
              const y = padTop + frac * plotH;
              const dVal = (frac * maxDepth).toFixed(0);
              return (
                <g key={idx}>
                  <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                  <text x={padLeft - 4} y={y + 3} textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">
                    {dVal}m
                  </text>
                </g>
              );
            })}

            {/* Value Bounds Labels */}
            <text x={padLeft} y={padTop - 4} textAnchor="start" fill="#64748b" fontSize="8" fontFamily="monospace">
              {minVal.toFixed(1)}{unit}
            </text>
            <text x={svgWidth - padRight} y={padTop - 4} textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">
              {maxVal.toFixed(1)}{unit}
            </text>

            {/* Profile Polyline Path */}
            <path
              d={profileSvgPath}
              fill="none"
              stroke={profileVar === 'temp' ? '#38bdf8' : '#34d399'}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Surface and Deepest Point Dots */}
            <circle cx={valToSvgX(validPairs[0].val)} cy={depthToSvgY(validPairs[0].depth)} r="3" fill="#f59e0b" />
            <circle cx={valToSvgX(validPairs[validPairs.length - 1].val)} cy={depthToSvgY(validPairs[validPairs.length - 1].depth)} r="3" fill="#a855f7" />
          </svg>
        ) : (
          <div className="py-8 flex flex-col items-center gap-1.5 text-slate-500 text-[10px]">
            {isLoading ? (
              <>
                <Activity className="w-4 h-4 animate-pulse text-sky-400" />
                <span>Loading CTD Profile for Cycle #{activeCycle}...</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-slate-600" />
                <span>No profile data recorded for Cycle #{activeCycle}</span>
                <button
                  onClick={() => fetchArgoProfile(selectedFloat.platform_number, activeCycle)}
                  className="px-2 py-0.5 mt-1 bg-[var(--surface-well)] border border-[var(--border-hairline)] text-slate-300 hover:text-white rounded-[2px]"
                >
                  RELOAD PROFILE
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Profile Summary Readout */}
      <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-400 bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)] rounded-[2px]">
        <div>
          <span>Levels: </span>
          <strong className="text-slate-200">{validPairs.length} pts</strong>
        </div>
        <div>
          <span>Max Depth: </span>
          <strong className="text-slate-200">{maxDepth.toFixed(0)} m</strong>
        </div>
      </div>

      {/* Contextual 4D Residual Comparison Action Button */}
      <button
        onClick={() => selectFloatAndCompare(selectedFloat)}
        disabled={validPairs.length === 0 || isLoading}
        className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold font-mono text-[11px] rounded-[2px] transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
        title={`Compare Cycle #${activeCycle} CTD Profile against 4D ROMS Model`}
      >
        <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
        <span>COMPUTE 4D RESIDUALS (CYCLE #{activeCycle})</span>
      </button>
    </div>
  );
};
