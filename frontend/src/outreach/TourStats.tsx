import React, { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { fetchInstruments, fetchOceanTile, OceanTileData } from '../api/client';
import { fetchModelComparison } from '../api/analyticsClient';
import { GRID } from '../rendering/grid';
import { useOceanStore } from '../store/useOceanStore';
import type { BoxMeanSpec, TourStat } from './toursData';

/** Resolve 'latest' to the variable's newest catalog timestep. */
export function resolveTourTime(variable: string, time: string): string | null {
  const ts = useOceanStore.getState().catalog?.variables[variable]?.timesteps ?? [];
  if (time === 'latest') return ts.length ? ts[ts.length - 1] : null;
  return ts.includes(time) ? time : null;
}

/** Area-weighted (cos latitude) mean of the finite cells of a tile inside a lon/lat box. */
export function boxMean(tile: OceanTileData, box: [number, number, number, number]): { mean: number; cells: number } | null {
  const { width, height } = tile.header;
  const [w, s, e, n] = box;
  let sum = 0;
  let wsum = 0;
  let cells = 0;
  for (let r = 0; r < height; r++) {
    const lat = GRID.lat0 + r * GRID.dlat;
    if (lat < s || lat > n) continue;
    const wt = Math.cos((lat * Math.PI) / 180);
    for (let c = 0; c < width; c++) {
      const lon = GRID.lon0 + c * GRID.dlon;
      if (lon < w || lon > e) continue;
      const v = tile.values[r * width + c];
      if (!Number.isFinite(v)) continue;
      sum += v * wt;
      wsum += wt;
      cells++;
    }
  }
  return cells ? { mean: sum / wsum, cells } : null;
}

async function computeBoxMean(spec: BoxMeanSpec): Promise<{ mean: number; cells: number; date: string }> {
  const date = resolveTourTime(spec.variable, spec.time);
  if (!date) throw new Error(`no ${spec.variable} timestep ${spec.time} in the catalog`);
  const tile = await fetchOceanTile(spec.variable, date, 0);
  const m = boxMean(tile, spec.box);
  if (!m) throw new Error('no ocean cells with data in the box');
  return { ...m, date };
}

function decimals(variable: string): number {
  return variable === 'chlorophyll' ? 3 : variable === 'mld' ? 0 : variable === 'currents' ? 2 : 1;
}

async function evaluate(stat: TourStat): Promise<string> {
  const units = (v: string) => useOceanStore.getState().catalog?.variables[v]?.units ?? '';
  switch (stat.kind) {
    case 'boxMean': {
      const r = await computeBoxMean(stat.spec);
      return `${r.mean.toFixed(decimals(stat.spec.variable))} ${units(stat.spec.variable)} (${r.date}, ${r.cells} cells)`;
    }
    case 'boxDiff': {
      const [a, b] = await Promise.all([computeBoxMean(stat.a), computeBoxMean(stat.b)]);
      const d = a.mean - b.mean;
      return `${d > 0 ? '+' : ''}${d.toFixed(decimals(stat.a.variable))} ${units(stat.a.variable)}`;
    }
    case 'floatCount': {
      const fc = await fetchInstruments();
      const argo = fc.features.filter((f) => (f.properties.platform_type || 'argo') === 'argo');
      const dates = argo.map((f) => String(f.properties.last_report || '').slice(0, 10)).filter(Boolean).sort();
      return `${argo.length.toLocaleString()} (latest profiles ${dates[0] ?? '—'} … ${dates[dates.length - 1] ?? '—'})`;
    }
    case 'matchups': {
      const c = await fetchModelComparison(stat.instrumentId, stat.variable);
      if (!c.available || !c.pairs?.length) return c.reason || 'none';
      const t = c.pairs.map((p) => String(p.time).slice(0, 10)).sort();
      return `${c.pairs.length} pairs, ${t[0]} … ${t[t.length - 1]}`;
    }
  }
}

/** Numbers for a tour step, computed live from the served data (never hard-coded). */
export const TourStats: React.FC<{ stats?: TourStat[] }> = ({ stats }) => {
  const catalog = useOceanStore((s) => s.catalog);
  const [values, setValues] = useState<(string | null)[]>([]);

  useEffect(() => {
    let alive = true;
    const list = stats ?? [];
    setValues(list.map(() => null));
    list.forEach((st, i) => {
      evaluate(st)
        .catch((err) => `unavailable: ${(err as Error).message}`)
        .then((txt) => {
          if (alive) setValues((v) => v.map((x, j) => (j === i ? txt : x)));
        });
    });
    return () => {
      alive = false;
    };
  }, [stats, catalog]);

  if (!stats?.length) return null;
  return (
    <ul className="mb-3 space-y-1">
      {stats.map((st, i) => (
        <li key={st.label} className="flex items-start gap-1.5 text-[11px] text-ocean-text-secondary">
          <Calculator className="w-3 h-3 mt-0.5 text-teal-400 shrink-0" />
          <span>
            <span className="text-ocean-muted">{st.label}: </span>
            <span className="font-mono text-teal-200">{values[i] ?? 'computing…'}</span>
          </span>
        </li>
      ))}
      <li className="text-[9px] text-ocean-muted pl-4">Computed now from the served data (area-weighted box means).</li>
    </ul>
  );
};
