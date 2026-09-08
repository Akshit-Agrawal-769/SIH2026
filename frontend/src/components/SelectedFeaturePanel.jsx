import React from 'react';
import { Activity, Radio, ExternalLink } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const SelectedFeaturePanel = () => {
  const { selectedFloat, argoFloats, fetchComparison } = useOceanStore();

  // Use the explicitly selected float or default to the primary Indian Ocean float
  const float = selectedFloat || (argoFloats && argoFloats.length > 0 ? argoFloats[0] : {
    wmo_id: '1900816',
    platform_number: '1900816',
    num_cycles: 73,
    date: '1980-01-24',
    status: 'Active',
    latitude: -12.3,
    longitude: 84.1,
    max_depth: 1987,
  });

  const wmoId = float?.platform_number || float?.wmo_id || '1900816';
  const cycles = float?.profiles_count || float?.num_cycles || float?.cycle_number || 73;
  const startDate = float?.date || float?.first_profile_date || '1980-01-24';
  const status = float?.status || 'Active';
  const lat = float?.latest_position?.latitude ?? float?.latitude ?? -12.3;
  const lon = float?.latest_position?.longitude ?? float?.longitude ?? 84.1;
  const latStr = `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;
  const maxDepth = float?.max_depth ? Number(float.max_depth).toLocaleString() : '1,987';

  const handleViewProfile = () => {
    const target = float.platform_number || float.wmo_id || (argoFloats && argoFloats[0]?.platform_number) || '1900816';
    fetchComparison(target);
  };

  return (
    <div className="w-72 bg-[rgba(6,12,24,0.82)] backdrop-blur-xl rounded-2xl border border-sky-500/20 shadow-2xl p-4 text-white select-none transition-all">
      <h2 className="text-xs font-semibold tracking-wide text-white mb-2.5">
        Selected Feature
      </h2>

      {/* Float Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
          <h3 className="text-xs font-bold text-white tracking-wide">
            AOML Argo Float {wmoId}
          </h3>
        </div>
        <p className="text-[10px] text-slate-400 pl-4.5">
          Autonomous CTD Profiler ({cycles} Recorded Cycles)
        </p>
      </div>

      {/* Metadata Table */}
      <div className="space-y-1.5 text-xs py-2.5 px-3 bg-black/30 rounded-xl border border-white/[0.06] mb-3">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">Start Date</span>
          <span className="font-mono text-slate-200">{startDate} (UTC)</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">Status</span>
          <span className="font-medium text-emerald-400">{status}</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">Latest Position</span>
          <span className="font-mono text-slate-200">{latStr}, {lonStr}</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">Latest Depth</span>
          <span className="font-mono text-slate-200">{maxDepth} m</span>
        </div>
      </div>

      {/* View Profile Action */}
      <button
        onClick={handleViewProfile}
        className="w-full py-2 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600/35 border border-sky-400/40 text-sky-300 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        <Activity className="w-3.5 h-3.5" />
        <span>View Profile</span>
      </button>
    </div>
  );
};
