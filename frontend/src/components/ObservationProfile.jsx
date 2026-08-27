import React from 'react';
import { Radio, CheckCircle2 } from 'lucide-react';

export const ObservationProfile = ({
  depths = [],
  obsValues = [],
  activeDepth,
  onSelectDepth,
  variable = 'temp',
  unit = '°C',
}) => {
  const validPairs = [];
  for (let i = 0; i < depths.length; i++) {
    const d = depths[i];
    const v = obsValues[i];
    if (d !== undefined && v !== null && v !== undefined && !isNaN(v)) {
      validPairs.push({ depth: d, val: v, index: i });
    }
  }

  const maxDepth = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.depth), 100) : 2000;
  const minVal = validPairs.length > 0 ? Math.min(...validPairs.map((p) => p.val)) : 0;
  const maxVal = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.val)) : 30;
  const valRange = maxVal - minVal || 1;

  const svgWidth = 340;
  const svgHeight = 320;
  const padLeft = 46;
  const padRight = 20;
  const padTop = 26;
  const padBottom = 26;

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

  return (
    <div className="instrument-well p-3 flex flex-col gap-2 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Radio className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-100">
            In-Situ Argo Observation
          </span>
        </div>
        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>QC 1 & 2 Verified</span>
        </span>
      </div>

      {/* SVG Plot */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-hairline)] rounded-[2px] p-2 flex items-center justify-center relative overflow-hidden">
        {validPairs.length > 0 ? (
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
            {/* Grid Depth Lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const y = padTop + frac * plotH;
              const dVal = (frac * maxDepth).toFixed(0);
              return (
                <g key={idx}>
                  <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                  <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                    {dVal}m
                  </text>
                </g>
              );
            })}

            {/* Value Bounds Labels */}
            <text x={padLeft} y={padTop - 8} textAnchor="start" fill="#34d399" fontSize="9" fontFamily="monospace">
              {minVal.toFixed(2)} {unit}
            </text>
            <text x={svgWidth - padRight} y={padTop - 8} textAnchor="end" fill="#34d399" fontSize="9" fontFamily="monospace">
              {maxVal.toFixed(2)} {unit}
            </text>

            {/* Active Depth Level Line */}
            {activeDepth !== undefined && (
              <line
                x1={padLeft}
                y1={depthToSvgY(activeDepth)}
                x2={svgWidth - padRight}
                y2={depthToSvgY(activeDepth)}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            )}

            {/* Observation Profile Curve */}
            <path
              d={profileSvgPath}
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {validPairs.map((p) => {
              const cx = valToSvgX(p.val);
              const cy = depthToSvgY(p.depth);
              const isSelected = activeDepth === p.depth;
              return (
                <circle
                  key={p.index}
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 4.5 : 2.5}
                  fill={isSelected ? '#f59e0b' : '#34d399'}
                  stroke={isSelected ? '#ffffff' : 'none'}
                  strokeWidth={isSelected ? 1.5 : 0}
                  className="cursor-pointer hover:r-4 transition-all"
                  onClick={() => onSelectDepth && onSelectDepth(p.depth)}
                >
                  <title>{`Depth: ${p.depth}m | Observation: ${p.val.toFixed(2)} ${unit}`}</title>
                </circle>
              );
            })}
          </svg>
        ) : (
          <div className="py-24 text-center text-slate-500 text-[11px]">
            No observation values recorded for this cycle.
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
        <span>Recorded Levels: <strong className="text-slate-200">{validPairs.length}</strong></span>
        <span>Surface Value: <strong className="text-emerald-300">{validPairs[0]?.val?.toFixed(2) ?? '—'} {unit}</strong></span>
      </div>
    </div>
  );
};
