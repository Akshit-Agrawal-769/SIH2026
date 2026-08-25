import React from 'react';
import {
  X,
  Cpu,
  Database,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const DiagnosticsDrawer = () => {
  const {
    isDiagnosticsOpen,
    toggleDiagnostics,
    health,
    datasets,
    activeDataset,
    metadata,
    argoFloats,
    volumeMeta,
    fetchInitialData,
    isLoading
  } = useOceanStore();

  if (!isDiagnosticsOpen) return null;

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950/95 border-l border-slate-800 text-slate-100 shadow-2xl backdrop-blur-md p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar select-none">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold tracking-wide uppercase font-mono text-slate-100">
            System & Data Diagnostics
          </h2>
        </div>
        <button
          onClick={toggleDiagnostics}
          title="Close Diagnostics Drawer"
          className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Health Status Card */}
      <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Backend API Gateway</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 animate-status' : 'bg-amber-400'}`} />
            <span className={`font-mono text-xs font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health?.status || 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span>Policy Protocol:</span>
          <span className="text-sky-300 font-bold">{health?.data_policy || 'STRICT NO MOCK DATA'}</span>
        </div>

        {health?.missing_datasets?.length > 0 && (
          <div className="mt-1 p-2 bg-amber-950/40 border border-amber-500/50 rounded text-[11px] text-amber-200">
            <div className="font-bold mb-0.5">Missing Required Real Datasets:</div>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] font-mono">
              {health.missing_datasets.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Model NetCDF Status */}
      <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">ROMS Model NetCDF Files</span>
          <span className="font-mono text-teal-300 font-bold">{datasets.length} Active</span>
        </div>
        <div className="flex flex-col gap-1 font-mono text-[11px]">
          {datasets.map((d) => (
            <div key={d} className={`p-1.5 rounded border ${d === activeDataset ? 'bg-sky-950/60 border-sky-500/60 text-sky-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}>
              {d} {d === activeDataset ? '(Active)' : ''}
            </div>
          ))}
          {datasets.length === 0 && (
            <div className="text-[11px] text-slate-500 italic">No model datasets found in datasets/model/</div>
          )}
        </div>
      </div>

      {/* In-Situ Argo Profiling Floats Inventory */}
      <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">In-Situ Argo Profiling Floats</span>
          <span className="font-mono text-amber-300 font-bold">{argoFloats.length} Floats</span>
        </div>
        <div className="flex flex-col gap-1.5 font-mono text-[11px]">
          {argoFloats.map((fl) => (
            <div key={fl.platform_number} className="p-2 bg-slate-950/60 border border-slate-800 rounded flex items-center justify-between">
              <div>
                <span className="text-amber-300 font-bold">WMO {fl.platform_number}</span>
                <span className="text-slate-500 text-[10px] block">
                  {fl.latest_position.latitude.toFixed(2)}°N, {fl.latest_position.longitude.toFixed(2)}°E
                </span>
              </div>
              <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                {fl.profiles_count} profiles
              </span>
            </div>
          ))}
          {argoFloats.length === 0 && (
            <div className="text-[11px] text-slate-500 italic">No Argo float netCDF files found in datasets/argo/</div>
          )}
        </div>
      </div>

      {/* Float32 Buffer & Shader Metrics */}
      <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2">
        <div className="text-xs font-semibold text-slate-300">3D Volumetric Texture Buffer</div>
        {volumeMeta ? (
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Resolution</span>
              {volumeMeta.dimX} x {volumeMeta.dimY} x {volumeMeta.dimZ}
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Min / Max Scalars</span>
              {volumeMeta.minVal.toFixed(2)} to {volumeMeta.maxVal.toFixed(2)} {volumeMeta.units}
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Memory Size</span>
              {((volumeMeta.dimX * volumeMeta.dimY * volumeMeta.dimZ * 4) / 1024).toFixed(1)} KB Float32
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Depth Span</span>
              {volumeMeta.minDepth} to {volumeMeta.maxDepth} m
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic">No 3D volume buffer loaded yet.</div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between">
        <button
          onClick={fetchInitialData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Backend Status</span>
        </button>

        <span className="font-mono text-[10px] text-slate-500">
          FastAPI + XArray + Three.js
        </span>
      </div>

    </div>
  );
};
