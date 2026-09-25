import React from 'react';
import { Compass, Layers, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { AnomalyResponse, TimeSeriesResponse, VerticalProfileResponse } from '../../api/analyticsClient';

interface ScientificInterpretationProps {
  lat: number;
  lon: number;
  depth: number;
  variable: string;
  units: string;
  date?: string;
  profile?: VerticalProfileResponse | null;
  anomaly?: AnomalyResponse | null;
  timeseries?: TimeSeriesResponse | null;
}

/** Approximate basin label from coordinates (for orientation only). */
function basinName(lat: number, lon: number): string {
  if (lon >= 80 && lat >= 5 && lat <= 24) return 'Bay of Bengal';
  if (lon < 77 && lat >= 8 && lat <= 26) return 'Arabian Sea';
  if (lat >= -5 && lat <= 5) return 'Equatorial Indian Ocean';
  if (lat < -5) return 'Southern tropical Indian Ocean';
  return 'Northern Indian Ocean';
}

/**
 * Deterministic summary of the computed numbers. It states what was measured and how,
 * and deliberately makes no causal claims (heat flux, advection, eddies) that these
 * statistics cannot support. No machine learning is involved.
 */
export const ScientificInterpretation: React.FC<ScientificInterpretationProps> = ({
  lat, lon, depth, variable, units, date, profile, anomaly, timeseries
}) => {
  const mld = profile?.model_mld_meters;
  const zText = anomaly?.available && anomaly.z_score !== undefined
    ? `The ${variable} value at this point on ${anomaly.date} is ${anomaly.value} ${units}, ${anomaly.z_score > 0 ? '+' : ''}${anomaly.z_score.toFixed(2)} standard deviations from the same-day mean of ${anomaly.baseline_samples} ocean cells in the 35–100°E, 10°S–25°N domain (${anomaly.classification?.toLowerCase()}). This is a spatial departure, not an anomaly relative to a climatology.`
    : `Spatial z-score unavailable${anomaly?.reason ? `: ${anomaly.reason}` : '.'}`;
  const trendText = timeseries?.available && timeseries.trend_slope_per_30_days !== undefined
    ? `Over ${timeseries.interval}, an ordinary least-squares line through the ${timeseries.timeseries_points.length} monthly values has a slope of ${timeseries.trend_slope_per_30_days > 0 ? '+' : ''}${timeseries.trend_slope_per_30_days} ${units} per 30 days (range ${timeseries.min}–${timeseries.max} ${units}). The seasonal cycle is not removed, so this is not a long-term trend.`
    : `Time series unavailable${timeseries?.reason ? `: ${timeseries.reason}` : '.'}`;
  const mldText = mld !== undefined && mld !== null
    ? `The INCOIS Bio-ROMS model diagnoses a mixed layer depth of ${mld} m here on ${profile?.date}. The model provides surface fields only, so no thermocline or vertical gradient can be derived from it; use an Argo profile for vertical structure.`
    : `No model MLD available${profile?.reason ? ` (${profile.reason})` : ''}.`;

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h5 className="font-semibold text-emerald-300">Deterministic summary</h5>
          <p className="text-ocean-text-secondary text-[11px] mt-0.5 leading-relaxed">
            Plain-language restatement of the statistics computed for this point. It is rule-based (no AI/ML) and
            makes no claims about physical causes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <section className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <h4 className="font-semibold text-ocean-text-secondary flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-teal-400" /> Location
          </h4>
          <p className="text-ocean-muted text-[11px] leading-relaxed">
            {lat.toFixed(2)}°N, {lon.toFixed(2)}°E ({basinName(lat, lon)}, approximate), depth {depth} m, variable {variable}
            {date ? `, timestep ${date.slice(0, 10)}` : ''}.
          </p>
        </section>
        <section className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <h4 className="font-semibold text-ocean-text-secondary flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-teal-400" /> Mixed layer
          </h4>
          <p className="text-ocean-muted text-[11px] leading-relaxed">{mldText}</p>
        </section>
        <section className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <h4 className="font-semibold text-ocean-text-secondary flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Spatial departure
          </h4>
          <p className="text-ocean-muted text-[11px] leading-relaxed">{zText}</p>
        </section>
        <section className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <h4 className="font-semibold text-ocean-text-secondary flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-teal-400" /> Monthly series
          </h4>
          <p className="text-ocean-muted text-[11px] leading-relaxed">{trendText}</p>
        </section>
      </div>
    </div>
  );
};
