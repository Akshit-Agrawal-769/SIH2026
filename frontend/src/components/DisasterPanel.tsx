import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Activity, CheckCircle2, Crosshair, Download, Flame, Info, Leaf, Loader2, Orbit, RotateCcw, Siren, Thermometer,
  TriangleAlert, Waves, Wind
} from 'lucide-react';
import { useOceanStore, hazardDate } from '../store/useOceanStore';
import {
  DisasterLayerId, DriftMode, ExtLayerId, MonthlyLayerId, WindagePreset, advisoryExportUrl, isExtLayer
} from '../api/hazardsClient';
import { liveApiAvailable } from '../api/config';
import {
  BLOOM_COLORS, BLOOM_LABELS, DHW_STOPS, DRIFT_COLORS, GPI_STOPS, MHW_COLORS, MHW_LABELS, TCHP_STOPS, TRACK_BANDS
} from '../rendering/hazardLayers';

const CAPTIONS: Record<DisasterLayerId, string> = {
  mhw_intensity:
    'Monthly-mean MHW index: Hobday et al. (2018) categories on monthly-mean IBR SST against a per-cell 1990–2019 ' +
    'monthly climatology and 90th percentile. The ≥5-day rule cannot be checked on monthly data. A fixed baseline ' +
    'still counts part of long-term warming as heatwave.',
  mhw_detrended:
    'Same index after removing each cell’s linear 1980–2019 SST trend (Jacox et al. 2020 shifting baseline), so ' +
    'it shows short-term extremes rather than long-term warming.',
  chl_bloom:
    'Chlorophyll bloom anomaly: the MHW ratio method on log10(IBR model chlorophyll) against a 1990–2019 monthly ' +
    'climatology. Screens for unusually strong blooms; it does NOT identify harmful species or toxins.',
  eddy_convergence:
    'Convergence indicator, NOT a cyclone forecast. SST ≥ 26.5 °C (IBR month) with cyclonic geostrophic vorticity ' +
    'from ARMOR3D 2024-12-31: the dates differ, so the co-location is illustrative only.',
  mhw_daily:
    'Daily marine heatwaves from NOAA OISST v2.1 using Hobday et al. (2016): above the 1991–2020 day-of-year 90th ' +
    'percentile for ≥ 5 days (gaps ≤ 2 days joined). Colours are Hobday (2018) categories inside detected events.',
  dhw:
    'Degree Heating Weeks, NOAA Coral Reef Watch v3.1 method on OISST 0.25°: accumulated HotSpots ≥ 1 °C over 12 ' +
    'weeks. ≥ 4 °C-weeks: significant bleaching likely; ≥ 8: severe bleaching and mortality likely.',
  tchp:
    'Tropical Cyclone Heat Potential from HYCOM 3-D temperature (Leipper & Volgenau 1972): ocean heat above the ' +
    '26 °C isotherm. > 50 kJ/cm² favours intensification. Not a forecast.',
  gpi:
    'Genesis Potential Index (Emanuel & Nolan 2004) from NCEP/NCAR Reanalysis 1 monthly fields (850 hPa vorticity, ' +
    '600 hPa humidity, shear, potential intensity) + OISST. A monthly climate index of how favourable the ' +
    'atmosphere and ocean are for cyclone formation, not a storm forecast.',
  eddy_convergence_nrt:
    'Same-day OISST (≥ 26.5 °C) and cyclonic vorticity of the daily-mean HYCOM total surface current: no date ' +
    'mismatch. Still an ocean-only co-location indicator, NOT a cyclone forecast.'
};

const LAYER_TITLES: Record<DisasterLayerId, [string, string]> = {
  mhw_intensity: ['Marine heatwave · fixed baseline', 'IBR SST · 1990–2019'],
  mhw_detrended: ['Marine heatwave · detrended', 'IBR SST · trend removed'],
  chl_bloom: ['Chlorophyll bloom anomaly', 'IBR CHL · HAB screening'],
  eddy_convergence: ['Warm-water & eddy convergence', 'IBR SST + ARMOR3D 2024-12-31'],
  mhw_daily: ['Marine heatwave · daily', 'NOAA OISST v2.1 · Hobday 2016'],
  dhw: ['Coral bleaching heat stress (DHW)', 'OISST · CRW method'],
  tchp: ['Cyclone heat potential (TCHP)', 'HYCOM ESPC-D-V02 3-D'],
  gpi: ['Genesis Potential Index', 'NCEP R1 monthly + OISST'],
  eddy_convergence_nrt: ['Eddy convergence · same day', 'OISST + HYCOM currents']
};

