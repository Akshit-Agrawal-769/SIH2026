import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  TrendingUp,
  Layers,
  AlertTriangle,
  Grid,
  Download,
  MapPin,
  Sparkles
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore, DEFAULT_OCEAN_POINT } from '../../store/useOceanStore';
import { TimeSeriesTab } from './TimeSeriesTab';
import { VerticalProfileTab } from './VerticalProfileTab';
import { AnomalyTab } from './AnomalyTab';
import { CorrelationTab } from './CorrelationTab';
import { ScientificInterpretation } from './ScientificInterpretation';
import { ReportExport } from './ReportExport';
import {
  fetchVerticalProfileAnalysis,
  fetchAnomalies,
  fetchTimeSeries
} from '../../api/analyticsClient';

type TabType =
  | 'timeseries'
  | 'vertical'
  | 'anomalies'
  | 'correlation'
  | 'interpretation'
  | 'export';

interface LocationPreset {
  name: string;
  lat: number;
  lon: number;
  region: string;
}

const PRESETS: LocationPreset[] = [
  { name: 'Bay of Bengal Central', lat: 13.691, lon: 88.074, region: 'BoB' },
  { name: 'Arabian Sea Open Basin', lat: 15.0, lon: 68.0, region: 'AS' },
  { name: 'Equatorial Indian Ocean', lat: 0.0, lon: 80.0, region: 'EIO' },
  { name: 'Sri Lanka Dome Upwelling', lat: 8.0, lon: 83.5, region: 'SLD' },
  { name: 'Somali Current Gateway', lat: 5.0, lon: 52.0, region: 'SC' }
];

