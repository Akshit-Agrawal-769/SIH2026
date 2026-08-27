import React from 'react';
import {
  X,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Radio,
  Layers,
  TrendingUp,
  Activity,
  Calendar,
  Layers2,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const DiagnosticsDrawer = () => {
  const {
    isDiagnosticsOpen,
    toggleDiagnostics,
    health,
    datasets,
    activeDataset,
    metadata,
    variable,
    timeIndex,
    depthLevelMeters,
    argoFloats,
    selectedFloat,
    selectedCycle,
    volumeMeta,
    volumeBuffer,
    comparisonData,
    fetchInitialData,
    isLoading,
  } = useOceanStore();

  if (!isDiagnosticsOpen) return null;

  const isHealthy = health?.status === 'healthy';
  const totalFrames = metadata?.time_range?.length || 1;
  const currentTs = metadata?.time_range?.[timeIndex] || '2026-07-18 12:00 UTC';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--surface-rack-backdrop)] backdrop-blur-md border-l border-[var(--border-hairline)] text-slate-200 p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar select-none shadow-2xl font-mono text-xs animate-in slide-in-from-right duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-sky-400" strokeWidth={1.75} />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-100">
            System & Reproducibility Diagnostics
          </h2>
        </div>
        <button
          onClick={toggleDiagnostics}
          title="Close Diagnostics Drawer"
          className="p-1 text-slate-400 hover:text-white hover:bg-[var(--surface-well)] rounded-[2px] transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* 1. Runtime State Summary */}
      <div className="p-2.5 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col gap-1.5">
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
          <span>ACTIVE SIMULATION STATE</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SYNCHRONIZED
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
            <span className="text-slate-500 block text-[8px]">DATASET</span>
            <strong className="text-slate-100 truncate block">{activeDataset || 'ROMS_Bio_2026.nc'}</strong>
          </div>
          <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
            <span className="text-slate-500 block text-[8px]">VARIABLE</span>
            <strong className="text-sky-300 uppercase">{variable} ({volumeMeta?.units || '°C'})</strong>
          </div>
          <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
            <span className="text-slate-500 block text-[8px]">FRAME & DEPTH</span>
            <strong className="text-slate-100">{timeIndex + 1} / {totalFrames} · {depthLevelMeters}m</strong>
          </div>
          <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
            <span className="text-slate-500 block text-[8px]">MODEL TIMESTAMP</span>
            <strong className="text-amber-300 text-[9px] truncate block">{currentTs}</strong>
          </div>
        </div>
      </div>

      {/* 2. WebGL 3D Texture & Buffer Metrics */}
      <div className="p-2.5 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col gap-1.5">
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
          <span>WEBGL 3D TEXTURE BUFFER</span>
          <span className={volumeBuffer ? 'text-sky-300' : 'text-slate-500'}>
            {volumeBuffer ? 'LOADED (FLOAT32)' : 'PENDING'}
          </span>
        </div>
        {volumeMeta ? (
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">GRID RESOLUTION</span>
              <strong className="text-sky-300">{volumeMeta.dimX} × {volumeMeta.dimY} × {volumeMeta.dimZ}</strong>
            </div>
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">SCALAR VALUE EXTENTS</span>
              <strong className="text-slate-100">{volumeMeta.minVal?.toFixed(2)} to {volumeMeta.maxVal?.toFixed(2)} {volumeMeta.units}</strong>
            </div>
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">BUFFER MEMORY</span>
              <strong className="text-slate-100">{((volumeMeta.dimX * volumeMeta.dimY * volumeMeta.dimZ * 4) / 1024).toFixed(1)} KB</strong>
            </div>
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">PHYSICAL DEPTH SPAN</span>
              <strong className="text-slate-100">{volumeMeta.minDepth}m to {volumeMeta.maxDepth}m</strong>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 italic p-1 bg-[var(--surface-base)]">No 3D volume buffer loaded yet.</div>
        )}
      </div>

      {/* 3. Colocation & Comparison State */}
      <div className="p-2.5 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col gap-1.5">
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
          <span>4D COMPARISON STATE</span>
          <span className="text-amber-400">
            {comparisonData ? `WMO ${comparisonData.platform_number}` : 'STANDBY'}
          </span>
        </div>
        {comparisonData ? (
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">VALID COLOCATED PAIRS</span>
              <strong className="text-sky-300">
                {comparisonData.metrics?.sample_count ?? 0} / {comparisonData.depths?.length ?? 0}
              </strong>
            </div>
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">INTERPOLATION METHOD</span>
              <strong className="text-slate-100 text-[9px]">4D Spatio-Temporal</strong>
            </div>
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">RMSE / MAE</span>
              <strong className="text-slate-100">{comparisonData.metrics?.rmse?.toFixed(3)} / {comparisonData.metrics?.mae?.toFixed(3)} {volumeMeta?.units || '°C'}</strong>
            </div>
            <div className="bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)]">
              <span className="text-slate-500 block text-[8px]">BIAS / PEARSON R</span>
              <strong className="text-slate-100">{comparisonData.metrics?.bias?.toFixed(3)} / {comparisonData.metrics?.pearson_r?.toFixed(3) ?? '—'}</strong>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 italic p-1 bg-[var(--surface-base)]">
            Select an Argo float in 3D Explorer or Observations to compute colocation metrics.
          </div>
        )}
      </div>

      {/* 4. Backend Gateway & In-Situ Array */}
      <div className="p-2.5 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-bold">API GATEWAY & PROVENANCE</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`text-xs font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health?.status ? health.status.toUpperCase() : 'ONLINE'}
            </span>
          </div>
        </div>
        <div className="text-[9px] text-slate-400 flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
          <span>QC DATA STANDARD:</span>
          <span className="text-sky-300 font-bold">{health?.data_policy || 'QC 1 & 2 ACCEPTED (NO MOCK DATA)'}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto pt-2.5 border-t border-[var(--border-hairline)] flex items-center justify-between">
        <button
          onClick={fetchInitialData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1 bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] text-slate-200 text-xs border border-[var(--border-hairline)] rounded-[2px] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          <span>REFRESH DIAGNOSTICS</span>
        </button>

        <span className="text-[10px] text-slate-500">
          FastAPI + Three.js WebGL2
        </span>
      </div>
    </div>
  );
};