const ICONS: Record<DisasterLayerId, React.ReactNode> = {
  mhw_intensity: <Flame className="w-3.5 h-3.5 text-orange-400" />,
  mhw_detrended: <Flame className="w-3.5 h-3.5 text-orange-300" />,
  chl_bloom: <Leaf className="w-3.5 h-3.5 text-green-400" />,
  eddy_convergence: <Orbit className="w-3.5 h-3.5 text-amber-400" />,
  mhw_daily: <Thermometer className="w-3.5 h-3.5 text-red-400" />,
  dhw: <Activity className="w-3.5 h-3.5 text-yellow-300" />,
  tchp: <Waves className="w-3.5 h-3.5 text-orange-300" />,
  gpi: <Wind className="w-3.5 h-3.5 text-fuchsia-300" />,
  eddy_convergence_nrt: <Orbit className="w-3.5 h-3.5 text-amber-300" />
};

const Caption: React.FC<{ text: string; open: boolean }> = ({ text, open }) =>
  open ? <p className="mt-1.5 text-[9px] leading-snug text-ocean-muted">{text}</p> : null;

const rgb = (c: number[]) => `rgb(${c.join(',')})`;

const CategoryLegend: React.FC<{ colors: Record<number, [number, number, number]>; labels: Record<number, string> }> = ({ colors, labels }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4].map((c) => (
      <span key={c} className="flex-1 text-center text-[8px] font-mono rounded py-0.5 border border-white/10"
        style={{ background: `rgba(${colors[c].join(',')},0.8)`, color: c >= 3 ? '#fff' : '#111' }}>
        {labels[c]}
      </span>
    ))}
  </div>
);

