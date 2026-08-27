import React from 'react';
import { X, BookOpen, AlertTriangle, CheckCircle2, Sigma, Info } from 'lucide-react';

export const ComparisonMethodologyModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-[var(--surface-rack-backdrop)] backdrop-blur-md border border-[var(--border-hairline)] rounded-sm p-4 text-slate-200 flex flex-col gap-3.5 shadow-2xl font-mono text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" strokeWidth={1.75} />
            <h2 className="text-xs font-bold tracking-wider uppercase text-slate-100">
              4D Spatio-Temporal Colocation & Statistical Validation Methodology
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-[var(--surface-well)] rounded-[2px] transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 text-[11px] leading-relaxed">
          {/* Note on Interpolated Estimate vs Exact Grid */}
          <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-sm text-amber-200 text-[10px] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>SCIENTIFIC DISCLOSURE: 4D INTERPOLATED ESTIMATE</span>
            </div>
            <p>
              In-situ Argo profilers collect continuous physical measurements at discrete continuous coordinates \((x, y, z, t)\). Because the ROMS numerical model operates on a discretized hydrodynamic spatial and vertical s-coordinate grid, the observation is compared against a <strong>trilinearly/temporally interpolated model estimate</strong> evaluated at the exact physical location, depth, and time of the Argo observation, rather than an uncolocated raw grid point.
            </p>
          </div>

          {/* Mathematical Formulas */}
          <div className="flex flex-col gap-2">
            <span className="font-bold text-slate-100 uppercase text-[10px] flex items-center gap-1.5">
              <Sigma className="w-3.5 h-3.5 text-sky-400" />
              <span>Statistical Error Metrics</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
              {/* RMSE */}
              <div className="bg-[var(--surface-well)] p-2 border border-[var(--border-hairline)] rounded-sm">
                <strong className="text-sky-300 block mb-0.5">Root Mean Square Error (RMSE)</strong>
                <code className="text-slate-300 block mb-1">RMSE = √( (1/N) * Σ (mᵢ - oᵢ)² )</code>
                <span className="text-[9px] text-slate-400 font-sans">
                  Measures overall standard error deviation, heavily penalizing large vertical discrepancies.
                </span>
              </div>

              {/* MAE */}
              <div className="bg-[var(--surface-well)] p-2 border border-[var(--border-hairline)] rounded-sm">
                <strong className="text-sky-300 block mb-0.5">Mean Absolute Error (MAE)</strong>
                <code className="text-slate-300 block mb-1">MAE = (1/N) * Σ |mᵢ - oᵢ|</code>
                <span className="text-[9px] text-slate-400 font-sans">
                  Represents average magnitude of errors with linear weighting across the water column.
                </span>
              </div>

              {/* Bias */}
              <div className="bg-[var(--surface-well)] p-2 border border-[var(--border-hairline)] rounded-sm">
                <strong className="text-sky-300 block mb-0.5">Systematic Bias (Mean Error)</strong>
                <code className="text-slate-300 block mb-1">Bias = (1/N) * Σ (mᵢ - oᵢ)</code>
                <span className="text-[9px] text-slate-400 font-sans">
                  Positive indicates model overprediction; negative indicates model underprediction.
                </span>
              </div>

              {/* Pearson r */}
              <div className="bg-[var(--surface-well)] p-2 border border-[var(--border-hairline)] rounded-sm">
                <strong className="text-sky-300 block mb-0.5">Pearson Correlation (r)</strong>
                <code className="text-slate-300 block mb-1">r = Cov(m, o) / (σ_m * σ_o)</code>
                <span className="text-[9px] text-slate-400 font-sans">
                  Quantifies vertical stratification and thermocline/halocline phase fidelity (range [-1, 1]).
                </span>
              </div>
            </div>
          </div>

          {/* QC Quality Control Policy */}
          <div className="bg-[var(--surface-base)] p-2.5 border border-[var(--border-hairline)] rounded-sm flex flex-col gap-1 text-[10px]">
            <span className="font-bold text-slate-200 uppercase">Quality Control & Rejection Standards</span>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
              <li><strong>Accepted QC Flags:</strong> Flag 1 (Good Data) and Flag 2 (Probably Good Data).</li>
              <li><strong>Rejected QC Flags:</strong> Flag 3 (Bad Data - Potentially Correctable), Flag 4 (Bad Data), Flag 9 (Missing Data).</li>
              <li><strong>Vertical Calibration:</strong> Observation depth computed via TEOS-10 <code>gsw.z_from_p(pressure, latitude)</code>.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2 text-[10px] text-slate-500">
          <span>INCOIS Ocean Validation Engine · Strict Provenance</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] text-slate-200 rounded-[2px]"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
