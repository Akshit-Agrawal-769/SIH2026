import React from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Layers,
  Crosshair,
  Radio,
  Compass,
  Activity,
  Database,
  Info,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Cpu
} from '../components/Icons';

export const HomePage = () => {
  const {
    setActivePage,
    toggleGoToLocationModal,
    metadata,
    activeDataset,
    argoFloats,
    health,
  } = useOceanStore();

  const minLat = metadata?.bounds?.min_lat ?? -30.0;
  const maxLat = metadata?.bounds?.max_lat ?? 30.0;
  const minLon = metadata?.bounds?.min_lon ?? 30.0;
  const maxLon = metadata?.bounds?.max_lon ?? 120.0;
  const timeStepsCount = metadata?.time_steps ?? 480;
  const variablesCount = metadata?.variables?.length ?? 10;
  const floatCount = argoFloats?.length ?? 0;

  const modules = [
    {
      id: 'explorer',
      title: '3D Ocean Explorer',
      badge: 'WEBGL2 INTERACTIVE',
      desc: 'Interactive 3D raymarching and 2D surface field visualization of the entire Indian Ocean domain in ~3:2 geographic proportion with Natural Earth coastline boundaries.',
      icon: Layers,
      color: 'text-sky-400',
      borderColor: 'border-sky-500/40 hover:border-sky-400',
      action: () => setActivePage('explorer'),
      cta: 'LAUNCH 3D EXPLORER',
    },
    {
      id: 'coordinates',
      title: 'Coordinate Explorer',
      badge: 'GEOSPATIAL LOCATOR',
      desc: 'Precision latitude/longitude targeting. Compute nearest model grid cell, nearest in-situ Argo profiling float, distance in km, and physical scalar field value.',
      icon: Crosshair,
      color: 'text-teal-400',
      borderColor: 'border-teal-500/40 hover:border-teal-400',
      action: () => setActivePage('coordinates'),
      cta: 'EXPLORE COORDINATES',
    },
    {
      id: 'argo',
      title: 'In-Situ Argo Network',
      badge: 'CORIOLIS GDAC',
      desc: 'Interactive float trajectory tracking and vertical profile inspection (Temperature, Salinity, Pressure) filtered strictly to scientific QC flags 1 & 2.',
      icon: Radio,
      color: 'text-amber-400',
      borderColor: 'border-amber-500/40 hover:border-amber-400',
      action: () => setActivePage('argo'),
      cta: 'VIEW ARGO FLOATS',
    },
    {
      id: 'comparison',
      title: 'Model vs Observation',
      badge: '4D RESIDUAL COLOCATION',
      desc: 'Rigorous 4D spatio-temporal validation comparing ROMS model fields against in-situ Argo water columns. Statistical scorecards for RMSE, MAE, Bias, and Pearson r.',
      icon: Compass,
      color: 'text-indigo-400',
      borderColor: 'border-indigo-500/40 hover:border-indigo-400',
      action: () => setActivePage('comparison'),
      cta: 'COMPUTE 4D RESIDUALS',
    },
    {
      id: 'analytics',
      title: 'Decadal Analytics',
      badge: '40-YEAR TIME SERIES',
      desc: 'Temporal and spatial trend analysis across 480 monthly timesteps (1980—2019). Seasonal cycle decomposition, basin averages, and multi-variable correlations.',
      icon: Activity,
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/40 hover:border-emerald-400',
      action: () => setActivePage('analytics'),
      cta: 'VIEW ANALYTICS',
    },
    {
      id: 'data',
      title: 'Dataset Catalog',
      badge: 'CF-1.6 MANIFEST',
      desc: 'Comprehensive scientific metadata catalog. Dimensionality classification (2D vs 3D), CF standard names, physical units, grid dimensions, and DOI citations.',
      icon: Database,
      color: 'text-blue-400',
      borderColor: 'border-blue-500/40 hover:border-blue-400',
      action: () => setActivePage('data'),
      cta: 'INSPECT MANIFEST',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* 1. Hero Mission Header */}
        <div className="relative p-6 bg-[#080e1e] border border-cyan-500/30 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-400 shadow-sm shadow-cyan-400/80" />
                <span className="text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
                  Indian National Centre for Ocean Information Services (INCOIS)
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white uppercase">
                Indian Ocean Scientific Intelligence Platform
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
                Operational multi-dimensional visualization workstation integrating authoritative 9.25 GB ROMS ocean modeling with Coriolis GDAC in-situ Argo profiling network over the entire Indian Ocean basin (30°E—120°E, 30°S—30°N).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                onClick={() => setActivePage('explorer')}
                className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-wider border border-cyan-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40"
              >
                <span>OPEN 3D EXPLORER</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={toggleGoToLocationModal}
                className="px-4 py-3 bg-[#0c1424] hover:bg-[#142036] text-cyan-300 font-bold text-xs tracking-wider border border-cyan-500/40 transition-all flex items-center justify-center gap-2"
              >
                <Crosshair className="w-4 h-4 text-cyan-400" />
                <span>GO TO LOCATION</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-[#1e293b] text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">ACTIVE DATASET</span>
              <span className="text-slate-200 font-bold truncate">
                {activeDataset || 'INCOIS-BIO-ROMS.nc'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">PAYLOAD SIZE</span>
              <span className="text-cyan-300 font-bold">9.25 GB (CF-1.6)</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">TEMPORAL RECORD</span>
              <span className="text-slate-200 font-bold">{timeStepsCount} Months (40 Yrs)</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">GRID RESOLUTION</span>
              <span className="text-slate-200 font-bold">756 × 1081 Cells</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">STATE VARIABLES</span>
              <span className="text-teal-300 font-bold">{variablesCount} Physical Fields</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">IN-SITU ARGO FLOATS</span>
              <span className="text-amber-300 font-bold">{floatCount} Active Profilers</span>
            </div>
          </div>
        </div>

        {/* 2. Platform Navigation Modules Grid */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-sky-400" />
              <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
                Scientific Exploration & Analysis Modules
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">6 Specialized Workspaces</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m) => {
              const IconComponent = m.icon;
              return (
                <div
                  key={m.id}
                  className={`p-5 bg-[#080e1a] border ${m.borderColor} flex flex-col justify-between gap-4 transition-all hover:bg-[#0c1424] shadow-md group`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-[#040814] border border-[#1e293b]">
                        <IconComponent className={`w-5 h-5 ${m.color}`} />
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] text-slate-400 font-bold">
                        {m.badge}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {m.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={m.action}
                    className="w-full py-2 px-3 bg-[#040814] hover:bg-cyan-950 border border-[#1e293b] hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 text-xs font-bold flex items-center justify-between transition-colors"
                  >
                    <span>{m.cta}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Scientific Integrity & Data Assurance Section */}
        <div className="p-5 bg-[#080e1a] border border-[#1e293b] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
                Authoritative Scientific Assurance & QC Governance
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-3xl">
                This platform enforces strict scientific data policy. All model fields are lazily extracted from authentic NetCDF-4 binaries without synthetic substitution or vertical coordinate fabrication. Argo observations are filtered strictly to Coriolis GDAC Quality Control flags 1 (Good) and 2 (Probably Good), standardized under TEOS-10 international equations of state.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActivePage('methodology')}
            className="px-4 py-2 bg-[#0c1424] border border-[#1e293b] hover:border-purple-500 text-purple-300 text-xs font-bold shrink-0 transition-colors"
          >
            READ METHODOLOGY
          </button>
        </div>
      </div>
    </div>
  );
};