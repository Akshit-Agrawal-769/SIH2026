import React from 'react';
import {
  X,
  Cpu,
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
    argoFloats,
    volumeMeta,
    fetchInitialData,
    isLoading
  } = useOceanStore();

  if (!isDiagnosticsOpen) return null;

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md glass-panel text-white/90 p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar select-none shadow-2xl animate-in slide-in-from-right duration-300">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-white/70" />
          <h2 className="text-xs font-medium tracking-wide uppercase font-mono text-white">
            System & Data Diagnostics
          </h2>
        </div>
        <button
          onClick={toggleDiagnostics}
          title="Close Diagnostics Drawer"
          className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Health Status Card */}
      <div className="p-2.5 bg-[#0b1322] border border-[#1e293b] flex flex-col gap-1.5 font-mono">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">BACKEND API GATEWAY</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`text-xs font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health?.status || 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-[#1e293b]">
          <span>QC DATA POLICY:</span>
          <span className="text-sky-300 font-bold">{health?.data_policy || 'QC 1 & 2 (NO MOCK DATA)'}</span>
        </div>

        {health?.missing_datasets?.length > 0 && (
          <div className="mt-1 p-2 bg-[#291b05] border border-amber-500/60 text-[10px] text-amber-200">
            <div className="font-bold mb-0.5">Missing Required Real Datasets:</div>
            <ul className="list-disc pl-4 space-y-0.5 font-mono">
              {health.missing_datasets.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Model NetCDF Status */}
      <div className="p-2.5 bg-[#0b1322] border border-[#1e293b] flex flex-col gap-1.5 font-mono">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">ROMS MODEL NETCDF FILES</span>
          <span className="text-teal-300 font-bold tabular-nums">{datasets.length} Active</span>
        </div>
        <div className="flex flex-col gap-0.5 text-[11px]">
          {datasets.map((d) => (
            <div key={d} className={`p-1 border ${d === activeDataset ? 'bg-[#10243e] border-sky-500 text-sky-200' : 'bg-[#070c18] border-[#1e293b] text-slate-400'}`}>
              {d} {d === activeDataset ? '(Active)' : ''}
            </div>
          ))}
          {datasets.length === 0 && (
            <div className="text-[11px] text-slate-500 italic p-1">No NetCDF files in datasets/model/</div>
          )}
        </div>
      </div>

      {/* In-Situ Argo Profiling Floats Inventory */}
      <div className="p-2.5 bg-[#0b1322] border border-[#1e293b] flex flex-col gap-1.5 font-mono">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">IN-SITU ARGO PROFILING FLOATS</span>
          <span className="text-amber-300 font-bold tabular-nums">{argoFloats.length} Floats</span>
        </div>
        <div className="flex flex-col gap-1 text-[11px]">
          {argoFloats.map((fl) => (
            <div key={fl.platform_number} className="p-1.5 bg-[#070c18] border border-[#1e293b] flex items-center justify-between">
              <div>
                <span className="text-amber-300 font-bold">WMO {fl.platform_number}</span>
                <span className="text-slate-500 text-[10px] block tabular-nums">
                  {fl.latest_position.latitude.toFixed(2)}°N, {fl.latest_position.longitude.toFixed(2)}°E
                </span>
              </div>
              <span className="text-slate-400 text-[10px] bg-[#0c1424] px-1 py-0.2 border border-[#1e293b]">
                {fl.profiles_count} profiles
              </span>
            </div>
          ))}
          {argoFloats.length === 0 && (
            <div className="text-[11px] text-slate-500 italic p-1">No Argo float netCDF files in datasets/argo/</div>
          )}
        </div>
      </div>

      {/* Float32 Buffer & Shader Metrics */}
      <div className="p-2.5 bg-[#0b1322] border border-[#1e293b] flex flex-col gap-1.5 font-mono">
        <div className="text-xs text-slate-300 uppercase">3D Volumetric Texture Buffer</div>
        {volumeMeta ? (
          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
            <div className="bg-[#070c18] p-1 border border-[#1e293b]">
              <span className="text-slate-500 block text-[9px]">RESOLUTION</span>
              {volumeMeta.dimX} x {volumeMeta.dimY} x {volumeMeta.dimZ}
            </div>
            <div className="bg-[#070c18] p-1 border border-[#1e293b]">
              <span className="text-slate-500 block text-[9px]">MIN / MAX SCALAR</span>
              {volumeMeta.minVal.toFixed(2)} to {volumeMeta.maxVal.toFixed(2)} {volumeMeta.units}
            </div>
            <div className="bg-[#070c18] p-1 border border-[#1e293b]">
              <span className="text-slate-500 block text-[9px]">MEMORY SIZE</span>
              {((volumeMeta.dimX * volumeMeta.dimY * volumeMeta.dimZ * 4) / 1024).toFixed(1)} KB Float32
            </div>
            <div className="bg-[#070c18] p-1 border border-[#1e293b]">
              <span className="text-slate-500 block text-[9px]">DEPTH SPAN</span>
              {volumeMeta.minDepth} to {volumeMeta.maxDepth} m
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic p-1">No 3D volume buffer loaded yet.</div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto pt-2.5 border-t border-[#1e293b] flex items-center justify-between font-mono">
        <button
          onClick={fetchInitialData}
          disabled={isLoading}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#0c1424] hover:bg-[#162138] text-slate-200 text-xs border border-[#1e293b] hover:border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>REFRESH STATUS</span>
        </button>

        <span className="text-[10px] text-slate-500">
          FastAPI + Three.js WebGL2
        </span>
      </div>

    </div>
  );
};
