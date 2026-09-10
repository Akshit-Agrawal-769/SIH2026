import React, { useEffect, useState } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { fetchInstrumentProfile, InstrumentProfileResponse } from '../api/client';
import {
  X,
  Radio,
  Clock,
  MapPin,
  Thermometer,
  Droplets,
  Activity,
  Wind,
  Loader2,
  Box
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export const InstrumentProfileModal: React.FC = () => {
  const { selectedInstrumentId, setSelectedInstrumentId, openWaterBlock } = useOceanStore();
  const [profile, setProfile] = useState<InstrumentProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'temperature' | 'salinity' | 'oxygen' | 'chlorophyll'>('temperature');

  useEffect(() => {
    if (!selectedInstrumentId) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchInstrumentProfile(selectedInstrumentId)
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        console.error('[ProfileModal] Fetch error:', err);
        setError(err.message || 'Failed to load profile data');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedInstrumentId]);

  if (!selectedInstrumentId) return null;

  const isArgo = profile?.platform_type === 'argo';
  const meta = profile?.metadata || {};

  const getVariableConfig = () => {
    switch (activeTab) {
      case 'temperature':
        return {
          name: 'Sea Water Temperature',
          unit: '°C',
          color: '#ff4d4d',
          dataKey: 'temperature'
        };
      case 'salinity':
        return {
          name: 'Practical Salinity',
          unit: 'PSU',
          color: '#00e5ff',
          dataKey: 'salinity'
        };
      case 'oxygen':
        return {
          name: 'Dissolved Oxygen',
          unit: 'ml/l',
          color: '#c084fc',
          dataKey: 'oxygen'
        };
      case 'chlorophyll':
        return {
          name: 'Chlorophyll-a',
          unit: 'mg/m³',
          color: '#4ade80',
          dataKey: 'chlorophyll'
        };
    }
  };

  const currentConfig = getVariableConfig();

  // Find surface and deep readings
  const surfaceMeasurement = profile?.measurements[0];
  const deepMeasurement = profile?.measurements[profile.measurements.length - 1];

  return (
    <div className="absolute right-4 top-16 bottom-20 w-96 bg-ocean-panel/95 backdrop-blur-xl border border-ocean-border rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-ocean-border/80 flex items-start justify-between bg-ocean-dark/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${
            isArgo
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400'
          }`}>
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                isArgo ? 'bg-amber-400/20 text-amber-300' : 'bg-fuchsia-400/20 text-fuchsia-300'
              }`}>
                {isArgo ? 'Argo Profiling Float' : 'Underwater Glider'}
              </span>
              <span className="text-[10px] text-ocean-muted font-mono">
                {meta.institution || 'INCOIS'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide mt-0.5">
              {meta.wmo ? `WMO #${meta.wmo}` : profile?.external_id || selectedInstrumentId}
            </h3>
          </div>
        </div>

        <button
          onClick={() => setSelectedInstrumentId(null)}
          className="p-1.5 rounded-lg hover:bg-ocean-border text-slate-400 hover:text-white transition"
          title="Close profile viewer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metadata Overview */}
      {profile && (
        <div className="px-4 py-2.5 bg-ocean-dark/30 border-b border-ocean-border/60 text-xs text-slate-300 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-ocean-accent shrink-0" />
            <span className="truncate text-slate-200 text-[11px]" title={meta.location_name}>
              {meta.location_name || `${profile.latitude.toFixed(2)}°N, ${profile.longitude.toFixed(2)}°E`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-ocean-muted shrink-0" />
            <span className="text-[11px] font-mono text-slate-300">
              {new Date(profile.timestamp).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* 3D Volumetric Ocean Block Trigger */}
      {profile && (
        <div className="px-3 pt-2.5">
          <button
            onClick={() => {
              openWaterBlock({
                lon: profile.longitude,
                lat: profile.latitude,
                name: `${meta.wmo ? `Float WMO #${meta.wmo}` : profile.external_id} (${meta.location_name || 'In-Situ Water Column'})`,
                instrumentId: selectedInstrumentId,
                platformType: profile.platform_type
              });
            }}
            className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600/30 to-blue-600/40 hover:from-cyan-600/50 hover:to-blue-600/60 text-cyan-200 border border-cyan-400/50 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition active:scale-[0.98]"
          >
            <Box className="w-4 h-4 text-cyan-300 animate-pulse" />
            <span>Inspect 3D Water Block (0–2000m)</span>
          </button>
        </div>
      )}

      {/* Variable Switcher Tabs */}
      <div className="px-3 pt-3 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('temperature')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition ${
            activeTab === 'temperature'
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ocean-dark/40'
          }`}
        >
          <Thermometer className="w-3.5 h-3.5" />
          Temp
        </button>

        <button
          onClick={() => setActiveTab('salinity')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition ${
            activeTab === 'salinity'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ocean-dark/40'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" />
          Salinity
        </button>

        <button
          onClick={() => setActiveTab('oxygen')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition ${
            activeTab === 'oxygen'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ocean-dark/40'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          Oxygen
        </button>

        <button
          onClick={() => setActiveTab('chlorophyll')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition ${
            activeTab === 'chlorophyll'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-ocean-dark/40'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Chl-a
        </button>
      </div>

      {/* Chart Section */}
      <div className="flex-1 p-3 flex flex-col justify-center min-h-[260px]">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 text-ocean-muted my-auto">
            <Loader2 className="w-6 h-6 animate-spin text-ocean-accent" />
            <span className="text-xs">Loading real CTD profile...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs my-auto">
            {error}
          </div>
        )}

        {profile && !loading && !error && (
          <div className="w-full h-full flex flex-col">
            <div className="text-[11px] text-ocean-muted flex items-center justify-between mb-1 px-1">
              <span>{currentConfig.name} ({currentConfig.unit})</span>
              <span className="font-mono">Surface (0m) → Depth (2000m)</span>
            </div>

            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={profile.measurements}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5a" opacity={0.4} />
                  {/* Inverted Y-Axis: 0m at the surface, 2000m at the abyss */}
                  <YAxis
                    type="number"
                    dataKey="depth"
                    reversed={true}
                    unit="m"
                    stroke="#64748b"
                    fontSize={10}
                    tickCount={6}
                  />
                  <XAxis
                    type="number"
                    dataKey={currentConfig.dataKey}
                    unit={currentConfig.unit}
                    stroke="#64748b"
                    fontSize={10}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#071524',
                      borderColor: '#102a45',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '11px'
                    }}
                    formatter={(val: any) => [`${val} ${currentConfig.unit}`, currentConfig.name]}
                    labelFormatter={(depthVal: any) => `Depth: ${depthVal} meters`}
                  />
                  <Line
                    type="monotone"
                    dataKey={currentConfig.dataKey}
                    stroke={currentConfig.color}
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: currentConfig.color }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary Stats */}
      {profile && surfaceMeasurement && deepMeasurement && (
        <div className="p-3 bg-ocean-dark/60 border-t border-ocean-border/80 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-ocean-panel/60 border border-ocean-border/60">
            <span className="text-[10px] text-ocean-muted block">Surface (1m)</span>
            <span className="font-mono font-bold text-slate-100">
              {(surfaceMeasurement as any)[currentConfig.dataKey] ?? 'N/A'} {currentConfig.unit}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-ocean-panel/60 border border-ocean-border/60">
            <span className="text-[10px] text-ocean-muted block">Abyss (2000m)</span>
            <span className="font-mono font-bold text-slate-100">
              {(deepMeasurement as any)[currentConfig.dataKey] ?? 'N/A'} {currentConfig.unit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
