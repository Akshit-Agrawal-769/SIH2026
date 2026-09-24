import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Activity,
  AlertCircle
} from 'lucide-react';
import { fetchAnomalies, AnomalyResponse } from '../../api/analyticsClient';

interface AnomalyTabProps {
  variable: string;
  lat: number;
  lon: number;
  depth: number;
  units: string;
}

export const AnomalyTab: React.FC<AnomalyTabProps> = ({
  variable,
  lat,
  lon,
  depth,
  units
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnomalyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchAnomalies(variable, lat, lon, depth)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[AnomalyTab] Fetch failed:', err);
        setError('Failed to compute ocean anomalies.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [variable, lat, lon, depth]);

  if (loading) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3 text-ocean-muted">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Calculating authentic Z-score against basin baseline...</p>
      </div>
    );
  }

  if (error || !data || !data.available) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-2 p-6 text-center border border-dashed border-ocean-border rounded-xl">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <h4 className="text-sm font-semibold text-ocean-text-secondary">No Anomaly Baseline Available</h4>
        <p className="text-xs text-ocean-muted max-w-md">
          {data?.reason || error || 'Point is on land or outside active model domain.'}
        </p>
      </div>
    );
  }

  const z = data.z_score ?? 0;
  const isNormal = Math.abs(z) < 1.0;
  const isModerate = Math.abs(z) >= 1.0 && Math.abs(z) < 2.0;

  // Normalized position on [-3, +3] scale for visual slider (0% to 100%)
  const clampedZ = Math.max(-3.0, Math.min(3.0, z));
  const pointerPercent = ((clampedZ + 3.0) / 6.0) * 100;

  return (
    <div className="space-y-4">
      {/* Hero Z-score Card */}
      <div className="bg-ocean-bg/70 border border-ocean-border rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            className={`p-3.5 rounded-2xl border ${
              isNormal
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isModerate
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {isNormal ? (
              <CheckCircle className="w-8 h-8" />
            ) : (
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-ocean-muted uppercase tracking-wider">
                Statistical Z-Score
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  isNormal
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : isModerate
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {data.classification}
              </span>
            </div>
            <div className="text-3xl font-black tracking-tight mt-1 flex items-baseline gap-2">
              <span
                className={
                  isNormal
                    ? 'text-emerald-400'
                    : isModerate
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }
              >
                {z > 0 ? `+${z.toFixed(2)}` : z.toFixed(2)}σ
              </span>
              <span className="text-xs font-normal text-ocean-muted">
                standard deviations
              </span>
            </div>
            <p className="text-xs text-ocean-text-secondary mt-1">{data.description}</p>
          </div>
        </div>

        {/* Value vs Baseline Display */}
        <div className="bg-ocean-bg/90 border border-ocean-border/80 rounded-xl p-3 text-xs w-full sm:w-56 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-ocean-muted">Sample Value:</span>
            <span className="font-mono font-bold text-white">
              {data.value} {units}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ocean-muted">Basin Mean (μ):</span>
            <span className="font-mono text-teal-300">
              {data.baseline_mean} {units}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ocean-muted">Basin Std (σ):</span>
            <span className="font-mono text-ocean-text-secondary">
              {data.baseline_std} {units}
            </span>
          </div>
          <div className="border-t border-ocean-border/60 pt-1 flex justify-between items-center text-[10px] text-neutral-500">
            <span>Baseline Samples (N):</span>
            <span className="font-mono">{data.baseline_samples?.toLocaleString()} cells</span>
          </div>
        </div>
      </div>

      {/* Visual Normal Distribution Scale Bar */}
      <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center text-xs text-ocean-muted">
          <span>Standard Deviation Distribution (-3σ to +3σ)</span>
          <span className="font-mono text-[11px] text-teal-400">Current: {z.toFixed(2)}σ</span>
        </div>

        {/* Gradient Bar with Marker */}
        <div className="relative w-full h-4 rounded-full bg-gradient-to-r from-teal-600 via-emerald-500 to-rose-600 overflow-visible">
          {/* Center Zero Line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/80" />

          {/* Current Position Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 border-ocean-solid flex items-center justify-center transition-all duration-300"
            style={{ left: `${pointerPercent}%` }}
          >
            <div className="w-2 h-2 rounded-full bg-teal-500" />
          </div>
        </div>

        {/* Scale Ticks */}
        <div className="flex justify-between text-[10px] font-mono text-ocean-muted px-0.5">
          <span>-3σ (Extreme Cold/Low)</span>
          <span>-2σ</span>
          <span>-1σ</span>
          <span className="font-bold text-white">0 (Mean)</span>
          <span>+1σ</span>
          <span>+2σ</span>
          <span>+3σ (Extreme Warm/High)</span>
        </div>
      </div>

      {/* Scientific Methodology Context */}
      <div className="bg-ocean-bg/40 border border-ocean-border/60 rounded-xl p-3.5 text-xs text-ocean-text-secondary space-y-1 leading-relaxed">
        <div className="font-semibold text-ocean-text-secondary flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-teal-400" />
          <span>Scientific Z-Score Formulation:</span>
        </div>
        <p className="text-[11px] text-ocean-muted">
          The standardized anomaly is calculated dynamically as{' '}
          <code className="px-1 py-0.5 bg-ocean-bg rounded text-teal-300 font-mono">
            z = (x - μ) / σ
          </code>
          , where <span className="text-ocean-text-secondary">x</span> is the model value at {lat.toFixed(2)}°N, {lon.toFixed(2)}°E at depth {depth}m, and{' '}
          <span className="text-ocean-text-secondary">μ</span> and <span className="text-ocean-text-secondary">σ</span> are the spatial mean and standard deviation computed across all authentic oceanographic grid cells in the Indian Ocean basin for this depth layer.
        </p>
      </div>
    </div>
  );
};