const RampLegend: React.FC<{ stops: [number, [number, number, number]][]; units: string }> = ({ stops, units }) => (
  <div>
    <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.map(([, c]) => rgb(c)).join(', ')})` }} />
    <div className="flex justify-between text-[8px] font-mono text-ocean-muted">
      {stops.map(([v]) => <span key={v}>{v}</span>)}<span>{units}</span>
    </div>
  </div>
);

function legendFor(id: DisasterLayerId): React.ReactNode {
  switch (id) {
    case 'mhw_intensity': case 'mhw_detrended': case 'mhw_daily':
      return <CategoryLegend colors={MHW_COLORS} labels={MHW_LABELS} />;
    case 'chl_bloom':
      return <CategoryLegend colors={BLOOM_COLORS} labels={BLOOM_LABELS} />;
    case 'dhw':
      return <RampLegend stops={DHW_STOPS} units="°C-wk" />;
    case 'tchp':
      return <RampLegend stops={TCHP_STOPS} units="kJ/cm²" />;
    case 'gpi':
      return <RampLegend stops={GPI_STOPS} units="GPI" />;
    default:
      return (
        <>
          <div className="h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,191,0,0.3), rgb(255,94,0))' }} />
          <div className="flex justify-between text-[8px] font-mono text-ocean-muted"><span>1</span><span>indicator</span><span>100</span></div>
        </>
      );
  }
}

export const DisasterPanel: React.FC = () => {
  const s = useOceanStore(useShallow((st) => ({
    active: st.activeDisasterLayers,
    toggle: st.toggleDisasterLayer,
    date: hazardDate(st),
    selectedTime: st.selectedTime,
    data: st.hazardIndicatorData,
    advisories: st.activeAdvisories,
    advUnavailable: st.advisoriesUnavailable,
    loading: st.hazardsLoading,
    refresh: st.refreshHazards,
    layerStatus: st.layerStatus,
    extCatalog: st.extCatalog,
    loadExtCatalog: st.loadExtCatalog,
    extDates: st.extDates,
    setExtDate: st.setExtDate,
    extSummaries: st.extSummaries,
    point: st.driftSimulationCoordinates,
    mode: st.driftMode,
    setMode: st.setDriftMode,
    hours: st.driftHours,
    setHours: st.setDriftHours,
    picking: st.isPickingDriftPoint,
    setPicking: st.setIsPickingDriftPoint,
    drift: st.driftResult,
    driftLoading: st.driftLoading,
    driftOptions: st.driftOptions,
    setDriftOptions: st.setDriftOptions,
    driftWindow: st.driftWindow,
    loadDriftWindow: st.loadDriftWindow,
    runDrift: st.runDriftSimulation,
    clearDrift: st.clearDrift,
    clicked: st.clickedGlobePoint,
    setPoint: st.setDriftSimulationCoordinates,
    showTracks: st.showCycloneTracks,
    setShowTracks: st.setShowCycloneTracks,
    tracks: st.cycloneTracks,
    trackSeasons: st.trackSeasons,
    setTrackSeasons: st.setTrackSeasons,
    skill: st.driftSkill,
    validation: st.validation,
    loadDocs: st.loadHazardDocs
  })));
  const [info, setInfo] = useState<Record<string, boolean>>({});
  const flip = (k: string) => setInfo((m) => ({ ...m, [k]: !m[k] }));

  useEffect(() => {
    void s.loadExtCatalog();
    void s.loadDriftWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyOn = s.active.length > 0;
  const activeKey = s.active.join(',');
  useEffect(() => {
    if (anyOn) void s.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyOn, activeKey, s.date]);

  const monthNote = s.selectedTime && s.date && !s.selectedTime.startsWith(s.date)
    ? ' (selected time has no SST; showing latest SST month)' : '';

  const summaryLine = (id: DisasterLayerId): React.ReactNode => {
    if (!isExtLayer(id)) {
      if (id === 'eddy_convergence') {
        const e = s.data.eddy;
        return e && !e.available ? <p className="text-[9px] text-amber-300/80">{e.reason}</p> : null;
      }
      const m = s.data.monthly[id as MonthlyLayerId];
      if (!m) return null;
      return m.available
        ? <p className="text-[9px] text-ocean-text-secondary font-mono">
            {(m.mhw_fraction * 100).toFixed(1)}% of ocean cells ≥ threshold · max ratio {m.max_ratio ?? '—'}
          </p>
        : <p className="text-[9px] text-amber-300/80">{m.reason}</p>;
    }
    const x = s.extSummaries[id];
    if (!x) return null;
    if (!x.available) return <p className="text-[9px] text-amber-300/80">{x.reason}</p>;
    const t = 'text-[9px] text-ocean-text-secondary font-mono';
    if (id === 'mhw_daily') return <p className={t}>{((x.mhw_fraction ?? 0) * 100).toFixed(1)}% of ocean in a heatwave event · max ratio {x.max_ratio ?? '—'}</p>;
    if (id === 'dhw') return <p className={t}>max DHW {x.max_dhw ?? '—'} °C-weeks · {(x.bands ?? []).filter((b) => !b.range.startsWith('0')).map((b) => `${b.range.split(' ')[0]}: ${b.area_km2.toLocaleString()} km²`).join(' · ')}</p>;
    if (id === 'tchp') return <p className={t}>{((x.fraction_above_threshold ?? 0) * 100).toFixed(1)}% of ocean ≥ 50 kJ/cm² · max {x.max ?? '—'}</p>;
    if (id === 'gpi') return <p className={t}>max {x.max ?? '—'} · domain mean vs 1991–2020: ×{x.anomaly_ratio_domain ?? '—'}</p>;
    return null;
  };

  const layerRow = (id: DisasterLayerId) => {
    const on = s.active.includes(id);
    const st = s.layerStatus[`hazard_${id}`];
    const warn = on && st && (st.state === 'nodata' || st.state === 'error');
    const [name, sub] = LAYER_TITLES[id];
    const meta = isExtLayer(id) ? s.extCatalog?.[id] : null;
    const dates = meta?.dates ?? [];
    const unavailable = isExtLayer(id) && s.extCatalog !== null && !dates.length;
    return (
      <div key={id} className={`p-2 rounded-xl border ${on ? 'bg-white/10 border-amber-400/40' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => s.toggle(id)} aria-pressed={on}
            className="flex items-center gap-2 min-w-0 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded">
            <span aria-hidden="true" className={`w-3 h-3 rounded-sm border ${on ? 'bg-amber-400 border-amber-400' : 'border-neutral-500'}`} />
            {ICONS[id]}
            <span className="min-w-0">
              <span className="block text-xs font-medium leading-tight text-white truncate">{name}</span>
              <span className="block text-[9px] text-ocean-muted font-mono truncate">
                {warn ? st?.message ?? 'no data' : on && st?.state === 'loading' ? 'loading…' : unavailable ? (meta?.reason ?? 'not available') : sub}
              </span>
            </span>
          </button>
          <button onClick={() => flip(id)} aria-expanded={!!info[id]} aria-label={`About ${name}`}
            className="text-ocean-muted hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded">
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <Caption text={CAPTIONS[id]} open={!!info[id]} />
        {on && (
          <div className="mt-1.5 space-y-1">
            {isExtLayer(id) && dates.length > 0 && (
              <select value={s.extDates[id] ?? dates[dates.length - 1]} aria-label={`${name} date`}
                onChange={(e) => s.setExtDate(id as ExtLayerId, e.target.value)}
                className="w-full text-[10px] bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary font-mono">
                {[...dates].reverse().map((d) => <option key={d} value={d}>{id === 'gpi' ? d.slice(0, 7) : d}</option>)}
              </select>
            )}
            {legendFor(id)}
            {summaryLine(id)}
          </div>
        )}
      </div>
    );
  };

  // ---- cyclone tracks
  const tracksDoc = s.tracks && 'storms' in s.tracks ? s.tracks : null;
  const shownStorms = useMemo(
    () => tracksDoc ? tracksDoc.storms.filter((st) => st.season >= s.trackSeasons[0] && st.season <= s.trackSeasons[1]) : [],
    [tracksDoc, s.trackSeasons]
  );
  const seasons = useMemo(() => {
    const out: number[] = [];
    for (let y = 1980; y <= new Date().getUTCFullYear(); y++) out.push(y);
    return out;
  }, []);

  const drift = s.drift;
  const win = s.driftWindow && s.driftWindow.available ? s.driftWindow : null;
  const skill = s.skill && 'summary' in s.skill ? s.skill : null;
  const validation = s.validation && 'tests' in s.validation ? s.validation : null;
  const live = liveApiAvailable() !== false;

  return (
    <div className="space-y-1.5">
      <h3 className="px-1 text-[10px] font-semibold text-amber-300/90 uppercase tracking-wider flex items-center gap-1.5">
        <Siren className="w-3.5 h-3.5" /> Disaster Early Warning
      </h3>

      <p className="px-1 text-[9px] font-semibold text-ocean-muted uppercase tracking-wider">Daily &amp; near-real-time</p>
      {(['mhw_daily', 'dhw', 'tchp', 'eddy_convergence_nrt', 'gpi'] as DisasterLayerId[]).map(layerRow)}

      <p className="px-1 pt-1 text-[9px] font-semibold text-ocean-muted uppercase tracking-wider">
        Monthly model indices · IBR month {s.date ?? '—'}{monthNote}
      </p>
      {(['mhw_intensity', 'mhw_detrended', 'chl_bloom', 'eddy_convergence'] as DisasterLayerId[]).map(layerRow)}

      {/* ---- Cyclone tracks ---- */}
      <div className={`p-2 rounded-xl border space-y-1.5 ${s.showTracks ? 'bg-white/10 border-cyan-400/40' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => s.setShowTracks(!s.showTracks)} aria-pressed={s.showTracks}
            className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded">
            <span aria-hidden="true" className={`w-3 h-3 rounded-sm border ${s.showTracks ? 'bg-cyan-400 border-cyan-400' : 'border-neutral-500'}`} />
            <Wind className="w-3.5 h-3.5 text-cyan-300" />
            <span>
              <span className="block text-xs font-medium text-white">Cyclone tracks (IBTrACS)</span>
              <span className="block text-[9px] text-ocean-muted font-mono">NOAA NCEI v04r01 · IMD / JTWC winds</span>
            </span>
          </button>
          <button onClick={() => flip('tracks')} aria-label="About cyclone tracks" aria-expanded={!!info.tracks}
            className="text-ocean-muted hover:text-white"><Info className="w-3.5 h-3.5" /></button>
        </div>
        <Caption open={!!info.tracks} text={'Best tracks from IBTrACS v04r01 (Knapp et al. 2010) for the North and South Indian ' +
          'basins since 1980 that enter the map area. Segment colour = maximum sustained wind of the WMO agency (IMD 3-min ' +
          'for the North Indian Ocean), else JTWC. White dots mark the first fix. Recent seasons are provisional.'} />
        {s.showTracks && (
          <>
            <div className="flex items-center gap-1 text-[10px]">
              <select aria-label="From season" value={s.trackSeasons[0]} onChange={(e) => s.setTrackSeasons([Number(e.target.value), Math.max(Number(e.target.value), s.trackSeasons[1])])}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary">
                {seasons.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-ocean-muted">to</span>
              <select aria-label="To season" value={s.trackSeasons[1]} onChange={(e) => s.setTrackSeasons([Math.min(s.trackSeasons[0], Number(e.target.value)), Number(e.target.value)])}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary">
                {seasons.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {TRACK_BANDS.map(([, c, label]) => (
                <span key={label} className="flex items-center gap-1 text-[8px] font-mono text-ocean-muted">
                  <span className="w-2.5 h-1 rounded" style={{ background: c }} />{label}
                </span>
              ))}
            </div>
            <p className="text-[9px] font-mono text-ocean-text-secondary">
              {s.tracks === null ? 'loading…' : tracksDoc ? `${shownStorms.length} storms shown` : (s.tracks as { reason: string }).reason}
            </p>
          </>
        )}
      </div>

      {/* ---- Drift projection ---- */}
      <div className="p-2 rounded-xl border bg-white/5 border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" style={{ color: DRIFT_COLORS[s.mode] }} /> Drift projection (spill / SAR)
          </span>
          <button onClick={() => { flip('drift'); void s.loadDocs(); }} aria-label="About drift projection" aria-expanded={!!info.drift}
            className="text-ocean-muted hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded">
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <Caption open={!!info.drift} text={'Ensemble: RK4 through time-varying HYCOM total surface currents plus a fraction of ' +
          'the GFS 10 m wind (windage), with random-walk diffusion and a perturbed start. The central line is the unperturbed ' +
          'run; ellipses are the 2-sigma spread of the members (the uncertainty cone). Windage and diffusivity are ' +
          'ASSUMPTIONS you choose. "Geostrophic (legacy)" is the previous single-line static-field run.'} />
        <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Drift mode">
          {(['forward', 'reverse'] as DriftMode[]).map((m) => (
            <button key={m} role="radio" aria-checked={s.mode === m} onClick={() => s.setMode(m)}
              className={`text-[10px] py-1 rounded-lg border font-medium focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
                s.mode === m ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/10 text-ocean-muted'}`}
              style={s.mode === m ? { boxShadow: `0 0 8px ${DRIFT_COLORS[m]}66`, borderColor: DRIFT_COLORS[m] } : undefined}>
              {m === 'forward' ? 'Forward (spill)' : 'Reverse (SAR origin)'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <label className="text-ocean-muted">Model
            <select value={s.driftOptions.engine} onChange={(e) => s.setDriftOptions({ engine: e.target.value as 'ensemble' | 'geostrophic' })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary">
              <option value="ensemble">Ensemble (HYCOM + wind)</option>
              <option value="geostrophic">Geostrophic (legacy)</option>
            </select>
          </label>
          <label className="text-ocean-muted">Windage (assumed)
            <select value={s.driftOptions.windage} disabled={s.driftOptions.engine !== 'ensemble'}
              onChange={(e) => s.setDriftOptions({ windage: e.target.value as WindagePreset })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary disabled:opacity-40">
              <option value="oil">3 % – surface oil</option>
              <option value="low">1 % – person / low profile</option>
              <option value="none">0 % – water-following</option>
            </select>
          </label>
          <label className="text-ocean-muted">Diffusivity K (assumed)
            <select value={s.driftOptions.diffusivity ?? ''} disabled={s.driftOptions.engine !== 'ensemble'}
              onChange={(e) => s.setDriftOptions({ diffusivity: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary disabled:opacity-40">
              <option value="">default {win?.default_diffusivity_m2s ?? 50} m²/s</option>
              {[10, 100, 200].map((k) => <option key={k} value={k}>{k} m²/s</option>)}
            </select>
          </label>
          <label className="text-ocean-muted">Hours
            <select value={s.hours} onChange={(e) => s.setHours(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary">
              {[12, 24, 48, 72, 120].map((h) => <option key={h} value={h}>{h} h</option>)}
            </select>
          </label>
        </div>
        {s.driftOptions.engine === 'ensemble' && (
          <label className="block text-[10px] text-ocean-muted">Start time (UTC) {win ? `· fields ${win.start.slice(0, 16)} – ${win.end.slice(0, 16)}` : ''}
            <input type="datetime-local" step={3600}
              min={win?.start.slice(0, 16)} max={win?.end.slice(0, 16)}
              value={s.driftOptions.start ? s.driftOptions.start.slice(0, 16) : ''}
              onChange={(e) => s.setDriftOptions({ start: e.target.value ? `${e.target.value}:00Z` : null })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-ocean-text-secondary font-mono" />
            <span className="text-[8px]">Empty = latest run that fits in the available fields.</span>
          </label>
        )}
        <div className="flex items-center gap-1.5">
          <button onClick={() => s.setPicking(!s.picking)}
            className={`flex-1 text-[10px] py-1 rounded-lg border focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
              s.picking ? 'bg-amber-400/20 border-amber-400/60 text-amber-200' : 'bg-white/5 border-white/10 text-ocean-text-secondary hover:text-white'}`}>
            {s.picking ? 'Click the ocean…' : s.point ? 'Re-pick point' : 'Pick point on globe'}
          </button>
          {s.clicked && !s.point && (
            <button onClick={() => s.setPoint({ lat: s.clicked!.lat, lon: s.clicked!.lon })}
              className="text-[10px] py-1 px-2 rounded-lg border bg-white/5 border-white/10 text-ocean-text-secondary hover:text-white">
              Use last click
            </button>
          )}
        </div>
        <p className="text-[9px] font-mono text-ocean-muted">
          {s.mode === 'forward' ? 'Release' : 'Last known'}: {s.point ? `${s.point.lat.toFixed(3)}°N, ${s.point.lon.toFixed(3)}°E` : '—'}
        </p>
        <div className="flex gap-1.5">
          <button disabled={!s.point || s.driftLoading} onClick={() => void s.runDrift()}
            className="flex-1 text-[10px] py-1 rounded-lg border font-semibold disabled:opacity-40 bg-white/10 border-white/20 text-white hover:bg-white/15 flex items-center justify-center gap-1">
            {s.driftLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            Run {s.hours} h {s.mode}
          </button>
          <button onClick={s.clearDrift} aria-label="Clear drift"
            className="text-[10px] px-2 rounded-lg border bg-white/5 border-white/10 text-ocean-muted hover:text-white">
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
        {drift && !drift.available && <p className="text-[9px] text-amber-300/80">{drift.reason}</p>}
        {drift && drift.available && (
          <div className="text-[9px] font-mono text-ocean-text-secondary space-y-0.5">
            <p style={{ color: DRIFT_COLORS[drift.mode] }}>
              {drift.mode === 'forward' ? 'Projected position' : 'Probable origin'} after {drift.hours_simulated.toFixed(0)} h:
              {' '}{drift.end.lat.toFixed(3)}°N, {drift.end.lon.toFixed(3)}°E · {drift.path_length_km.toFixed(1)} km
            </p>
            {drift.start_time && <p>{drift.start_time} → {drift.end_time}</p>}
            {drift.cone && drift.cone.length > 0 && (
              <p>Spread at {Math.abs(drift.cone[drift.cone.length - 1].t_hours)} h: 50 % of members within {drift.cone[drift.cone.length - 1].radius_km_p50} km,
                90 % within {drift.cone[drift.cone.length - 1].radius_km_p90} km of the central run</p>
            )}
            {drift.assumptions && (
              <p className="text-amber-200/80">Assumed: windage {(drift.assumptions.windage.coefficient * 100).toFixed(0)} %, K {drift.assumptions.diffusivity_m2s} m²/s,
                start σ {drift.assumptions.position_sigma_km} km, {drift.assumptions.members} members</p>
            )}
            {typeof drift.stranded_fraction === 'number' && drift.stranded_fraction > 0 && (
              <p className="text-amber-300/80">{(drift.stranded_fraction * 100).toFixed(0)} % of members reached the coast</p>
            )}
            {drift.stopped_early && <p className="text-amber-300/80">Stopped early: {drift.stopped_early}</p>}
          </div>
        )}
        {drift && drift.available && (
          <ul className="text-[9px] leading-snug text-amber-200/80 list-disc pl-3.5 space-y-0.5">
            {drift.caveats.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        {info.drift && skill && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-1.5 space-y-1">
            <p className="text-[9px] font-semibold text-white">Skill vs {skill.drifters.split(' (')[0]} · {skill.window.join(' – ')}</p>
            <table className="w-full text-[8.5px] font-mono text-ocean-text-secondary">
              <thead><tr className="text-ocean-muted"><th className="text-left font-normal">model</th><th>n</th><th>24 h</th><th>72 h</th><th>skill</th></tr></thead>
              <tbody>
                {Object.entries(skill.summary).map(([k, v]) => v.all && (
                  <tr key={k}><td className="text-left pr-1">{v.label}</td><td className="text-center">{v.all.segments}</td>
                    <td className="text-center">{v.all.median_sep_km_24h} km</td><td className="text-center">{v.all.median_sep_km_72h} km</td>
                    <td className="text-center">{v.all.mean_skill.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-[8px] text-ocean-muted">Median separation from real drifters; skill = Liu &amp; Weisberg (2011), 1 = perfect.</p>
          </div>
        )}
      </div>

      {/* ---- Validation ---- */}
      <div className="p-2 rounded-xl border bg-white/5 border-white/10 space-y-1">
        <button onClick={() => { flip('validation'); void s.loadDocs(); }} aria-expanded={!!info.validation}
          className="w-full text-left text-xs font-medium text-white flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Checked against real storms
        </button>
        {info.validation && (validation ? (
          <div className="space-y-1">
            <p className="text-[8.5px] text-ocean-muted">{validation.storms_source}</p>
            {validation.tests.filter((t) => t.test !== 'storms_in_nrt_window').map((t) => (
              <div key={t.test} className="rounded-lg border border-white/10 bg-black/20 p-1.5">
                <p className="text-[9px] text-white">{t.description}</p>
                <p className="text-[8.5px] font-mono text-ocean-text-secondary">
                  {Object.entries(t).filter(([k, v]) => !['test', 'description', 'interpretation', 'fixes', 'note', 'window'].includes(k) && (typeof v === 'number' || typeof v === 'string'))
                    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
                </p>
                {t.interpretation && <p className="text-[8px] text-ocean-muted">{t.interpretation}</p>}
              </div>
            ))}
          </div>
        ) : <p className="text-[9px] text-ocean-muted">{s.validation && !('tests' in s.validation) ? s.validation.reason : 'loading…'}</p>)}
      </div>

      {/* ---- Advisories ---- */}
      {anyOn && (
        <div className="p-2 rounded-xl border bg-white/5 border-white/10 space-y-1.5" aria-live="polite">
          <span className="text-xs font-medium text-white flex items-center gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-400" /> Advisories
            {s.loading && <Loader2 className="w-3 h-3 animate-spin text-ocean-muted" />}
          </span>
          {s.advisories.length === 0 && !s.loading && (
            <p className="text-[9px] text-ocean-muted">No regions exceed the advisory thresholds.</p>
          )}
          {s.advisories.map((a) => (
            <div key={a.title + a.date} className="rounded-lg border border-white/10 bg-white/5 p-1.5">
              <p className="text-[10px] font-semibold"
                style={{ color: a.type.startsWith('marine_heatwave') ? `rgb(${(MHW_COLORS[({ moderate: 1, strong: 2, severe: 3, extreme: 4 } as Record<string, number>)[a.level] ?? 1] ?? MHW_COLORS[1]).map((x) => Math.max(x, 120)).join(',')})` : '#fbbf24' }}>
                {a.title}
              </p>
              <p className="text-[9px] text-ocean-text-secondary leading-snug">{a.detail}</p>
              <p className="text-[8px] text-ocean-muted font-mono">{a.date}{a.source ? ` · ${a.source}` : ''}</p>
            </div>
          ))}
          {Object.entries(s.advUnavailable).map(([k, reason]) => (
            <p key={k} className="text-[9px] text-amber-300/80">{k.replace(/_/g, ' ')}: {reason}</p>
          ))}
          {live && (
            <div className="flex gap-1.5">
              {(['geojson', 'cap'] as const).map((k) => (
                <a key={k} href={advisoryExportUrl(k)} target="_blank" rel="noreferrer"
                  className="flex-1 text-center text-[9px] py-1 rounded-lg border bg-white/5 border-white/10 text-ocean-text-secondary hover:text-white flex items-center justify-center gap-1">
                  <Download className="w-3 h-3" /> {k === 'geojson' ? 'GeoJSON' : 'CAP 1.2 XML'}
                </a>
              ))}
            </div>
          )}
          <p className="text-[8px] text-ocean-muted">Descriptive summaries of the layers above; none is a forecast.</p>
        </div>
      )}
    </div>
  );
};
