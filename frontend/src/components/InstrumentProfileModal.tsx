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
  Box,
  Scale,
  BarChart3
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
  const {
    selectedInstrumentId,
    setSelectedInstrumentId,
    openWaterBlock,
    openComparisonModal,
    openAnalyticsModal
  } = useOceanStore();
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
    <div className="absolute right-4 top-16 bottom-20 w-96 glass-panel rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right duration-[300ms] ease-nasa-slow border border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-start justify-between bg-black/30">
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
          className="p-1.5 rounded-lg hover:bg-white/10 text-ocean-muted hover:text-white transition-all duration-[150ms] ease-nasa"
          title="Close profile viewer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metadata Overview */}
      {profile && (
        <div className="px-4 py-2.5 bg-black/20 border-b border-white/10 text-xs text-ocean-text-secondary grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-ocean-accent shrink-0" />
            <span className="truncate text-ocean-text-secondary text-[11px]" title={meta.location_name}>
              {meta.location_name || `${profile.latitude.toFixed(2)}°N, ${profile.longitude.toFixed(2)}°E`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-ocean-muted shrink-0" />
            <span className="text-[11px] font-mono text-ocean-text-secondary">
              {new Date(profile.timestamp).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* 3D Volumetric Ocean Block Trigger */}
      {profile && (
        <div className="px-3 pt-2.5 space-y-2">
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
            className="w-full py-2 px-3 glass-pill text-ocean-accent hover:text-white border border-ocean-accent/50 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all duration-[150ms] ease-nasa active:scale-[0.98]"
          >
            <Box className="w-4 h-4 text-ocean-accent" />
            <span>Inspect 3D Water Block (0–2000m)</span>
          </button>

          <button
            onClick={() => {
              if (selectedInstrumentId) {
                openComparisonModal(selectedInstrumentId, activeTab);
              }
            }}
            className="w-full py-2 px-3 bg-gradient-to-r from-amber-500/20 to-orange-600/30 hover:from-amber-500/35 hover:to-orange-600/45 text-amber-200 border border-amber-400/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-amber-500/10 transition-all duration-[150ms] ease-nasa active:scale-[0.98]"
          >
            <Scale className="w-4 h-4 text-amber-300" />
            <span>Compare Model vs Observation</span>
          </button>

          <button
            onClick={() => {
              if (profile) {
                openAnalyticsModal({
                  lat: profile.latitude,
                  lon: profile.longitude,
                  depth: 10.0,
                  variable: activeTab,
                  name: `${meta.wmo ? `Float #${meta.wmo}` : profile.external_id}`
                });
              }
            }}
            className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/30 hover:from-emerald-600/35 hover:to-teal-600/45 text-emerald-200 border border-ocean-accent/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 transition-all duration-[150ms] ease-nasa active:scale-[0.98]"
          >
            <BarChart3 className="w-4 h-4 text-ocean-accent" />
            <span>Open in Ocean Analytics</span>
          </button>
        </div>
      )}

      {/* Variable Switcher Tabs */}
      <div className="px-3 pt-3 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('temperature')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all duration-[150ms] ease-nasa ${
            activeTab === 'temperature'
              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
              : 'text-ocean-muted hover:text-ocean-text-secondary hover:bg-white/5'
          }`}
        >
          <Thermometer className="w-3.5 h-3.5" />
          Temp
        </button>

        <button
          onClick={() => setActiveTab('salinity')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all duration-[150ms] ease-nasa ${
            activeTab === 'salinity'
              ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
              : 'text-ocean-muted hover:text-ocean-text-secondary hover:bg-white/5'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" />
          Salinity
        </button>

        <button
          onClick={() => setActiveTab('oxygen')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all duration-[150ms] ease-nasa ${
            activeTab === 'oxygen'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
              : 'text-ocean-muted hover:text-ocean-text-secondary hover:bg-white/5'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          Oxygen
        </button>

        <button
          onClick={() => setActiveTab('chlorophyll')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all duration-[150ms] ease-nasa ${
            activeTab === 'chlorophyll'
              ? 'bg-ocean-accent/20 text-ocean-accent border border-ocean-accent/40'
              : 'text-ocean-muted hover:text-ocean-text-secondary hover:bg-white/5'
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
            <span className="text-xs font-mono">Loading real CTD profile...</span>
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
              <span className="font-mono text-ocean-accent">Surface (0m) → Depth (2000m)</span>
            </div>

            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={profile.measurements}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
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
                      backgroundColor: 'rgba(20, 25, 35, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '11px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
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
        <div className="p-3 bg-black/40 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-ocean-muted block font-mono">Surface (1m)</span>
            <span className="font-mono font-bold text-white">
              {(surfaceMeasurement as any)[currentConfig.dataKey] ?? 'N/A'} {currentConfig.unit}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-ocean-muted block font-mono">Abyss (2000m)</span>
            <span className="font-mono font-bold text-white">
              {(deepMeasurement as any)[currentConfig.dataKey] ?? 'N/A'} {currentConfig.unit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
