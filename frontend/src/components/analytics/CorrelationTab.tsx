import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Activity,
  Info
} from 'lucide-react';
import { fetchCorrelation, CorrelationResponse } from '../../api/analyticsClient';

interface CorrelationTabProps {
  lat: number;
  lon: number;
  depth: number;
}

export const CorrelationTab: React.FC<CorrelationTabProps> = ({
  lat,
  lon,
  depth
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ v1: string; v2: string; r: number | null } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchCorrelation(lat, lon, depth)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[CorrelationTab] Fetch failed:', err);
        setError('Failed to compute correlation matrix.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lon, depth]);

  if (loading) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Computing NxN Pearson correlation matrix across local ocean cells...</p>
      </div>
    );
  }

  if (error || !data || !data.available || !data.matrix.length) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed border-ocean-border rounded-xl">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <h4 className="text-sm font-semibold text-slate-200">No Correlation Field Available</h4>
        <p className="text-xs text-slate-400 max-w-md">
          {data?.reason || error || 'Point is on land or has insufficient co-located ocean cells.'}
        </p>
      </div>
    );
  }

  const varLabels: Record<string, string> = {
    temperature: 'Temp (°C)',
    salinity: 'Salinity (PSU)',
    currents: 'Current Speed (m/s)',
    chlorophyll: 'Chlorophyll (mg/m³)'
  };

  const getCellColor = (r: number | null) => {
    if (r === null || isNaN(r)) return 'bg-slate-800 text-slate-500';
    if (r >= 0.99) return 'bg-cyan-500/30 text-cyan-200 font-bold border border-cyan-400/40';
    if (r > 0.6) return 'bg-emerald-500/25 text-emerald-300 font-semibold';
    if (r > 0.2) return 'bg-emerald-500/15 text-emerald-200';
    if (r >= -0.2 && r <= 0.2) return 'bg-slate-800/60 text-slate-300';
    if (r < -0.6) return 'bg-blue-600/35 text-blue-200 font-semibold';
    return 'bg-blue-600/20 text-blue-300';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Dynamic Multi-Variable Pearson Correlation Matrix</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Sampled across {data.sample_count} valid ocean cells in the surrounding ~100 km mesoscale neighborhood at depth {depth}m.
          </p>
        </div>
        <div className="text-xs font-mono px-2.5 py-1 rounded bg-ocean-dark border border-ocean-border text-cyan-400">
          N = {data.sample_count} cells
        </div>
      </div>

      {/* NxN Heatmap Table */}
      <div className="overflow-x-auto bg-ocean-dark/70 border border-ocean-border rounded-xl p-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Variable
              </th>
              {data.variables.map((v) => (
                <th
                  key={v}
                  className="p-2 text-center text-[11px] font-mono text-slate-300 uppercase tracking-wider"
                >
                  {varLabels[v] || v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.variables.map((rowVar, i) => (
              <tr key={rowVar} className="border-t border-ocean-border/60">
                <td className="p-2.5 font-medium text-slate-200 whitespace-nowrap">
                  {varLabels[rowVar] || rowVar}
                </td>
                {data.variables.map((colVar, j) => {
                  const r = data.matrix[i]?.[j] ?? null;
                  return (
                    <td
                      key={colVar}
                      onMouseEnter={() =>
                        setHoveredCell({
                          v1: varLabels[rowVar] || rowVar,
                          v2: varLabels[colVar] || colVar,
                          r
                        })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`p-2.5 text-center font-mono transition cursor-pointer rounded ${getCellColor(
                        r
                      )}`}
                    >
                      {r !== null && !isNaN(r) ? r.toFixed(3) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover Information / Context */}
      <div className="bg-ocean-dark/50 border border-ocean-border/70 rounded-xl p-3 text-xs flex items-center justify-between min-h-[44px]">
        {hoveredCell && hoveredCell.r !== null ? (
          <div className="flex items-center gap-2 text-slate-200">
            <span className="font-semibold text-cyan-300">
              {hoveredCell.v1} ↔ {hoveredCell.v2}:
            </span>
            <span className="font-mono text-white font-bold">
              r = {hoveredCell.r.toFixed(3)}
            </span>
            <span className="text-slate-400">
              ({hoveredCell.r > 0.7
                ? 'Strong Positive Coupling'
                : hoveredCell.r > 0.3
                ? 'Moderate Positive Coupling'
                : hoveredCell.r < -0.7
                ? 'Strong Inverse Coupling'
                : hoveredCell.r < -0.3
                ? 'Moderate Inverse Coupling'
                : 'Weak/Neutral Covariance'})
            </span>
          </div>
        ) : (
          <div className="text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Hover over any correlation cell in the matrix to inspect physical coupling metrics.</span>
          </div>
        )}
      </div>

      {/* Scientific Insights on Ocean Physics */}
      <div className="bg-ocean-dark/40 border border-ocean-border/60 rounded-xl p-3 text-xs text-slate-400 space-y-1">
        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Oceanographic Physics Grounding:</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
          <li>
            <strong className="text-slate-300">Temperature vs. Salinity:</strong> In the Bay of Bengal, negative correlation reflects buoyant, warm, low-salinity river discharge plumes (Ganga-Brahmaputra), whereas positive correlation indicates Arabian Sea high-salinity water mass intrusion.
          </li>
          <li>
            <strong className="text-slate-300">Temperature vs. Chlorophyll-a:</strong> Coastal upwelling delivers cold, nutrient-rich sub-surface water into the euphotic zone, typically producing an inverse correlation between SST and phytoplankton biomass.
          </li>
        </ul>
      </div>
    </div>
  );
};
