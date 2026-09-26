import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Crosshair, Flame, Info, Loader2, Orbit, RotateCcw, Siren, TriangleAlert } from 'lucide-react';
import { useOceanStore, hazardDate } from '../store/useOceanStore';
import type { DisasterLayerId, DriftMode } from '../api/hazardsClient';
import { DRIFT_COLORS, MHW_COLORS, MHW_LABELS } from '../rendering/hazardLayers';

const MHW_CAPTION =
  'Monthly-mean MHW index: Hobday et al. (2018) categories applied to monthly-mean IBR SST against a per-cell ' +
  '1982–2011 monthly climatology and 90th-percentile threshold. The ≥5-day duration rule cannot be checked on ' +
  'monthly data, so this marks months whose mean exceeded the threshold, not verified heatwave events.';

const EDDY_CAPTION =
  'Convergence indicator, NOT a cyclone forecast. Marks where SST ≥ 26.5 °C coincides with cyclonic OCEAN ' +
  'geostrophic vorticity. Cyclogenesis depends on atmospheric conditions (low-level vorticity, humidity, wind ' +
  'shear) that are not in these datasets.';

const DRIFT_CAVEATS = [
  'Geostrophic currents only (CMEMS ARMOR3D): no wind-driven (Ekman) flow.',
  'Single 2024-12-31 snapshot, assumed unchanged for the whole run.',
  'No Stokes (wave) drift or windage: the real drift can differ substantially.'
];

