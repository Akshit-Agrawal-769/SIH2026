import React from 'react';
import {
  TrendingUp,
  Compass,
  Radio,
  Activity,
  Sliders,
  Info,
  Database
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const InspectorPanel = () => {
  const {
    activeInspectorTab,
    setActiveInspectorTab,
    selectedFloat,
    argoFloats,
    selectFloat,
    selectFloatAndCompare,
    platformTelemetry,
    metadata,
    activeDataset,
    volumeMeta,
    isInspectorOpen,
    triggerCameraAction,
  } = useOceanStore();

  if (!isInspectorOpen) return null;

  return (
    <aside className="w-72 h-full bg-[#080e1a] border-l border-[#1e293b] p-3 text-slate-200 flex flex-col gap-3 text-xs select-none overflow-y-auto custom-scrollbar shrink-0">

      {/* 3-Tab Selector */}
      <div className="grid grid-cols-3 bg-[#0c1424] border border-[#1e293b] text-[10px] font-mono">
        <button
          onClick={() => setActiveInspectorTab('argo')}
          className={`py-1.5 text-center font-bold tracking-wider transition-all ${
            activeInspectorTab === 'argo'
              ? 'bg-[#291b05] text-amber-300 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ARGO IN-SITU
        </button>
        <button
          onClick={() => setActiveInspectorTab('telemetry')}
          className={`py-1.5 text-center font-bold tracking-wider transition-all ${
            activeInspectorTab === 'telemetry'
              ? 'bg-[#0f2d2a] text-teal-300 border-b-2 border-teal-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          STATION
        </button>
        <button
          onClick={() => setActiveInspectorTab('metadata')}
          className={`py-1.5 text-center font-bold tracking-wider transition-all ${
            activeInspectorTab === 'metadata'
              ? 'bg-[#0a1e38] text-sky-300 border-b-2 border-sky-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          METADATA
        </button>
      </div>

      {/* Tab 1: Argo Float Inspector */}
      {activeInspectorTab === 'argo' && (
        <div className="flex flex-col gap-2.5">
          {selectedFloat ? (
            <div className="p-2.5 bg-[#0b1322] border border-[#1e293b] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-300">
                  WMO {selectedFloat.platform_number}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedFloat.profiles_count} Profiles
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] bg-[#070c18] p-1.5 border border-[#1e293b]">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Latitude</span>
                  <span className="text-slate-200 font-bold tabular-nums">
                    {selectedFloat.latest_position.latitude.toFixed(2)}°N
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Longitude</span>
                  <span className="text-slate-200 font-bold tabular-nums">
                    {selectedFloat.latest_position.longitude.toFixed(2)}°E
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-relaxed font-mono">
                <span className="text-slate-300 font-bold block mb-0.5 uppercase">Provenance</span>
                INCOIS / Coriolis GDAC NetCDF (QC 1 & 2 validated)
              </div>

              <button
                onClick={() => selectFloatAndCompare(selectedFloat)}
                className="w-full mt-0.5 flex items-center justify-center gap-1.5 py-1.5 bg-[#2a1b06] hover:bg-[#3d270a] border border-amber-500/80 text-amber-200 font-mono font-bold text-xs transition-colors"
              >
                <TrendingUp className="w-3 h-3 text-amber-400" />
                <span>COMPUTE 4D RESIDUALS</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-[#0b1322] border border-[#1e293b] text-slate-400 text-center text-xs font-mono">
              NO ARGO FLOAT SELECTED
            </div>
          )}

          {/* Floats Directory List */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
              <span>INDEXED FLOATS ({argoFloats.length})</span>
              <span className="text-teal-400">IN-SITU</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {argoFloats.map((fl) => {
                const isSelected = selectedFloat?.platform_number === fl.platform_number;
                return (
                  <button
                    key={fl.platform_number}
                    onClick={() => selectFloat(fl)}
                    className={`flex items-center justify-between p-1.5 border text-left transition-all ${
                      isSelected
                        ? 'bg-[#291b05] border-amber-500 text-amber-200'
                        : 'bg-[#0b1322] border-[#1e293b] text-slate-300 hover:bg-[#131f33] hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 ${isSelected ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      <div>
                        <div className="font-mono font-bold text-xs">
                          WMO {fl.platform_number}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                          {fl.latest_position.latitude.toFixed(2)}°N, {fl.latest_position.longitude.toFixed(2)}°E
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {fl.profiles_count}p
                    </span>
                  </button>
                );
              })}
              {argoFloats.length === 0 && (
                <div className="p-2 bg-[#0b1322] border border-[#1e293b] text-slate-500 font-mono text-[11px] italic text-center">
                  NO ARGO PROFILES LOADED
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Marine Station Telemetry Dashboard */}
      {activeInspectorTab === 'telemetry' && (
        <div className="flex flex-col gap-2.5">
          {/* Station Overview Card */}
          <div className="p-2.5 bg-[#0b1322] border border-[#1e293b] flex flex-col gap-2 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-none shrink-0" />
                <span className="text-xs font-bold text-teal-300 uppercase">
                  {platformTelemetry.id}
                </span>
              </div>
              <span className="text-[9px] px-1 py-0.2 bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                ONLINE
              </span>
            </div>

            <div className="text-[10px] text-slate-300 leading-tight">
              {platformTelemetry.name}
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px] bg-[#070c18] p-1.5 border border-[#1e293b]">
              <div>
                <span className="text-slate-500 block text-[9px]">POSITION</span>
                <span className="text-slate-200 font-bold">{platformTelemetry.latitude.toFixed(2)}°N, {platformTelemetry.longitude.toFixed(2)}°E</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">BATTERY / SOLAR</span>
                <span className="text-emerald-300 font-bold">{platformTelemetry.battery_level}% Nominal</span>
              </div>
            </div>

            {/* Environmental Real-Time Scorecard */}
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-[#1e293b] pt-1.5">
              REAL-TIME SEA STATE TELEMETRY
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="bg-[#070c18] p-1.5 border border-[#1e293b]">
                <span className="text-slate-500 block text-[9px]">SEA SURFACE TEMP</span>
                <span className="text-sky-300 font-bold text-xs">{platformTelemetry.sea_surface_temp.toFixed(2)} °C</span>
              </div>
              <div className="bg-[#070c18] p-1.5 border border-[#1e293b]">
                <span className="text-slate-500 block text-[9px]">PRACTICAL SALINITY</span>
                <span className="text-teal-300 font-bold text-xs">{platformTelemetry.salinity.toFixed(2)} PSU</span>
              </div>
              <div className="bg-[#070c18] p-1.5 border border-[#1e293b]">
                <span className="text-slate-500 block text-[9px]">WAVE HEIGHT (Hs)</span>
                <span className="text-amber-300 font-bold text-xs">{platformTelemetry.wave_height_hs.toFixed(2)} m</span>
              </div>
              <div className="bg-[#070c18] p-1.5 border border-[#1e293b]">
                <span className="text-slate-500 block text-[9px]">DOMINANT PERIOD (Tp)</span>
                <span className="text-slate-200 font-bold text-xs">{platformTelemetry.wave_period_tp.toFixed(1)} s</span>
              </div>
              <div className="bg-[#070c18] p-1.5 border border-[#1e293b]">
                <span className="text-slate-500 block text-[9px]">SURFACE CURRENT</span>
                <span className="text-indigo-300 font-bold text-xs">{platformTelemetry.current_speed.toFixed(2)} m/s @ {platformTelemetry.current_direction}°</span>
              </div>
              <div className="bg-[#070c18] p-1.5 border border-[#1e293b]">
                <span className="text-slate-500 block text-[9px]">SURFACE WIND</span>
                <span className="text-slate-200 font-bold text-xs">{platformTelemetry.wind_speed.toFixed(1)} kts @ {platformTelemetry.wind_direction}°</span>
              </div>
            </div>

            <button
              onClick={() => triggerCameraAction('platform')}
              className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#0f2d2a] hover:bg-[#133e3a] border border-teal-500 text-teal-200 font-mono font-bold text-xs transition-colors"
            >
              <Compass className="w-3 h-3 text-teal-400" />
              <span>LOCK CAMERA ON STATION</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Model Metadata Inspector */}
      {activeInspectorTab === 'metadata' && (
        <div className="flex flex-col gap-2">
          {metadata ? (
            <div className="flex flex-col gap-2">
              <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
                <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold block mb-0.5">Model Dataset</span>
                <div className="font-bold text-slate-100 font-mono text-xs">{metadata.title || activeDataset}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{metadata.source || 'ROMS 3.9 Hydrodynamic Model'}</div>
              </div>

              <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
                <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold block mb-1">Spatial Domain Coordinates</span>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-300">
                  <div className="bg-[#070c18] p-1 border border-[#1e293b]">
                    <span className="text-slate-500 block text-[9px]">LONGITUDE</span>
                    {metadata.bounds?.min_lon?.toFixed(1) ?? '30.0'}°E — {metadata.bounds?.max_lon?.toFixed(1) ?? '120.0'}°E
                  </div>
                  <div className="bg-[#070c18] p-1 border border-[#1e293b]">
                    <span className="text-slate-500 block text-[9px]">LATITUDE</span>
                    {metadata.bounds?.min_lat?.toFixed(1) ?? '-30.0'}°N — {metadata.bounds?.max_lat?.toFixed(1) ?? '30.0'}°N
                  </div>
                </div>
              </div>

              <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
                <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold block mb-1">Grid Dimensions</span>
                <div className="grid grid-cols-3 gap-1 font-mono text-center text-[10px]">
                  <div className="bg-[#070c18] p-1 border border-[#1e293b]">
                    <span className="text-slate-500 block text-[9px]">Nx (Lon)</span>
                    <strong className="text-sky-300 tabular-nums">{metadata.dimensions?.LON || metadata.dimensions?.lon || volumeMeta?.dimX || 64}</strong>
                  </div>
                  <div className="bg-[#070c18] p-1 border border-[#1e293b]">
                    <span className="text-slate-500 block text-[9px]">Ny (Lat)</span>
                    <strong className="text-sky-300 tabular-nums">{metadata.dimensions?.LAT || metadata.dimensions?.lat || volumeMeta?.dimY || 64}</strong>
                  </div>
                  <div className="bg-[#070c18] p-1 border border-[#1e293b]">
                    <span className="text-slate-500 block text-[9px]">Nt (Time)</span>
                    <strong className="text-sky-300 tabular-nums">{metadata.dimensions?.TIME || metadata.dimensions?.time || metadata.dimensions?.depth || volumeMeta?.dimZ || 32}</strong>
                  </div>
                </div>
              </div>

              <div className="p-2 bg-[#0b1322] border border-[#1e293b]">
                <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold block mb-1">State Variables</span>
                <div className="flex flex-wrap gap-1">
                  {(metadata.variables || ['temp', 'salt', 'u', 'v', 'chl']).map((v) => (
                    <span key={v} className="px-1.5 py-0.2 bg-[#070c18] border border-[#1e293b] text-sky-300 font-mono text-[10px]">
                      {v.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#0b1322] border border-[#1e293b] text-slate-400 text-center text-xs font-mono">
              MODEL METADATA UNAVAILABLE
            </div>
          )}
        </div>
      )}

    </aside>
  );
};
