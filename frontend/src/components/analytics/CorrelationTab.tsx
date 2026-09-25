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
  date?: string;
}

export const CorrelationTab: React.FC<CorrelationTabProps> = ({
  lat,
  lon,
  depth,
  date
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ v1: string; v2: string; r: number | null } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchCorrelation(lat, lon, depth, date)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
                setError(err?.message || 'Failed to compute correlation matrix.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lon, depth, date]);

  if (loading) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3 text-ocean-muted">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Computing NxN Pearson correlation matrix across local ocean cells...</p>
      </div>
    );
  }

  if (error || !data || !data.available || !data.matrix.length) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed border-ocean-border rounded-xl">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <h4 className="text-sm font-semibold text-ocean-text-secondary">No Correlation Field Available</h4>
        <p className="text-xs text-ocean-muted max-w-md">
          {data?.reason || error || 'Point is on land or has insufficient co-located ocean cells.'}
        </p>
      </div>
    );
  }

  const varLabels: Record<string, string> = {
    temperature: 'Temp (°C)',
    salinity: 'Salinity (PSU)',
    currents: 'Current Speed (m/s)',
    mld: 'MLD (m)',
    chlorophyll: 'Chlorophyll (mg/m³)'
  };

  const getCellColor = (r: number | null) => {
    if (r === null || isNaN(r)) return 'bg-ocean-elevated text-neutral-500';
    if (r >= 0.99) return 'bg-teal-500/30 text-teal-200 font-bold border border-teal-400/40';
    if (r > 0.6) return 'bg-emerald-500/25 text-emerald-300 font-semibold';
    if (r > 0.2) return 'bg-emerald-500/15 text-emerald-200';
    if (r >= -0.2 && r <= 0.2) return 'bg-ocean-elevated/60 text-ocean-text-secondary';
    if (r < -0.6) return 'bg-teal-600/35 text-teal-200 font-semibold';
    return 'bg-teal-600/20 text-teal-300';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Dynamic Multi-Variable Pearson Correlation Matrix</span>
          </h4>
          <p className="text-xs text-ocean-muted mt-0.5">
            {data.sample_count} co-valid ocean cells in a 9×9-cell (≈1.1°) window, depth {depth} m, timestep {data.date}.
          </p>
        </div>
        <div className="text-xs font-mono px-2.5 py-1 rounded bg-ocean-bg border border-ocean-border text-teal-400">
          N = {data.sample_count} cells
        </div>
      </div>

      {/* NxN Heatmap Table */}
      <div className="overflow-x-auto bg-ocean-bg/70 border border-ocean-border rounded-xl p-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-[11px] font-mono text-ocean-muted uppercase tracking-wider">
                Variable
              </th>
              {data.variables.map((v) => (
                <th
                  key={v}
                  className="p-2 text-center text-[11px] font-mono text-ocean-text-secondary uppercase tracking-wider"
                >
                  {varLabels[v] || v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.variables.map((rowVar, i) => (
              <tr key={rowVar} className="border-t border-ocean-border/60">
                <td className="p-2.5 font-medium text-ocean-text-secondary whitespace-nowrap">
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
      <div className="bg-ocean-bg/50 border border-ocean-border/70 rounded-xl p-3 text-xs flex items-center justify-between min-h-[44px]">
        {hoveredCell && hoveredCell.r !== null ? (
          <div className="flex items-center gap-2 text-ocean-text-secondary">
            <span className="font-semibold text-teal-300">
              {hoveredCell.v1} ↔ {hoveredCell.v2}:
            </span>
            <span className="font-mono text-white font-bold">
              r = {hoveredCell.r.toFixed(3)}
            </span>
            <span className="text-ocean-muted">
              ({hoveredCell.r > 0.7
                ? 'strong positive'
                : hoveredCell.r > 0.3
                ? 'moderate positive'
                : hoveredCell.r < -0.7
                ? 'strong negative'
                : hoveredCell.r < -0.3
                ? 'moderate negative'
                : 'weak'})
            </span>
          </div>
        ) : (
          <div className="text-ocean-muted flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-neutral-500" />
            <span>Hover a cell to see the coefficient.</span>
          </div>
        )}
      </div>

      {/* Method note (descriptive statistics only) */}
      <div className="bg-ocean-bg/40 border border-ocean-border/60 rounded-xl p-3 text-[11px] text-ocean-muted space-y-1">
        <div className="font-semibold text-ocean-text-secondary flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>How to read this</span>
        </div>
        <p>
          Pearson r between fields that share the timestep {data.date}, over the cells of a 9×9 window (0.125° cells, ≈1.1°)
          around the point. Neighbouring cells are spatially autocorrelated, so no significance is implied, and r does not
          identify a physical cause. Chlorophyll is strongly skewed, so r for chlorophyll is sensitive to a few high values.
          {data.skipped && Object.keys(data.skipped).length > 0 && (
            <> Not co-temporal and excluded: {Object.entries(data.skipped).map(([k, v]) => `${k} (${v})`).join(', ')}.</>
          )}
        </p>
      </div>
    </div>
  );
};
