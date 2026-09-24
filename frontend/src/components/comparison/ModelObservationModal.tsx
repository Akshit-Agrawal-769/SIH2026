import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Download,
  Calendar,
  MapPin,
  Activity,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar
} from 'recharts';
import { useOceanStore } from '../../store/useOceanStore';
import { fetchModelComparison, ModelComparisonResponse } from '../../api/analyticsClient';

export const ModelObservationModal: React.FC = () => {
  const {
    isComparisonModalOpen,
    comparisonInstrumentId,
    comparisonVariable,
    closeComparisonModal,
    setComparisonVariable,
    openAnalyticsModal
  } = useOceanStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ModelComparisonResponse | null>(null);
  const [viewMode, setViewMode] = useState<'sounding' | 'residual'>('sounding');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isComparisonModalOpen || !comparisonInstrumentId) return;

    let active = true;
    setLoading(true);
    setErrorMsg(null);

    fetchModelComparison(comparisonInstrumentId, comparisonVariable)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[ModelObservationModal] Failed to fetch comparison:', err);
        setErrorMsg('Failed to load collocated comparison data.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isComparisonModalOpen, comparisonInstrumentId, comparisonVariable]);

  if (!isComparisonModalOpen || !comparisonInstrumentId) return null;

  const exportCSV = () => {
    if (!data || !data.depth_profiles.length) return;

    const headers = ['Depth (m)', `Observation (${data.units})`, `Model (${data.units})`, `Residual (${data.units})`];
    const rows = data.depth_profiles.map((p) => [p.depth, p.observation, p.model, p.residual]);

    const metaHeader = [
      `# INCOIS 3D Ocean Platform - Collocated Model vs Observation Report`,
      `# Instrument ID: ${data.instrument_id}`,
      `# WMO: ${data.wmo || 'N/A'}`,
      `# Coordinates: ${data.latitude}°N, ${data.longitude}°E`,
      `# Observation Date: ${data.timestamp || 'N/A'}`,
      `# Model Date: ${data.model_date}`,
      `# Variable: ${data.variable} (${data.units})`,
      `# Collocation: Bilinear spatial + 1D piecewise linear depth`,
      `# Samples: ${data.metrics?.sample_count || 0}`,
      `# RMSE: ${data.metrics?.rmse ?? 'N/A'} ${data.units}`,
      `# MAE: ${data.metrics?.mae ?? 'N/A'} ${data.units}`,
      `# Bias: ${data.metrics?.bias ?? 'N/A'} ${data.units}`,
      `# Pearson r: ${data.metrics?.pearson_r ?? 'N/A'}`,
      `# Data Policy: STRICT_REAL_DATA_ZERO_SYNTHETIC`,
      `#`
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      metaHeader.join('\n') +
      '\n' +
      headers.join(',') +
      '\n' +
      rows.map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `INCOIS_Model_vs_Obs_${data.instrument_id}_${data.variable}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAnalytics = () => {
    if (!data || data.latitude === undefined || data.longitude === undefined) return;
    openAnalyticsModal({
      lat: data.latitude,
      lon: data.longitude,
      depth: 10.0,
      variable: comparisonVariable,
      name: `Float #${data.wmo || data.instrument_id}`
    });
  };

  const variables = [
    { id: 'temperature', label: 'Temperature', unit: '°C' },
    { id: 'salinity', label: 'Salinity', unit: 'PSU' },
    { id: 'chlorophyll', label: 'Chlorophyll-a', unit: 'mg/m³' },
    { id: 'oxygen', label: 'Dissolved O₂', unit: 'ml/l' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-[300ms] ease-nasa-slow">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-ocean-solid border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-ocean-text">
        {/* Top Header Bar */}
        <div className="p-4 border-b border-ocean-border/80 flex items-center justify-between bg-ocean-bg/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Model vs. Observation Validation
                </span>
                <span className="text-[10px] font-mono text-ocean-accent bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Zero Synthetic Data
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-wide mt-0.5 flex items-center gap-2">
                <span>{data?.wmo ? `Argo Float #${data.wmo}` : comparisonInstrumentId}</span>
                <span className="text-xs font-normal text-ocean-muted">
                  vs. INCOIS Bio-ROMS 3.9
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={!data || !data.available || !data.depth_profiles.length}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-ocean-border/50 hover:bg-ocean-border text-ocean-text-secondary hover:text-white border border-ocean-border flex items-center gap-1.5 transition-all duration-[150ms] ease-nasa disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download collocated metrics & profiles as CSV"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={closeComparisonModal}
              className="p-1.5 rounded-lg hover:bg-ocean-border text-ocean-muted hover:text-white transition-all duration-[150ms] ease-nasa"
              title="Close comparison viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Header Metadata Bar */}
        <div className="px-5 py-2.5 bg-ocean-bg/40 border-b border-ocean-border/60 flex flex-wrap items-center justify-between text-xs text-ocean-text-secondary gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              <span>
                {data?.latitude !== undefined && data?.longitude !== undefined
                  ? `${data.latitude.toFixed(3)}°N, ${data.longitude.toFixed(3)}°E`
                  : 'Coordinates pending'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Obs:{' '}
                {data?.timestamp
                  ? new Date(data.timestamp).toLocaleDateString()
                  : 'N/A'}{' '}
                • Model: {data?.model_date || '2024-06-03'}
              </span>
            </div>
          </div>

          {/* Variable Tabs */}
          <div className="flex items-center gap-1 bg-ocean-bg/80 p-1 rounded-lg border border-ocean-border">
            {variables.map((v) => (
              <button
                key={v.id}
                onClick={() => setComparisonVariable(v.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all duration-[150ms] ease-nasa ${
                  comparisonVariable === v.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'text-ocean-muted hover:text-ocean-text-secondary'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3 text-ocean-muted">
              <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono">Collocating Bio-ROMS model output with in-situ profile...</p>
            </div>
          ) : errorMsg ? (
            <div className="h-80 flex flex-col items-center justify-center gap-2 text-rose-400">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-sm font-semibold">{errorMsg}</p>
            </div>
          ) : !data?.available ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3 text-ocean-muted p-6 text-center border border-dashed border-ocean-border rounded-xl">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <div>
                <h4 className="text-sm font-semibold text-ocean-text-secondary">No Collocated Comparison Available</h4>
                <p className="text-xs text-ocean-muted mt-1 max-w-md">
                  {data?.reason ||
                    `This observation platform does not measure '${comparisonVariable}' or falls outside the hydrodynamic model domain.`}
                </p>
              </div>
              <p className="text-[11px] font-mono text-ocean-accent bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Zero synthetic data policy enforced: No synthetic profiles are generated.
              </p>
            </div>
          ) : (
            <>
              {/* Validation Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
                  <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
                    RMSE (Root Mean Sq)
                  </div>
                  <div className="text-lg font-bold text-teal-300 mt-0.5">
                    {data.metrics?.rmse !== undefined ? `${data.metrics.rmse} ${data.units}` : '—'}
                  </div>
                  <div className="text-[10px] text-ocean-muted mt-0.5">Dispersion error</div>
                </div>

                <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
                  <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
                    MAE (Mean Abs Error)
                  </div>
                  <div className="text-lg font-bold text-teal-300 mt-0.5">
                    {data.metrics?.mae !== undefined ? `${data.metrics.mae} ${data.units}` : '—'}
                  </div>
                  <div className="text-[10px] text-ocean-muted mt-0.5">Absolute discrepancy</div>
                </div>

                <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
                  <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
                    Bias (Model - Obs)
                  </div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      (data.metrics?.bias ?? 0) > 0
                        ? 'text-amber-400'
                        : (data.metrics?.bias ?? 0) < 0
                        ? 'text-teal-400'
                        : 'text-ocean-text-secondary'
                    }`}
                  >
                    {data.metrics?.bias !== undefined
                      ? `${data.metrics.bias > 0 ? '+' : ''}${data.metrics.bias} ${data.units}`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-ocean-muted mt-0.5">
                    {(data.metrics?.bias ?? 0) > 0
                      ? 'Model warm/high bias'
                      : (data.metrics?.bias ?? 0) < 0
                      ? 'Model cold/low bias'
                      : 'Unbiased'}
                  </div>
                </div>

                <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
                  <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
                    Pearson Correlation (r)
                  </div>
                  <div className="text-lg font-bold text-ocean-accent mt-0.5">
                    {data.metrics?.pearson_r !== null && data.metrics?.pearson_r !== undefined
                      ? data.metrics.pearson_r.toFixed(3)
                      : '—'}
                  </div>
                  <div className="text-[10px] text-ocean-accent/80 mt-0.5">
                    {data.metrics?.r_squared !== null && data.metrics?.r_squared !== undefined
                      ? `R² = ${data.metrics.r_squared.toFixed(3)}`
                      : 'Zero variance'}
                  </div>
                </div>

                <div className="bg-ocean-bg/60 border border-ocean-border rounded-xl p-3">
                  <div className="text-[10px] font-mono text-ocean-muted uppercase tracking-wider">
                    Collocated Levels (N)
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {data.metrics?.sample_count ?? 0}
                  </div>
                  <div className="text-[10px] text-ocean-muted mt-0.5">Vertical CTD depths</div>
                </div>
              </div>

              {/* Chart Mode Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ocean-text-secondary">Collocated Water Column View:</span>
                  <div className="flex items-center gap-1 bg-ocean-bg/80 p-0.5 rounded-lg border border-ocean-border">
                    <button
                      onClick={() => setViewMode('sounding')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all duration-[150ms] ease-nasa ${
                        viewMode === 'sounding'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          : 'text-ocean-muted hover:text-ocean-text-secondary'
                      }`}
                    >
                      Vertical Sounding (Obs vs. Model)
                    </button>
                    <button
                      onClick={() => setViewMode('residual')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all duration-[150ms] ease-nasa ${
                        viewMode === 'residual'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          : 'text-ocean-muted hover:text-ocean-text-secondary'
                      }`}
                    >
                      Residual Depth Delta (Model - Obs)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-teal-400 border border-teal-200 inline-block" />
                    <span className="text-ocean-text-secondary">In-situ Observation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm border-2 border-dashed border-amber-400 inline-block" />
                    <span className="text-ocean-text-secondary">INCOIS Bio-ROMS</span>
                  </div>
                </div>
              </div>

              {/* Chart Canvas */}
              <div className="h-80 w-full bg-ocean-bg/70 border border-ocean-border rounded-xl p-3">
                {viewMode === 'sounding' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data.depth_profiles}
                      margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis
                        dataKey="depth"
                        type="number"
                        domain={[0, 'auto']}
                        reversed={true}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{
                          value: 'Depth (meters below surface) [Inverted Axis]',
                          position: 'insideBottom',
                          offset: -10,
                          fill: '#94a3b8',
                          fontSize: 11
                        }}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{
                          value: `${data.variable.toUpperCase()} (${data.units})`,
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#94a3b8',
                          fontSize: 11
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px'
                        }}
                        formatter={(val: any, name: string) => [
                          `${val} ${data.units}`,
                          name === 'observation' ? 'In-situ CTD Obs' : 'Bio-ROMS Model'
                        ]}
                        labelFormatter={(lbl) => `Depth: ${lbl} m`}
                      />
                      <Line
                        type="monotone"
                        dataKey="observation"
                        name="observation"
                        stroke="#14b8a6"
                        strokeWidth={2.2}
                        dot={{ r: 2, fill: '#14b8a6' }}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="model"
                        name="model"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 2, fill: '#f59e0b' }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.depth_profiles}
                      margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis
                        dataKey="depth"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{
                          value: 'Depth (meters below surface)',
                          position: 'insideBottom',
                          offset: -10,
                          fill: '#94a3b8',
                          fontSize: 11
                        }}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{
                          value: `Residual: (Model - Obs) [${data.units}]`,
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#94a3b8',
                          fontSize: 11
                        }}
                      />
                      <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px'
                        }}
                        formatter={(val: any) => [`${val} ${data.units}`, 'Residual (Model - Obs)']}
                        labelFormatter={(lbl) => `Depth: ${lbl} m`}
                      />
                      <Bar
                        dataKey="residual"
                        fill="#14b8a6"
                        opacity={0.85}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Scientific Provenance & Collocation Audit Card */}
              <div className="bg-ocean-bg/40 border border-ocean-border/70 rounded-xl p-4 text-xs text-ocean-text-secondary">
                <div className="font-semibold text-ocean-text-secondary flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-ocean-accent" />
                  <span>Scientific Provenance &amp; Collocation Methodology</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-ocean-muted text-[11px] leading-relaxed">
                  <div>
                    <span className="font-mono text-ocean-text-secondary">Model Lineage:</span>{' '}
                    {data.provenance?.model_source || 'INCOIS Operational Bio-ROMS 3.9'}
                  </div>
                  <div>
                    <span className="font-mono text-ocean-text-secondary">Observation Lineage:</span>{' '}
                    {data.provenance?.observation_source || 'INCOIS GDAC NetCDF'}
                  </div>
                  <div>
                    <span className="font-mono text-ocean-text-secondary">Collocation Technique:</span>{' '}
                    {data.provenance?.collocation_method ||
                      'Bilinear spatial + 1D piecewise linear depth collocation'}
                  </div>
                  <div>
                    <span className="font-mono text-ocean-text-secondary">Quality Control:</span>{' '}
                    {data.provenance?.qc_mode || 'Strict UNESCO Argo QC flags (1 & 2 only)'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-ocean-border/80 bg-ocean-bg/60 flex items-center justify-between">
          <div className="text-[11px] text-ocean-muted">
            Ground-truth verification powered by authentic INCOIS hydrodynamic archives.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAnalytics}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-600 hover:from-teal-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all duration-[150ms] ease-nasa active:scale-[0.98]"
            >
              <BarChart3 className="w-4 h-4 text-teal-200" />
              <span>Open in Ocean Analytics Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
