import React, { useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Radio,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Search,
  Activity,
  Layers
} from '../components/Icons';

export const ArgoPage = () => {
  const {
    argoFloats,
    selectedFloat,
    selectFloat,
    selectFloatAndCompare,
    selectedCycle,
    setSelectedCycle,
    setActivePage,
    focusCoordinateInExplorer,
  } = useOceanStore();

  const [searchTerm, setSearchTerm] = useState('');

  const filteredFloats = (argoFloats || []).filter((f) => {
    const term = searchTerm.toLowerCase();
    const wmo = String(f.platform_number || '').toLowerCase();
    const dac = String(f.dac || '').toLowerCase();
    return wmo.includes(term) || dac.includes(term);
  });

  const activeFloat = selectedFloat || (argoFloats && argoFloats.length > 0 ? argoFloats[0] : null);
  const cycles = activeFloat?.cycles || [];
  const activeCycleNum = selectedCycle !== null && selectedCycle !== undefined ? selectedCycle : (cycles[0] ?? 1);

  return (
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
                IN-SITU OBSERVATIONAL TELEMETRY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
              Coriolis Argo Profiling Network
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl">
              Autonomous oceanographic profiling floats across the Indian Ocean basin. Ingesting temperature, practical salinity, and pressure profiles standardized under TEOS-10 with strict QC 1 & 2 validation.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3 py-1.5 bg-[#080e1a] border border-amber-500/40 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-300 font-bold">{argoFloats?.length || 0} Profilers Registered</span>
            </div>
          </div>
        </div>

        {/* Main Grid: Floats Directory (5 Cols) + Selected Float Deep Dive (7 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Float Directory List */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search WMO or DAC..."
                className="w-full pl-9 pr-3 py-2 bg-[#080e1a] border border-[#1e293b] text-slate-200 text-xs font-bold focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Float Cards List */}
            <div className="flex flex-col gap-2 max-h-[620px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredFloats.length > 0 ? (
                filteredFloats.map((float) => {
                  const isSelected = activeFloat?.platform_number === float.platform_number;
                  return (
                    <div
                      key={float.platform_number}
                      onClick={() => selectFloat(float)}
                      className={`p-3 border cursor-pointer transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-[#121c2e] border-amber-500 text-white shadow-md'
                          : 'bg-[#080e1a] border-[#1e293b] text-slate-300 hover:border-slate-600 hover:bg-[#0c1424]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 ${isSelected ? 'bg-amber-400' : 'bg-slate-500'}`} />
                          <span className="font-bold text-xs text-amber-300">
                            WMO {float.platform_number}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#040814] border border-[#1e293b] text-slate-400">
                          {float.dac || 'CORIOLIS'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Lat: {float.latest_position?.latitude?.toFixed(2)}°N | Lon: {float.latest_position?.longitude?.toFixed(2)}°E
                        </span>
                        <span className="text-slate-300 font-bold">
                          {float.cycle_count || float.cycles?.length || 1} Cycles
                        </span>
                      </div>

                      {float.last_date && (
                        <div className="text-[10px] text-slate-500">
                          Last profile: {float.last_date.split('T')[0]}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-[#080e1a] border border-[#1e293b]">
                  No floats found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Float Details & Profile Visualizer */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {activeFloat ? (
              <div className="flex flex-col gap-4">
                {/* Float Identity Card */}
                <div className="p-5 bg-[#080e1a] border border-amber-500/50 shadow-xl flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e293b] pb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-amber-400" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white tracking-wider">
                          FLOAT WMO {activeFloat.platform_number}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          DAC: {activeFloat.dac || 'CORIOLIS GDAC'} · Platform Type: PROVOR / APEX Profiler
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (activeFloat.latest_position) {
                            focusCoordinateInExplorer(
                              activeFloat.latest_position.latitude,
                              activeFloat.latest_position.longitude,
                              `Argo WMO ${activeFloat.platform_number}`
                            );
                          }
                        }}
                        className="px-3 py-1.5 bg-[#0c1424] hover:bg-sky-950 border border-sky-500/50 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>VIEW IN 3D SCENE</span>
                      </button>

                      <button
                        onClick={() => {
                          selectFloatAndCompare(activeFloat);
                          setActivePage('comparison');
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-amber-950/50"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>COMPARE WITH MODEL</span>
                      </button>
                    </div>
                  </div>

                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase">POSITION</span>
                      <span className="text-slate-200 font-bold">
                        {activeFloat.latest_position?.latitude?.toFixed(2)}°N, {activeFloat.latest_position?.longitude?.toFixed(2)}°E
                      </span>
                    </div>
                    <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase">MAX DEPTH</span>
                      <span className="text-teal-300 font-bold">2000 dbar (~2000m)</span>
                    </div>
                    <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase">TOTAL PROFILES</span>
                      <span className="text-amber-300 font-bold">
                        {activeFloat.cycle_count || activeFloat.cycles?.length || 1} Cycles
                      </span>
                    </div>
                    <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase">QC POLICY</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>QC 1 & 2 ONLY</span>
                      </span>
                    </div>
                  </div>

                  {/* Cycle Selector */}
                  {cycles.length > 0 && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-xs text-slate-400">Select Cycle Profile:</span>
                      <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-thin">
                        {cycles.map((c) => (
                          <button
                            key={c}
                            onClick={() => setSelectedCycle(c)}
                            className={`px-2.5 py-1 text-xs font-bold border transition-colors ${
                              activeCycleNum === c
                                ? 'bg-amber-500 border-amber-400 text-slate-950 font-black'
                                : 'bg-[#0c1424] border-[#1e293b] text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            #{c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Physical Properties Explanation */}
                <div className="p-4 bg-[#080e1a] border border-[#1e293b] text-xs flex flex-col gap-3">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-400" />
                    <span>Observed Water Column Parameters</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                    <div className="p-3 bg-[#040814] border border-[#1e293b] flex flex-col gap-1">
                      <span className="text-sky-300 font-bold">TEMP (°C)</span>
                      <p className="text-slate-400 text-[10px] leading-tight">
                        In-situ temperature measured by SBE41 CTD sensor, calibrated to ITS-90 scale.
                      </p>
                    </div>
                    <div className="p-3 bg-[#040814] border border-[#1e293b] flex flex-col gap-1">
                      <span className="text-teal-300 font-bold">PSAL (PSU)</span>
                      <p className="text-slate-400 text-[10px] leading-tight">
                        Practical salinity calculated from conductivity ratios on the PSS-78 standard.
                      </p>
                    </div>
                    <div className="p-3 bg-[#040814] border border-[#1e293b] flex flex-col gap-1">
                      <span className="text-amber-300 font-bold">PRES (dbar)</span>
                      <p className="text-slate-400 text-[10px] leading-tight">
                        Hydrostatic water pressure converted to absolute depths (m) via TEOS-10 equations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500 bg-[#080e1a] border border-[#1e293b]">
                Select an Argo profiler from the directory to inspect its water column
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};