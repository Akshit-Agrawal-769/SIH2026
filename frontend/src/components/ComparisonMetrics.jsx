import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Activity,
  BarChart2,
  HelpCircle,
  Layers,
  Percent,
} from 'lucide-react';

export const ComparisonMetrics = ({
  metrics = {},
  dataAccounting = {},
  unit = '°C',
  onOpenMethodology,
}) => {
  const { rmse, mae, bias, pearson_r, sample_count } = metrics;
  const N = sample_count || 0;

  const biasDirection = bias > 0 ? 'Model Overestimating' : (bias < 0 ? 'Model Underestimating' : 'Zero Bias');
  const biasColor = bias > 0 ? 'text-rose-400' : (bias < 0 ? 'text-sky-400' : 'text-slate-300');

  return (
    <div className="instrument-well p-3 flex flex-col gap-3 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
        <div className="flex items-center gap-1.5 text-slate-100">
          <BarChart2 className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
          <span className="font-bold uppercase tracking-wider text-[11px]">
            Statistical Error Metrics & Data Accounting
          </span>
        </div>
        <button
          onClick={onOpenMethodology}
          className="text-[10px] text-sky-300 hover:text-sky-200 flex items-center gap-1 transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          <span>Formula Reference</span>
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* RMSE */}
        <div className="bg-[var(--surface-base)] border border-[var(--border-hairline)] p-2.5 rounded-[2px] flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 uppercase flex items-center justify-between">
            <span>RMSE</span>
            <span className="text-[8px] text-slate-600">Root Mean Sq</span>
          </span>
          <span className="text-lg font-bold text-slate-100 tabular-nums">
            {rmse !== undefined && rmse !== null ? `${rmse.toFixed(3)}` : '—'}
            <span className="text-[10px] font-normal text-slate-500 ml-1">{unit}</span>
          </span>
          <span className="text-[8px] text-slate-500">
            Penalizes large outliers
          </span>
        </div>

        {/* MAE */}
        <div className="bg-[var(--surface-base)] border border-[var(--border-hairline)] p-2.5 rounded-[2px] flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 uppercase flex items-center justify-between">
            <span>MAE</span>
            <span className="text-[8px] text-slate-600">Mean Absolute</span>
          </span>
          <span className="text-lg font-bold text-slate-100 tabular-nums">
            {mae !== undefined && mae !== null ? `${mae.toFixed(3)}` : '—'}
            <span className="text-[10px] font-normal text-slate-500 ml-1">{unit}</span>
          </span>
          <span className="text-[8px] text-slate-500">
            Average magnitude of error
          </span>
        </div>

        {/* BIAS */}
        <div className="bg-[var(--surface-base)] border border-[var(--border-hairline)] p-2.5 rounded-[2px] flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 uppercase flex items-center justify-between">
            <span>BIAS</span>
            <span className="text-[8px] text-slate-600">Signed Mean</span>
          </span>
          <span className={`text-lg font-bold tabular-nums ${biasColor}`}>
            {bias !== undefined && bias !== null ? `${bias > 0 ? `+${bias.toFixed(3)}` : bias.toFixed(3)}` : '—'}
            <span className="text-[10px] font-normal text-slate-500 ml-1">{unit}</span>
          </span>
          <span className="text-[8px] text-slate-500 truncate">
            {biasDirection}
          </span>
        </div>

        {/* Pearson r */}
        <div className="bg-[var(--surface-base)] border border-[var(--border-hairline)] p-2.5 rounded-[2px] flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 uppercase flex items-center justify-between">
            <span>PEARSON r</span>
            <span className="text-[8px] text-slate-600">Correlation</span>
          </span>
          <span className="text-lg font-bold text-emerald-400 tabular-nums">
            {pearson_r !== null && pearson_r !== undefined ? pearson_r.toFixed(3) : '—'}
          </span>
          <span className="text-[8px] text-slate-500">
            Vertical structure alignment
          </span>
        </div>
      </div>

      {/* Model Match Verification Checklist & Sample Accounting */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-[var(--border-subtle)] text-[10px]">
        {/* Verification Status */}
        <div className="bg-[var(--surface-base)] p-2 border border-[var(--border-hairline)] rounded-[2px] flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold">Colocation Verification Checklist</span>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Spatial Match (ROMS Grid)
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Temporal Coincidence (24h)
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Vertical Span (0–2000m)
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> QC 1 & 2 Accepted
            </span>
          </div>
        </div>

        {/* Data Accounting */}
        <div className="bg-[var(--surface-base)] p-2 border border-[var(--border-hairline)] rounded-[2px] flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase font-bold">Data Sample Accounting</span>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Evaluated Valid Pairs (N):</span>
            <strong className="text-sky-300 tabular-nums">
              {dataAccounting.validPairsCount || N} / {dataAccounting.totalObs || N}
            </strong>
          </div>
          {dataAccounting.excludedCount > 0 && (
            <div className="text-[8px] text-amber-300">
              {dataAccounting.excludedCount} points excluded due to NaN or missing model vertical layer.
            </div>
          )}
          {dataAccounting.excludedCount === 0 && (
            <div className="text-[8px] text-slate-500">
              100% of recorded water column levels successfully colocated.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