const Caption: React.FC<{ text: string; open: boolean }> = ({ text, open }) =>
  open ? <p className="mt-1.5 text-[9px] leading-snug text-ocean-muted">{text}</p> : null;

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
    point: st.driftSimulationCoordinates,
    mode: st.driftMode,
    setMode: st.setDriftMode,
    hours: st.driftHours,
    setHours: st.setDriftHours,
    picking: st.isPickingDriftPoint,
    setPicking: st.setIsPickingDriftPoint,
    drift: st.driftResult,
    driftLoading: st.driftLoading,
    runDrift: st.runDriftSimulation,
    clearDrift: st.clearDrift,
    clicked: st.clickedGlobePoint,
    setPoint: st.setDriftSimulationCoordinates
  })));
  const [info, setInfo] = useState<Record<string, boolean>>({});
  const flip = (k: string) => setInfo((m) => ({ ...m, [k]: !m[k] }));

  // Summaries/advisories follow the SST month; fetched only while a hazard layer is on.
  const anyOn = s.active.length > 0;
  useEffect(() => {
    if (anyOn && s.date) void s.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyOn, s.date]);

  const monthNote = s.selectedTime && s.date && !s.selectedTime.startsWith(s.date)
    ? ` (selected time has no SST; showing latest SST month)` : '';

  const layerRow = (id: DisasterLayerId, name: string, sub: string, icon: React.ReactNode, caption: string) => {
    const on = s.active.includes(id);
    const st = s.layerStatus[`hazard_${id}`];
    const warn = on && st && (st.state === 'nodata' || st.state === 'error');
    return (
      <div className={`p-2 rounded-xl border ${on ? 'bg-white/10 border-amber-400/40' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => s.toggle(id)}
            aria-pressed={on}
            className="flex items-center gap-2 min-w-0 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded"
          >
            <span aria-hidden="true" className={`w-3 h-3 rounded-sm border ${on ? 'bg-amber-400 border-amber-400' : 'border-neutral-500'}`} />
            {icon}
            <span className="min-w-0">
              <span className="block text-xs font-medium leading-tight text-white truncate">{name}</span>
              <span className="block text-[9px] text-ocean-muted font-mono truncate">
                {warn ? st?.message ?? 'no data' : on && st?.state === 'loading' ? 'loading…' : sub}
              </span>
            </span>
          </button>
          <button
            onClick={() => flip(id)}
            aria-expanded={!!info[id]}
            aria-label={`About ${name}`}
            className="text-ocean-muted hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <Caption text={caption} open={!!info[id]} />
      </div>
    );
  };

  const mhw = s.data.mhw;
  const eddy = s.data.eddy;
  const drift = s.drift;

  return (
    <div className="space-y-1.5">
      <h3 className="px-1 text-[10px] font-semibold text-amber-300/90 uppercase tracking-wider flex items-center gap-1.5">
        <Siren className="w-3.5 h-3.5" /> Disaster Early Warning
      </h3>
      <p className="px-1 text-[9px] text-ocean-muted font-mono">
        SST month: {s.date ?? '—'}{monthNote}
      </p>

      {layerRow('mhw_intensity', 'Marine heatwave (monthly-mean index)', 'Hobday categories · IBR SST',
        <Flame className="w-3.5 h-3.5 text-orange-400" />, MHW_CAPTION)}
      {s.active.includes('mhw_intensity') && (
        <div className="px-1 space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((c) => (
              <span key={c} className="flex-1 text-center text-[8px] font-mono rounded py-0.5 border border-white/10"
                style={{ background: `rgba(${MHW_COLORS[c].join(',')},0.75)`, color: c >= 3 ? '#fff' : '#111' }}>
                {MHW_LABELS[c]}
              </span>
            ))}
          </div>
          {mhw && (mhw.available
            ? <p className="text-[9px] text-ocean-text-secondary font-mono">
                {(mhw.mhw_fraction * 100).toFixed(1)}% of ocean cells above threshold · max ratio {mhw.max_ratio ?? '—'}
              </p>
            : <p className="text-[9px] text-amber-300/80">{mhw.reason}</p>)}
        </div>
      )}

      {layerRow('eddy_convergence', 'Warm-water & eddy convergence', 'convergence indicator 0–100 · not a forecast',
        <Orbit className="w-3.5 h-3.5 text-amber-400" />,
        `${EDDY_CAPTION} SST is from the IBR month ${s.date ?? '—'}; vorticity is from ARMOR3D 2024-12-31. ` +
        'The two are not simultaneous, so their co-location is illustrative only. Vorticity is computed from ' +
        'geostrophic flow only.')}
      {s.active.includes('eddy_convergence') && (
        <div className="px-1 space-y-1">
          <div className="h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,191,0,0.3), rgb(255,94,0))' }} />
          <div className="flex justify-between text-[8px] font-mono text-ocean-muted"><span>1</span><span>indicator</span><span>100</span></div>
          <p className="text-[9px] text-amber-300/80 leading-snug">
            Not a cyclone forecast · SST {s.date ?? '—'} vs currents 2024-12-31 (dates differ)
          </p>
          {eddy && !eddy.available && <p className="text-[9px] text-amber-300/80">{eddy.reason}</p>}
        </div>
      )}

      {/* ---- Drift projection ---- */}
      <div className="p-2 rounded-xl border bg-white/5 border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" style={{ color: DRIFT_COLORS[s.mode] }} /> Simulate spill drift
          </span>
          <button onClick={() => flip('drift')} aria-label="About drift projection" aria-expanded={!!info.drift}
            className="text-ocean-muted hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded">
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <Caption text={'RK4 integration through the surface geostrophic current field. Forward: where material released here ' +
          'would travel. Reverse: integrates backwards from a last-known position to a probable origin.'} open={!!info.drift} />
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
          <select value={s.hours} onChange={(e) => s.setHours(Number(e.target.value))} aria-label="Hours"
            className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-1 py-1 text-ocean-text-secondary">
            {[12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
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
            {drift.stopped_early && <p className="text-amber-300/80">Stopped early: {drift.stopped_early}</p>}
          </div>
        )}
        {(drift?.available || s.point) && (
          <ul className="text-[9px] leading-snug text-amber-200/80 list-disc pl-3.5 space-y-0.5">
            {(drift && drift.available ? drift.caveats : DRIFT_CAVEATS).map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
      </div>

      {/* ---- Advisories ---- */}
      {anyOn && (
        <div className="p-2 rounded-xl border bg-white/5 border-white/10 space-y-1.5" aria-live="polite">
          <span className="text-xs font-medium text-white flex items-center gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-400" /> Advisories
            {s.loading && <Loader2 className="w-3 h-3 animate-spin text-ocean-muted" />}
          </span>
          {s.advisories.length === 0 && !s.loading && (
            <p className="text-[9px] text-ocean-muted">No regions exceed the advisory thresholds for {s.date ?? '—'}.</p>
          )}
          {s.advisories.map((a) => (
            <div key={a.title} className="rounded-lg border border-white/10 bg-white/5 p-1.5">
              <p className="text-[10px] font-semibold"
                style={{ color: a.type === 'marine_heatwave' ? `rgb(${(MHW_COLORS[({ moderate: 1, strong: 2, severe: 3, extreme: 4 } as Record<string, number>)[a.level] ?? 1] ?? MHW_COLORS[1]).map((x) => Math.max(x, 120)).join(',')})` : '#fbbf24' }}>
                {a.title}
              </p>
              <p className="text-[9px] text-ocean-text-secondary leading-snug">{a.detail}</p>
            </div>
          ))}
          {Object.entries(s.advUnavailable).map(([k, reason]) => (
            <p key={k} className="text-[9px] text-amber-300/80">{k.replace('_', ' ')}: {reason}</p>
          ))}
          <p className="text-[8px] text-ocean-muted">Descriptive summaries of the layers above; none is a forecast.</p>
        </div>
      )}
    </div>
  );
};