export const AnalyticsModal: React.FC = () => {
  const { isAnalyticsModalOpen, analyticsTarget, closeAnalyticsModal, catalog, selectedTime } = useOceanStore(
    useShallow((s) => ({
      isAnalyticsModalOpen: s.isAnalyticsModalOpen,
      analyticsTarget: s.analyticsTarget,
      closeAnalyticsModal: s.closeAnalyticsModal,
      catalog: s.catalog,
      selectedTime: s.selectedTime
    }))
  );

  const [activeTab, setActiveTab] = useState<TabType>('timeseries');
  const [lat, setLat] = useState<number>(DEFAULT_OCEAN_POINT.lat);
  const [lon, setLon] = useState<number>(DEFAULT_OCEAN_POINT.lon);
  const [depth, setDepth] = useState<number>(0);
  const [variable, setVariable] = useState<string>('temperature');
  const [locationName, setLocationName] = useState<string>(DEFAULT_OCEAN_POINT.name);

  // Cached summary data for interpretation & report export
  const [profileSummary, setProfileSummary] = useState<any>(null);
  const [anomalySummary, setAnomalySummary] = useState<any>(null);
  const [timeseriesSummary, setTimeseriesSummary] = useState<any>(null);

  useEffect(() => {
    if (analyticsTarget) {
      setLat(analyticsTarget.lat);
      setLon(analyticsTarget.lon);
      if (analyticsTarget.depth !== undefined) setDepth(analyticsTarget.depth);
      if (analyticsTarget.variable && (!catalog || catalog.variables[analyticsTarget.variable])) setVariable(analyticsTarget.variable);
      setLocationName(analyticsTarget.name || `${analyticsTarget.lat.toFixed(2)}°N, ${analyticsTarget.lon.toFixed(2)}°E`);
    }
  }, [analyticsTarget, catalog]);

  // The analysed timestep is the timeline's timestep when this variable has it, else its latest.
  const varTimes = catalog?.variables[variable]?.timesteps ?? [];
  const date = varTimes.includes(selectedTime.slice(0, 10)) ? selectedTime.slice(0, 10) : varTimes[varTimes.length - 1];

  // Pre-fetch summaries for heuristics & report tabs
  useEffect(() => {
    if (!isAnalyticsModalOpen) return;

    const controller = new AbortController();
    fetchVerticalProfileAnalysis(lat, lon, variable, date, controller.signal)
      .then((res) => setProfileSummary(res))
      .catch(() => setProfileSummary(null));
    fetchAnomalies(variable, lat, lon, depth, date, controller.signal)
      .then((res) => setAnomalySummary(res))
      .catch(() => setAnomalySummary(null));
    fetchTimeSeries(variable, lat, lon, depth, controller.signal)
      .then((res) => setTimeseriesSummary(res))
      .catch(() => setTimeseriesSummary(null));
    return () => controller.abort();
  }, [isAnalyticsModalOpen, lat, lon, depth, variable, date]);

  useEffect(() => {
    if (!isAnalyticsModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAnalyticsModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAnalyticsModalOpen, closeAnalyticsModal]);

  if (!isAnalyticsModalOpen) return null;

  const variables = Object.entries(catalog?.variables ?? {}).map(([id, m]) => ({ id, label: m.long_name, unit: m.units }));
  const currentUnit = catalog?.variables[variable]?.units ?? '';
  const depths = catalog?.variables[variable]?.depths ?? [0];
  const sourceMeta = catalog ? catalog.sources[catalog.variables[variable]?.source_id ?? ''] : undefined;

  const handleSelectPreset = (preset: LocationPreset) => {
    setLat(preset.lat);
    setLon(preset.lon);
    setLocationName(preset.name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-[300ms] ease-nasa-slow">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-ocean-solid border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-ocean-text">
        {/* Top Header Bar */}
        <div className="p-4 border-b border-ocean-border/80 flex items-center justify-between bg-ocean-bg/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-600/20 border border-teal-500/30 text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Ocean Analytics Studio
                </span>
                <span className="text-[10px] font-mono text-ocean-accent bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {sourceMeta?.title ?? '—'} · {date ?? 'no timestep'}
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-wide mt-0.5">
                {locationName}{' '}
                <span className="text-xs font-mono font-normal text-ocean-muted">
                  ({lat.toFixed(3)}°N, {lon.toFixed(3)}°E)
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={closeAnalyticsModal}
              aria-label="Close analytics"
              className="p-1.5 rounded-lg hover:bg-ocean-border text-ocean-muted hover:text-white transition-all duration-[150ms] ease-nasa"
              title="Close Analytics Studio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Filter Bar: Presets, Variable & Depth Selectors */}
        <div className="px-4 py-2.5 bg-ocean-bg/40 border-b border-ocean-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Location Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-[11px] text-ocean-muted shrink-0 font-medium">Presets:</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => handleSelectPreset(p)}
                className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap transition-all duration-[150ms] ease-nasa ${
                  Math.abs(lat - p.lat) < 0.01 && Math.abs(lon - p.lon) < 0.01
                    ? 'bg-teal-500/25 text-teal-300 border border-teal-500/40 font-semibold'
                    : 'text-ocean-muted hover:text-ocean-text-secondary hover:bg-ocean-bg/60'
                }`}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Variable Selector */}
          <div className="flex items-center gap-1 bg-ocean-bg/80 p-0.5 rounded-lg border border-ocean-border">
            {variables.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariable(v.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all duration-[150ms] ease-nasa ${
                  variable === v.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'text-ocean-muted hover:text-ocean-text-secondary'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Depth Selector */}
          <div className="flex items-center gap-1 bg-ocean-bg/80 px-2 py-1 rounded-lg border border-ocean-border text-ocean-text-secondary text-xs">
            <span className="text-ocean-muted text-[11px]">Depth:</span>
            <select
              value={depth}
              onChange={(e) => setDepth(parseFloat(e.target.value))}
              className="bg-transparent text-teal-300 font-mono text-xs focus:outline-none cursor-pointer"
            >
              {depths.map((d) => (
                <option key={d} value={d} className="bg-ocean-solid text-ocean-text-secondary">
                  {d} m
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 pt-2 bg-ocean-bg/30 border-b border-ocean-border/60 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('timeseries')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all duration-[150ms] ease-nasa flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'timeseries'
                ? 'border-teal-400 text-teal-300 font-semibold'
                : 'border-transparent text-ocean-muted hover:text-ocean-text-secondary'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Time Series &amp; Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('vertical')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all duration-[150ms] ease-nasa flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'vertical'
                ? 'border-teal-400 text-teal-300 font-semibold'
                : 'border-transparent text-ocean-muted hover:text-ocean-text-secondary'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vertical structure</span>
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all duration-[150ms] ease-nasa flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'anomalies'
                ? 'border-teal-400 text-teal-300 font-semibold'
                : 'border-transparent text-ocean-muted hover:text-ocean-text-secondary'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Spatial z-score</span>
          </button>

          <button
            onClick={() => setActiveTab('correlation')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all duration-[150ms] ease-nasa flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'correlation'
                ? 'border-teal-400 text-teal-300 font-semibold'
                : 'border-transparent text-ocean-muted hover:text-ocean-text-secondary'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Correlation</span>
          </button>

          <button
            onClick={() => setActiveTab('interpretation')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all duration-[150ms] ease-nasa flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'interpretation'
                ? 'border-teal-400 text-teal-300 font-semibold'
                : 'border-transparent text-ocean-muted hover:text-ocean-text-secondary'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-ocean-accent" />
            <span>Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all duration-[150ms] ease-nasa flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-teal-400 text-teal-300 font-semibold'
                : 'border-transparent text-ocean-muted hover:text-ocean-text-secondary'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Brief</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'timeseries' && (
            <TimeSeriesTab
              variable={variable}
              lat={lat}
              lon={lon}
              depth={depth}
              units={currentUnit}
              sourceLabel={sourceMeta?.title}
            />
          )}

          {activeTab === 'vertical' && (
            <VerticalProfileTab
              variable={variable}
              lat={lat}
              lon={lon}
              units={currentUnit}
              date={date}
            />
          )}

          {activeTab === 'anomalies' && (
            <AnomalyTab
              variable={variable}
              lat={lat}
              lon={lon}
              depth={depth}
              units={currentUnit}
              date={date}
            />
          )}

          {activeTab === 'correlation' && (
            <CorrelationTab lat={lat} lon={lon} depth={depth} date={date} />
          )}

          {activeTab === 'interpretation' && (
            <ScientificInterpretation
              lat={lat}
              lon={lon}
              depth={depth}
              variable={variable}
              units={currentUnit}
              date={date}
              profile={profileSummary}
              anomaly={anomalySummary}
              timeseries={timeseriesSummary}
            />
          )}

          {activeTab === 'export' && (
            <ReportExport
              lat={lat}
              lon={lon}
              depth={depth}
              variable={variable}
              units={currentUnit}
              targetName={locationName}
              date={date}
              sourceTitle={sourceMeta ? `${sourceMeta.title}${sourceMeta.doi ? ` (DOI ${sourceMeta.doi})` : sourceMeta.product_id ? ` (${sourceMeta.product_id})` : ''}` : undefined}
              timeseriesData={timeseriesSummary}
              anomalyData={anomalySummary}
              profileData={profileSummary}
            />
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-ocean-border/80 bg-ocean-bg/60 flex items-center justify-between text-[11px] text-ocean-muted">
          <div className="font-mono">Computed by the data-service analytics engine from catalogued tiles.</div>
          <div>{sourceMeta?.title ?? ''}</div>
        </div>
      </div>
    </div>
  );
};
