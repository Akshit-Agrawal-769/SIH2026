import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, AlertCircle, BarChart3, Download, Calendar, MapPin, Activity, ArrowRight } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ScatterChart,
  Scatter
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore } from '../../store/useOceanStore';
import { fetchModelComparison, ModelComparisonResponse } from '../../api/analyticsClient';

const AXIS = { fill: '#a3a3a3', fontSize: 11 };
const TOOLTIP_STYLE = { backgroundColor: '#171717', borderColor: '#404040', borderRadius: '0.75rem', fontSize: '12px' };

const VARIABLES = [
  { id: 'temperature', label: 'Temperature' },
  { id: 'salinity', label: 'Salinity' }
];

export const ModelObservationModal: React.FC = () => {
  const {
    isComparisonModalOpen, comparisonInstrumentId, comparisonVariable,
    closeComparisonModal, setComparisonVariable, openAnalyticsModal
  } = useOceanStore(useShallow((s) => ({
    isComparisonModalOpen: s.isComparisonModalOpen,
    comparisonInstrumentId: s.comparisonInstrumentId,
    comparisonVariable: s.comparisonVariable,
    closeComparisonModal: s.closeComparisonModal,
    setComparisonVariable: s.setComparisonVariable,
    openAnalyticsModal: s.openAnalyticsModal
  })));

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ModelComparisonResponse | null>(null);
  const [viewMode, setViewMode] = useState<'series' | 'scatter' | 'residual'>('series');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isComparisonModalOpen || !comparisonInstrumentId) return;
    const controller = new AbortController();
    setLoading(true);
    setErrorMsg(null);
    fetchModelComparison(comparisonInstrumentId, comparisonVariable, controller.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setErrorMsg('Failed to load collocated comparison data.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [isComparisonModalOpen, comparisonInstrumentId, comparisonVariable]);

  useEffect(() => {
    if (!isComparisonModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeComparisonModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isComparisonModalOpen, closeComparisonModal]);

  const series = useMemo(
    () => (data?.pairs || []).map((p) => ({ ...p, t: Date.parse(p.time) })),
    [data]
  );

  if (!isComparisonModalOpen || !comparisonInstrumentId) return null;

  const exportCSV = () => {
    if (!data || !data.pairs.length) return;
    const meta = [
      '# INCOIS 3D Ocean Platform - Argo vs INCOIS Bio-ROMS surface matchups',
      `# Instrument: ${data.instrument_id} (WMO ${data.wmo ?? 'n/a'})`,
      `# Variable: ${data.variable} (${data.units})`,
      `# Model: ${data.provenance?.model_source ?? data.model_name}`,
      `# Observation source: ${data.provenance?.observation_source ?? 'Argo GDAC'}`,
      `# Method: ${data.provenance?.collocation_method ?? ''}`,
      `# QC: ${data.provenance?.qc_mode ?? ''}`,
      `# N=${data.metrics?.sample_count ?? 0} RMSE=${data.metrics?.rmse ?? 'n/a'} MAE=${data.metrics?.mae ?? 'n/a'} ` +
        `Bias(model-obs)=${data.metrics?.bias ?? 'n/a'} r=${data.metrics?.pearson_r ?? 'n/a'}`,
      '#'
    ];
    const header = 'cycle,obs_time_utc,latitude,longitude,obs_depth_m,observation,model,residual,model_time,model_dt_days';
    const rows = data.pairs.map((p) =>
      [p.cycle, p.time, p.latitude, p.longitude, p.obs_depth, p.observation, p.model, p.residual, p.model_time, p.model_dt_days].join(',')
    );
    const blob = new Blob([[...meta, header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `INCOIS_Model_vs_Obs_${data.instrument_id}_${data.variable}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenAnalytics = () => {
    if (!data || data.latitude === undefined || data.longitude === undefined) return;
    openAnalyticsModal({ lat: data.latitude, lon: data.longitude, depth: 0, variable: comparisonVariable,
      name: `Float #${data.wmo || data.instrument_id} (latest position)` });
  };

  const m = data?.metrics;
  const fmt = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? '—' : `${v}${unit ? ` ${unit}` : ''}`);
  const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  return (
    <div role="dialog" aria-modal="true" aria-label="Model versus observation comparison"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-[300ms] ease-nasa-slow">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-ocean-solid border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-ocean-text">
        <div className="p-4 border-b border-ocean-border/80 flex items-center justify-between bg-ocean-bg/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Model vs. observation · surface matchups
              </span>
              <h2 className="text-base font-bold text-white tracking-wide mt-0.5 flex items-center gap-2">
                <span>{data?.wmo ? `Argo float ${data.wmo}` : comparisonInstrumentId}</span>
                <span className="text-xs font-normal text-ocean-muted">vs. {data?.model_name ?? 'INCOIS Bio-ROMS (IBR)'}</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={!data?.available || !data.pairs.length}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-ocean-border/50 hover:bg-ocean-border text-ocean-text-secondary hover:text-white border border-ocean-border flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export CSV</span>
            </button>
            <button onClick={closeComparisonModal} aria-label="Close comparison"
              className="p-1.5 rounded-lg hover:bg-ocean-border text-ocean-muted hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-ocean-bg/40 border-b border-ocean-border/60 flex flex-wrap items-center justify-between text-xs text-ocean-text-secondary gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              {data?.latitude !== undefined && data?.longitude !== undefined
                ? `Latest position ${data.latitude.toFixed(3)}°N, ${data.longitude.toFixed(3)}°E`
                : 'Position unavailable'}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              {data?.time_range
                ? `Matchups ${data.time_range[0].slice(0, 10)} → ${data.time_range[1].slice(0, 10)}`
                : data?.model_time_coverage
                  ? `Model coverage ${data.model_time_coverage[0]} → ${data.model_time_coverage[1]}`
                  : '—'}
            </span>
          </div>
          <div role="tablist" aria-label="Compared variable" className="flex items-center gap-1 bg-ocean-bg/80 p-1 rounded-lg border border-ocean-border">
            {VARIABLES.map((v) => (
              <button key={v.id} role="tab" aria-selected={comparisonVariable === v.id} onClick={() => setComparisonVariable(v.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent ${
                  comparisonVariable === v.id ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-ocean-muted hover:text-ocean-text-secondary'
                }`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3 text-ocean-muted" role="status">
              <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono">Loading collocated pairs…</p>
            </div>
          ) : errorMsg ? (
            <div className="h-80 flex flex-col items-center justify-center gap-2 text-rose-400">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">{errorMsg}</p>
            </div>
          ) : !data?.available ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3 text-ocean-muted p-6 text-center border border-dashed border-ocean-border rounded-xl">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <div>
                <h4 className="text-sm font-semibold text-ocean-text-secondary">No collocated comparison available</h4>
                <p className="text-xs text-ocean-muted mt-1 max-w-md">{data?.reason}</p>
              </div>
              <p className="text-[11px] font-mono text-ocean-muted">No values are substituted when observations and model do not overlap.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  ['RMSE', fmt(m?.rmse, data.units), 'root-mean-square error'],
                  ['MAE', fmt(m?.mae, data.units), 'mean absolute error'],
                  ['Bias', m?.bias === null || m?.bias === undefined ? '—' : `${m.bias > 0 ? '+' : ''}${m.bias} ${data.units}`, 'mean(model − obs)'],
                  ['Pearson r', fmt(m?.pearson_r), m?.r_squared !== null && m?.r_squared !== undefined ? `r² = ${m.r_squared}` : 'undefined (n<3 or zero variance)'],
                  ['Pairs (N)', String(m?.sample_count ?? 0), 'profiles collocated']
                ].map(([label, value, hint]) => (
                  <div key={label} className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
                    <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">{label}</div>
                    <div className="text-lg font-bold text-teal-300 mt-0.5">{value}</div>
                    <div className="text-[10px] text-ocean-muted mt-0.5">{hint}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <div role="tablist" aria-label="Chart" className="flex items-center gap-1 bg-ocean-bg/80 p-0.5 rounded-lg border border-ocean-border">
                  {([['series', 'Obs & model over time'], ['scatter', 'Model vs obs'], ['residual', 'Residuals']] as const).map(([id, label]) => (
                    <button key={id} role="tab" aria-selected={viewMode === id} onClick={() => setViewMode(id)}
                      className={`px-3 py-1 rounded text-xs font-medium focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent ${
                        viewMode === id ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-ocean-muted hover:text-ocean-text-secondary'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-ocean-text-secondary">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-400 inline-block" />Argo (≤10 m)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-dashed border-amber-400 inline-block" />IBR surface</span>
                </div>
              </div>

              <div className="h-80 w-full bg-ocean-bg/70 border border-ocean-border rounded-xl p-3">
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === 'series' ? (
                    <LineChart data={series} margin={{ top: 10, right: 24, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#404040" opacity={0.5} />
                      <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtDate} tick={AXIS} />
                      <YAxis tick={AXIS} domain={['auto', 'auto']} label={{ value: `${data.variable} (${data.units})`, angle: -90, position: 'insideLeft', fill: '#a3a3a3', fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Profile ${fmtDate(Number(v))}`}
                        formatter={(val: any, name: string) => [`${val} ${data.units}`, name === 'observation' ? 'Argo' : 'IBR model']} />
                      <Line type="linear" dataKey="observation" stroke="#14b8a6" strokeWidth={1.8} dot={{ r: 1.8 }} isAnimationActive={false} />
                      <Line type="linear" dataKey="model" stroke="#f59e0b" strokeWidth={1.6} strokeDasharray="4 3" dot={{ r: 1.6 }} isAnimationActive={false} />
                    </LineChart>
                  ) : viewMode === 'scatter' ? (
                    <ScatterChart margin={{ top: 10, right: 24, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#404040" opacity={0.5} />
                      <XAxis dataKey="observation" type="number" name="Argo" domain={['auto', 'auto']} tick={AXIS}
                        label={{ value: `Argo (${data.units})`, position: 'insideBottom', offset: -10, fill: '#a3a3a3', fontSize: 11 }} />
                      <YAxis dataKey="model" type="number" name="IBR" domain={['auto', 'auto']} tick={AXIS}
                        label={{ value: `IBR (${data.units})`, angle: -90, position: 'insideLeft', fill: '#a3a3a3', fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Scatter data={series} fill="#14b8a6" isAnimationActive={false} />
                    </ScatterChart>
                  ) : (
                    <LineChart data={series} margin={{ top: 10, right: 24, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#404040" opacity={0.5} />
                      <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtDate} tick={AXIS} />
                      <YAxis tick={AXIS} label={{ value: `Model − obs (${data.units})`, angle: -90, position: 'insideLeft', fill: '#a3a3a3', fontSize: 11 }} />
                      <ReferenceLine y={0} stroke="#737373" strokeWidth={1.5} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Profile ${fmtDate(Number(v))}`}
                        formatter={(val: any) => [`${val} ${data.units}`, 'Residual']} />
                      <Line type="linear" dataKey="residual" stroke="#14b8a6" strokeWidth={0} dot={{ r: 2.2 }} isAnimationActive={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="bg-ocean-bg/40 border border-ocean-border/70 rounded-xl p-4 text-xs text-ocean-text-secondary">
                <div className="font-semibold flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-ocean-accent" />
                  <span>Provenance &amp; method</span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-ocean-muted text-[11px] leading-relaxed">
                  <div><dt className="inline font-mono text-ocean-text-secondary">Model: </dt><dd className="inline">{data.provenance?.model_source}</dd></div>
                  <div><dt className="inline font-mono text-ocean-text-secondary">Observations: </dt><dd className="inline">{data.provenance?.observation_source} ({data.provenance?.observation_institution})</dd></div>
                  <div className="sm:col-span-2"><dt className="inline font-mono text-ocean-text-secondary">Collocation: </dt><dd className="inline">{data.provenance?.collocation_method}</dd></div>
                  <div><dt className="inline font-mono text-ocean-text-secondary">QC: </dt><dd className="inline">{data.provenance?.qc_mode}</dd></div>
                  <div><dt className="inline font-mono text-ocean-text-secondary">Excluded profiles: </dt><dd className="inline">
                    {Object.entries(data.exclusions ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `${k.replace(/_/g, ' ')}: ${n}`).join('; ') || 'none'}
                  </dd></div>
                </dl>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-ocean-border/80 bg-ocean-bg/60 flex items-center justify-between gap-3">
          <div className="text-[11px] text-ocean-muted">
            Metrics are computed from the listed pairs only; the model has surface fields only, so no vertical comparison is made.
          </div>
          <button onClick={handleOpenAnalytics}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
            <BarChart3 className="w-4 h-4" />
            <span>Open in Analytics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
