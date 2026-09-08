import React from 'react';
import { X, Cpu, RefreshCw, Activity, ShieldCheck, Database, HardDrive } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const DiagnosticsDrawer = () => {
  const {
    isDiagnosticsOpen,
    toggleDiagnostics,
    health,
    datasets,
    activeDataset,
    argoFloats,
    volumeMeta,
    fetchInitialData,
    isLoading
  } = useOceanStore();

  if (!isDiagnosticsOpen) return null;

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[rgba(4,10,24,0.96)] backdrop-blur-2xl border-l border-sky-500/25 text-white p-5 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar select-none shadow-panel-dark animate-fade-slide">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 pulse-beacon" />
          <h2 className="text-xs font-bold tracking-wider uppercase font-mono text-white flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>SYSTEM &amp; DATA DIAGNOSTICS</span>
          </h2>
        </div>
        <button
          onClick={toggleDiagnostics}
          title="Close Diagnostics Drawer"
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Gateway Health Card ─── */}
      <div className="p-3 bg-black/40 border border-sky-500/20 rounded-xl flex flex-col gap-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold">BACKEND API GATEWAY</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 pulse-beacon' : 'bg-amber-400'}`} />
            <span className={`text-xs font-bold ${isHealthy ? 'text-emerald-300' : 'text-amber-300'}`}>
              {health?.status?.toUpperCase() || 'ONLINE / LOCAL PROXY'}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1.5 border-t border-white/[0.06]">
          <span>QUALITY CONTROL POLICY:</span>
          <span className="text-sky-300 font-bold">{health?.data_policy || 'QC 1 & 2 (NO SYNTHETIC MOCK)'}</span>
        </div>

        {health?.missing_datasets?.length > 0 && (
          <div className="mt-1 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-200">
            <div className="font-bold mb-1">Missing Real Datasets:</div>
            <ul className="list-disc pl-4 space-y-0.5 font-mono">
              {health.missing_datasets.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ─── NetCDF Model Datasets ─── */}
      <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl flex flex-col gap-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span>ACTIVE NETCDF-4 ARCHIVES</span>
          </span>
          <span className="text-sky-300 font-bold tabular-nums">{datasets.length} Active</span>
        </div>

        <div className="flex flex-col gap-1 text-[11px]">
          {datasets.map((d) => (
            <div key={d} className={`p-2 rounded-lg border ${d === activeDataset ? 'bg-sky-500/15 border-sky-400/40 text-sky-200' : 'bg-black/30 border-white/[0.05] text-slate-400'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{d}</span>
                {d === activeDataset && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
                    MOUNTED
                  </span>
                )}
              </div>
            </div>
          ))}
          {datasets.length === 0 && (
            <div className="text-[11px] text-slate-500 italic p-1">No NetCDF files in datasets/model/</div>
          )}
        </div>
      </div>

      {/* ─── In-Situ Argo Profiler Array ─── */}
      <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl flex flex-col gap-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>IN-SITU ARGO PROFILER ARRAY</span>
          </span>
          <span className="text-amber-300 font-bold tabular-nums">{argoFloats.length} Floats</span>
        </div>

        <div className="flex flex-col gap-1 text-[11px] max-h-40 overflow-y-auto custom-scrollbar">
          {argoFloats.map((fl) => (
            <div key={fl.platform_number} className="p-2 bg-black/30 rounded-lg border border-white/[0.05] flex items-center justify-between">
              <div>
                <span className="text-amber-300 font-bold">WMO {fl.platform_number}</span>
                <span className="text-slate-400 text-[10px] block tabular-nums">
                  {fl.latest_position.latitude.toFixed(2)}°N, {fl.latest_position.longitude.toFixed(2)}°E
                </span>
              </div>
              <span className="text-slate-300 text-[10px] bg-sky-500/10 px-2 py-0.5 rounded border border-sky-400/20">
                {fl.profiles_count} cycles
              </span>
            </div>
          ))}
          {argoFloats.length === 0 && (
            <div className="text-[11px] text-slate-500 italic p-1">No Argo float netCDF files in datasets/argo/</div>
          )}
        </div>
      </div>

      {/* ─── 3D Volumetric Buffer Specs ─── */}
      <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl flex flex-col gap-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            <span>3D TEXTURE VOLUMETRIC BUFFER</span>
          </span>
        </div>

        {volumeMeta ? (
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
            <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
              <span className="text-slate-400 block text-[9px]">VOXEL GRID</span>
              <span className="font-bold text-sky-200">{volumeMeta.dimX} × {volumeMeta.dimY} × {volumeMeta.dimZ}</span>
            </div>
            <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
              <span className="text-slate-400 block text-[9px]">SCALAR DYNAMICS</span>
              <span className="font-bold text-emerald-300">{volumeMeta.minVal.toFixed(1)} to {volumeMeta.maxVal.toFixed(1)} {volumeMeta.units}</span>
            </div>
            <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
              <span className="text-slate-400 block text-[9px]">TEXTURE RAM</span>
              <span className="font-bold text-purple-300">{((volumeMeta.dimX * volumeMeta.dimY * volumeMeta.dimZ * 4) / 1024).toFixed(1)} KB Float32</span>
            </div>
            <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
              <span className="text-slate-400 block text-[9px]">DEPTH EXTENT</span>
              <span className="font-bold text-amber-300">{volumeMeta.minDepth} to {volumeMeta.maxDepth} m</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic p-1">No 3D volume buffer loaded yet.</div>
        )}
      </div>

      {/* ─── Actions ─── */}
      <div className="mt-auto pt-3 border-t border-white/[0.08] flex items-center justify-between font-mono">
        <button
          onClick={fetchInitialData}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-xs border border-sky-400/40 rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>REFRESH TELEMETRY</span>
        </button>

        <span className="text-[10px] text-slate-500">
          FastAPI · WebGL2 · CesiumJS
        </span>
      </div>

    </div>
  );
};
