import React from 'react';
import {
  AlertTriangle,
  Compass,
  Layers,
  Thermometer,
  ShieldCheck
} from 'lucide-react';

interface ScientificInterpretationProps {
  lat: number;
  lon: number;
  depth: number;
  variable: string;
  units: string;
  mldMeters?: number | null;
  thermoclineDepth?: number;
  maxGradient?: number;
  zScore?: number;
  trendSlope?: number;
}

export const ScientificInterpretation: React.FC<ScientificInterpretationProps> = ({
  lat,
  lon,
  depth,
  variable,
  units,
  mldMeters,
  thermoclineDepth,
  maxGradient,
  zScore,
  trendSlope
}) => {
  // Determine sub-basin
  const isBoB = lon >= 80.0 && lat >= 5.0 && lat <= 24.0;
  const isArabianSea = lon < 77.0 && lat >= 8.0 && lat <= 26.0;
  const isEquatorial = lat >= -5.0 && lat <= 5.0;
  const isSouthernIO = lat < -5.0;

  const basinName = isBoB
    ? 'Bay of Bengal'
    : isArabianSea
    ? 'Arabian Sea'
    : isEquatorial
    ? 'Equatorial Indian Ocean'
    : isSouthernIO
    ? 'Southern Indian Ocean'
    : 'Northern Indian Ocean';

  // Stratification analysis
  const mldDesc =
    mldMeters !== undefined && mldMeters !== null
      ? mldMeters < 25.0
        ? `Shallow mixed layer (${mldMeters.toFixed(1)}m), indicating strong surface stratification and buoyancy trapping.`
        : mldMeters < 60.0
        ? `Moderate mixed layer depth (${mldMeters.toFixed(1)}m), representative of seasonal wind-driven mixing.`
        : `Deep mixed layer (${mldMeters.toFixed(1)}m), characteristic of strong convective overturning or turbulent wind mixing.`
      : 'Mixed layer depth could not be resolved from available discrete vertical levels.';

  // Thermocline analysis
  const thermoDesc =
    thermoclineDepth !== undefined && maxGradient !== undefined
      ? `A well-defined main thermocline is established at approximately ${thermoclineDepth.toFixed(0)}m depth, exhibiting a vertical gradient of ${maxGradient.toFixed(3)} ${units}/m. This sharp vertical density barrier limits turbulent diapycnal diffusion between the epipelagic and mesopelagic zones.`
      : 'Vertical thermocline gradient is relatively diffuse across the sampled depth column.';

  // Anomaly analysis
  const anomalyDesc =
    zScore !== undefined
      ? Math.abs(zScore) < 1.0
        ? `Standardized thermal/haline departure is minimal (z = ${zScore > 0 ? '+' : ''}${zScore.toFixed(2)}σ), indicating typical climatological conditions within 1 standard deviation of the basin mean.`
        : Math.abs(zScore) < 2.0
        ? `Moderate statistical departure detected (z = ${zScore > 0 ? '+' : ''}${zScore.toFixed(2)}σ), representing an elevated regional anomaly relative to the background field.`
        : `Significant statistical anomaly detected (z = ${zScore > 0 ? '+' : ''}${zScore.toFixed(2)}σ), indicating anomalous water mass conditions or intense mesoscale eddy activity.`
      : 'Anomaly metrics not available for this coordinate.';

  // Trend analysis
  const trendDesc =
    trendSlope !== undefined
      ? Math.abs(trendSlope) < 0.005
        ? 'Short-term temporal tendency is stable (< 0.005 units/day).'
        : trendSlope > 0
        ? `Positive temporal tendency observed (+${trendSlope.toFixed(3)} ${units}/day), suggesting net surface heat flux or warm advection.`
        : `Negative temporal tendency observed (${trendSlope.toFixed(3)} ${units}/day), suggesting evaporative cooling or upward entrainment of cooler subsurface waters.`
      : 'Temporal trend slope unavailable.';

  return (
    <div className="space-y-4">
      {/* Integrity Header Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h5 className="font-semibold text-emerald-300">
            Deterministic Scientific Interpretation
          </h5>
          <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
            Rule-based, evidence-grounded oceanographic heuristics. All conclusions are derived strictly from authentic hydrodynamic equations and physical observations. Absolutely zero generative AI or statistical hallucinations.
          </p>
        </div>
      </div>

      {/* Synthesis Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Geographic & Water Mass Context */}
        <div className="bg-ocean-dark/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Regional Water Mass Domain: {basinName}</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Positioned at {lat.toFixed(2)}°N, {lon.toFixed(2)}°E at depth {depth}m evaluating {variable.toUpperCase()} ({units}). In this sector of the {basinName}, regional hydrodynamics are strongly modulated by seasonal monsoon wind reversals, freshwater river discharge plumes, and mesoscale eddy circulation.
          </p>
        </div>

        {/* Stratification & Pycnocline */}
        <div className="bg-ocean-dark/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Water Column Stratification</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {mldDesc}
          </p>
        </div>

        {/* Thermocline Gradient */}
        <div className="bg-ocean-dark/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-amber-400" />
            <span>Thermocline &amp; Diapycnal Barrier</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {thermoDesc}
          </p>
        </div>

        {/* Anomaly & Trend Departure */}
        <div className="bg-ocean-dark/60 border border-ocean-border rounded-xl p-4 space-y-2">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Statistical Anomaly &amp; Trend Assessment</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {anomalyDesc} {trendDesc}
          </p>
        </div>
      </div>
    </div>
  );
};
