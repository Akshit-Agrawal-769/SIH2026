import React from 'react';
import { TrendingUp, Layers, ArrowUpDown, Info } from 'lucide-react';

export const ResidualProfile = ({
  validPairs = [],
  activeDepth,
  onSelectDepth,
  variable = 'temp',
  unit = '°C',
}) => {
  if (!validPairs || validPairs.length === 0) {
    return (
      <div className="instrument-well p-4 flex flex-col items-center justify-center text-center text-slate-500 font-mono text-xs">
        <span>No colocated data pairs available to compute residuals.</span>
      </div>
    );
  }

  const maxDepth = Math.max(...validPairs.map((p) => p.depth), 100);
  const residuals = validPairs.map((p) => p.residual);
  const maxAbsResidual = Math.max(...residuals.map((r) => Math.abs(r)), 0.5);
  // Symmetric X domain: [-maxAbsResidual, +maxAbsResidual]
  const xLimit = Number((maxAbsResidual * 1.2).toFixed(2)) || 1.0;

  const svgWidth = 460;
  const svgHeight = 320;
  const padLeft = 46;
  const padRight = 30;
  const padTop = 26;
  const padBottom = 26;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const resToSvgX = (r) => padLeft + ((r + xLimit) / (2 * xLimit)) * plotW;
  const depthToSvgY = (d) => padTop + (d / maxDepth) * plotH;
  const zeroX = resToSvgX(0);

  let residualSvgPath = '';
  if (validPairs.length > 0) {
    residualSvgPath = validPairs.reduce((acc, pt, idx) => {
      const x = resToSvgX(pt.residual);
      const y = depthToSvgY(pt.depth);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }

  return (
    <div className="instrument-well p-3 flex flex-col gap-2 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
        <div className="flex items-center gap-1.5 text-amber-400">
          <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-100">
            Depth-Resolved Residuals (Model − Obs)
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          Zero-Reference Centered
        </span>
      </div>

      {/* SVG Residual Plot */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-hairline)] rounded-[2px] p-2 flex items-center justify-center relative overflow-hidden">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
          {/* Depth Grid Lines */}
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

          {/* Shaded Over/Under Prediction Zones */}
          <rect x={padLeft} y={padTop} width={zeroX - padLeft} height={plotH} fill="rgba(56, 189, 248, 0.03)" />
          <rect x={zeroX} y={padTop} width={svgWidth - padRight - zeroX} height={plotH} fill="rgba(244, 63, 94, 0.03)" />

          {/* Zero Reference Line */}
          <line x1={zeroX} y1={padTop} x2={zeroX} y2={svgHeight - padBottom} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />

          {/* Axis Range Labels */}
          <text x={padLeft} y={padTop - 8} textAnchor="start" fill="#38bdf8" fontSize="9" fontFamily="monospace">
            -{xLimit} {unit} (Under)
          </text>
          <text x={zeroX} y={padTop - 8} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">
            0.00 (Zero Bias)
          </text>
          <text x={svgWidth - padRight} y={padTop - 8} textAnchor="end" fill="#f43f5e" fontSize="9" fontFamily="monospace">
            +{xLimit} {unit} (Over)
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

          {/* Residual Path Line */}
          <path
            d={residualSvgPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Residual Nodes */}
          {validPairs.map((p) => {
            const cx = resToSvgX(p.residual);
            const cy = depthToSvgY(p.depth);
            const isSelected = activeDepth === p.depth;
            const isPos = p.residual >= 0;
            return (
              <circle
                key={p.index}
                cx={cx}
                cy={cy}
                r={isSelected ? 5 : 3}
                fill={isSelected ? '#ffffff' : (isPos ? '#f43f5e' : '#38bdf8')}
                stroke={isSelected ? '#f59e0b' : '#030712'}
                strokeWidth={1.5}
                className="cursor-pointer hover:r-4 transition-all"
                onClick={() => onSelectDepth && onSelectDepth(p.depth)}
              >
                <title>{`Depth: ${p.depth}m | Residual: ${p.residual > 0 ? `+${p.residual.toFixed(2)}` : p.residual.toFixed(2)} ${unit}`}</title>
              </circle>
            );
          })}
        </svg>
      </div>

      {/* Residual Discrete Depth Table */}
      <div className="flex flex-col gap-1 mt-1">
        <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase px-1">
          <span>Depth Breakdown</span>
          <span>Click Row to Jump Depth</span>
        </div>
        <div className="max-h-40 overflow-y-auto custom-scrollbar border border-[var(--border-hairline)] rounded-[2px]">
          <table className="w-full text-left border-collapse text-[10px]">
            <thead className="bg-[var(--surface-well)] text-slate-400 sticky top-0 border-b border-[var(--border-hairline)]">
              <tr>
                <th className="py-1 px-2">DEPTH</th>
                <th className="py-1 px-2">MODEL</th>
                <th className="py-1 px-2">OBS</th>
                <th className="py-1 px-2 text-right">RESIDUAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-base)]">
              {validPairs.map((p) => {
                const isSelected = activeDepth === p.depth;
                const isPos = p.residual >= 0;
                return (
                  <tr
                    key={p.index}
                    onClick={() => onSelectDepth && onSelectDepth(p.depth)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-950/70 text-amber-200 font-bold'
                        : 'hover:bg-[var(--surface-well)] text-slate-300'
                    }`}
                  >
                    <td className="py-0.5 px-2 font-mono">{p.depth} m</td>
                    <td className="py-0.5 px-2 font-mono text-sky-300">{p.model.toFixed(2)}</td>
                    <td className="py-0.5 px-2 font-mono text-emerald-300">{p.obs.toFixed(2)}</td>
                    <td className={`py-0.5 px-2 font-mono text-right font-bold ${isPos ? 'text-rose-400' : 'text-sky-400'}`}>
                      {p.residual > 0 ? `+${p.residual.toFixed(2)}` : p.residual.toFixed(2)} {unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
