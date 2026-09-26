import * as Cesium from 'cesium';
import {
  CycloneTrackStorm, DisasterLayerId, DriftResult, EXT_LAYERS, ExtLayerId, MONTHLY_LAYERS, fetchHazardTile, isExtLayer
} from '../api/hazardsClient';
import { NoDataError, OceanTileData } from '../api/client';
import { GRID } from './grid';

/**
 * Disaster Early Warning overlays on the Cesium globe:
 *  - ratio indices (monthly MHW fixed / detrended, chlorophyll bloom, daily MHW) in category colours;
 *  - DHW, TCHP, GPI and the eddy convergence indicators on their own scales;
 *  - drift paths as glowing polylines with the ensemble uncertainty cone (2-sigma ellipses);
 *  - IBTrACS best tracks coloured by intensity.
 * Cells that are NaN in the tile (land / no data / undefined) are fully transparent.
 */

// Hobday et al. (2018) category colours as used by NOAA PSL / marineheatwaves.org.
export const MHW_COLORS: Record<number, [number, number, number]> = {
  1: [255, 200, 102], // Moderate
  2: [255, 105, 0],   // Strong
  3: [158, 0, 0],     // Severe
  4: [45, 0, 0]       // Extreme
};
export const MHW_LABELS: Record<number, string> = { 1: 'Moderate', 2: 'Strong', 3: 'Severe', 4: 'Extreme' };
export const BLOOM_COLORS: Record<number, [number, number, number]> = {
  1: [190, 240, 120], 2: [90, 200, 60], 3: [20, 140, 40], 4: [0, 80, 30]
};
export const BLOOM_LABELS: Record<number, string> = { 1: 'Elevated', 2: 'High', 3: 'Very high', 4: 'Extreme' };
// NOAA Coral Reef Watch DHW style: yellow -> orange -> red -> dark red
export const DHW_STOPS: [number, [number, number, number]][] = [
  [0.5, [255, 240, 120]], [4, [255, 150, 0]], [8, [220, 0, 0]], [12, [120, 0, 0]]
];
export const DRIFT_COLORS = { forward: '#39FF14', reverse: '#FF00FF' } as const;
/** Saffir-Simpson-like colours by maximum sustained wind (kt). */
export const TRACK_BANDS: [number, string, string][] = [
  [0, '#5ebaff', '< 34 kt (depression)'],
  [34, '#00faf4', '34-63 kt (cyclonic storm)'],
  [64, '#ffffcc', '64-82 kt'],
  [83, '#ffe775', '83-95 kt'],
  [96, '#ffc140', '96-112 kt'],
  [113, '#ff8f20', '113-136 kt'],
  [137, '#ff6060', '>= 137 kt']
];

export interface HazardStatus {
  layer: DisasterLayerId;
  state: 'loading' | 'ok' | 'nodata' | 'error';
  message?: string;
}

export interface HazardLayersManager {
  update: (active: DisasterLayerId[], monthlyDate: string | null, extDates: Partial<Record<ExtLayerId, string>>) => void;
  setDrift: (result: DriftResult | null) => void;
  setTracks: (storms: CycloneTrackStorm[] | null) => void;
  destroy: () => void;
}

function ramp(stops: [number, [number, number, number]][], v: number): [number, number, number] {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      return [0, 1, 2].map((k) => Math.round(ca[k] + t * (cb[k] - ca[k]))) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

export const TCHP_STOPS: [number, [number, number, number]][] = [
  [20, [60, 60, 160]], [50, [255, 200, 0]], [90, [255, 90, 0]], [130, [200, 0, 60]]
];
export const GPI_STOPS: [number, [number, number, number]][] = [
  [0.5, [80, 60, 160]], [2, [150, 70, 200]], [5, [230, 90, 200]], [10, [255, 200, 240]]
];

function colourFor(layer: DisasterLayerId, v: number): [number, number, number, number] | null {
  if (!Number.isFinite(v)) return null;
  switch (layer) {
    case 'mhw_intensity':
    case 'mhw_detrended':
    case 'mhw_daily': {
      if (v < 1) return null;
      const [r, g, b] = MHW_COLORS[Math.min(4, Math.floor(v))];
      return [r, g, b, 190];
    }
    case 'chl_bloom': {
      if (v < 1) return null;
      const [r, g, b] = BLOOM_COLORS[Math.min(4, Math.floor(v))];
      return [r, g, b, 190];
    }
    case 'dhw': {
      if (v < 0.5) return null;
      const [r, g, b] = ramp(DHW_STOPS, v);
      return [r, g, b, Math.round(110 + Math.min(1, v / 8) * 110)];
    }
    case 'tchp': {
      if (v < 20) return null;
      const [r, g, b] = ramp(TCHP_STOPS, v);
      return [r, g, b, v >= 50 ? 200 : 110];
    }
    case 'gpi': {
      if (v < 0.5) return null;
      const [r, g, b] = ramp(GPI_STOPS, v);
      return [r, g, b, Math.round(100 + Math.min(1, v / 5) * 110)];
    }
    default: {
      if (v <= 0) return null;
      const t = Math.min(1, v / 100);
      // amber (255,191,0) -> deep orange (255,94,0); opacity grows with the indicator
      return [255, Math.round(191 - 97 * t), 0, Math.round(70 + 150 * t)];
    }
  }
}

function renderTile(layer: DisasterLayerId, tile: OceanTileData): HTMLCanvasElement {
  const { width: w, height: h } = tile.header;
  const base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  const bctx = base.getContext('2d')!;
  const img = bctx.createImageData(w, h);
  for (let row = 0; row < h; row++) {
    const y = h - 1 - row; // tile row 0 is the southernmost latitude
    for (let col = 0; col < w; col++) {
      const c = colourFor(layer, tile.values[row * w + col]);
      if (!c) continue;
      const o = (y * w + col) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = c[3];
    }
  }
  bctx.putImageData(img, 0, 0);

  // Upscale crisp, then add a soft additive glow pass so small regions stay visible on the dark globe.
  const scale = 3;
  const out = document.createElement('canvas');
  out.width = w * scale;
  out.height = h * scale;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.filter = 'blur(6px)';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(base, 0, 0, out.width, out.height);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(base, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'source-over';
  return out;
}

export function trackColour(windKt: number | null): string {
  if (windKt === null || !Number.isFinite(windKt)) return '#8899aa';
  let c = TRACK_BANDS[0][1];
  for (const [lo, col] of TRACK_BANDS) if (windKt >= lo) c = col;
  return c;
}

export function createHazardLayers(viewer: Cesium.Viewer, onStatus?: (s: HazardStatus) => void): HazardLayersManager {
  const LAYERS: DisasterLayerId[] = [...MONTHLY_LAYERS, ...EXT_LAYERS];
  const imagery = new Map<DisasterLayerId, Cesium.ImageryLayer>();
  const keys = new Map<DisasterLayerId, string>();
  const seq = new Map<DisasterLayerId, number>();
  let driftEntities: Cesium.Entity[] = [];
  let trackCollection: Cesium.PolylineCollection | null = null;
  let trackPoints: Cesium.PointPrimitiveCollection | null = null;

  const remove = (layer: DisasterLayerId) => {
    const l = imagery.get(layer);
    if (l && !viewer.isDestroyed()) viewer.imageryLayers.remove(l, true);
    imagery.delete(layer);
    keys.delete(layer);
  };

  const show = async (layer: DisasterLayerId, date: string) => {
    const key = `${layer}|${date}`;
    if (keys.get(layer) === key) return;
    keys.set(layer, key);
    const n = (seq.get(layer) ?? 0) + 1;
    seq.set(layer, n);
    onStatus?.({ layer, state: 'loading' });
    try {
      const tile = await fetchHazardTile(layer, date);
      if (seq.get(layer) !== n || viewer.isDestroyed()) return;
      const canvas = renderTile(layer, tile);
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'), {
        rectangle: Cesium.Rectangle.fromDegrees(...GRID.bbox)
      });
      if (seq.get(layer) !== n || viewer.isDestroyed()) return;
      const il = viewer.imageryLayers.addImageryProvider(provider);
      il.alpha = 0.8;
      viewer.imageryLayers.raiseToTop(il);
      const old = imagery.get(layer);
      if (old) viewer.imageryLayers.remove(old, true);
      imagery.set(layer, il);
      onStatus?.({ layer, state: 'ok' });
    } catch (err) {
      if (seq.get(layer) !== n) return;
      remove(layer);
      onStatus?.({ layer, state: err instanceof NoDataError ? 'nodata' : 'error', message: (err as Error).message });
    }
  };

  const clearDrift = () => {
    for (const e of driftEntities) viewer.entities.remove(e);
    driftEntities = [];
  };

  const clearTracks = () => {
    if (trackCollection && !viewer.isDestroyed()) viewer.scene.primitives.remove(trackCollection);
    if (trackPoints && !viewer.isDestroyed()) viewer.scene.primitives.remove(trackPoints);
    trackCollection = null;
    trackPoints = null;
  };

  return {
    update: (active, monthlyDate, extDates) => {
      for (const layer of LAYERS) {
        const date = isExtLayer(layer) ? extDates[layer] ?? null : monthlyDate;
        if (active.includes(layer) && date) void show(layer, date);
        else {
          seq.set(layer, (seq.get(layer) ?? 0) + 1);
          remove(layer);
        }
      }
    },
    setDrift: (result) => {
      clearDrift();
      if (!result || result.path.length < 2 || viewer.isDestroyed()) return;
      const color = Cesium.Color.fromCssColorString(DRIFT_COLORS[result.mode]);
      // uncertainty cone: 2-sigma ellipses of the ensemble at 6/12/24/48/72 h ...
      for (const c of result.cone ?? []) {
        if (c.ellipse.length < 3) continue;
        driftEntities.push(viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(c.ellipse.flatMap(([la, lo]) => [lo, la]))),
            material: color.withAlpha(0.08),
            outline: false,
            height: 0
          },
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([...c.ellipse, c.ellipse[0]].flatMap(([la, lo]) => [lo, la])),
            width: 1.5,
            material: color.withAlpha(0.55)
          }
        }));
      }
      for (const [la, lo] of result.members_end ?? []) {
        driftEntities.push(viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lo, la),
          point: { pixelSize: 3, color: color.withAlpha(0.7) }
        }));
      }
      const positions = Cesium.Cartesian3.fromDegreesArray(result.path.flatMap((p) => [p.lon, p.lat]));
      driftEntities.push(viewer.entities.add({
        polyline: {
          positions,
          width: 10,
          arcType: Cesium.ArcType.RHUMB,
          material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.25, taperPower: 1, color })
        }
      }));
      const last = result.path[result.path.length - 1];
      const tail = result.path[Math.max(0, result.path.length - 3)];
      driftEntities.push(viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([tail.lon, tail.lat, last.lon, last.lat]),
          width: 16,
          arcType: Cesium.ArcType.RHUMB,
          material: new Cesium.PolylineArrowMaterialProperty(color)
        }
      }));
      const marker = (lat: number, lon: number, text: string) =>
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: { pixelSize: 9, color, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
          label: {
            text, font: '12px sans-serif', fillColor: color, showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.6), pixelOffset: new Cesium.Cartesian2(0, -18),
            style: Cesium.LabelStyle.FILL
          }
        });
      const hrs = result.hours_simulated.toFixed(0);
      const tag = result.engine === 'geostrophic' ? ' (geostrophic only)' : ' (central run)';
      if (result.mode === 'forward') {
        driftEntities.push(marker(result.start.lat, result.start.lon, 'Release point'));
        driftEntities.push(marker(last.lat, last.lon, `+${hrs} h${tag}`));
      } else {
        driftEntities.push(marker(result.start.lat, result.start.lon, 'Last known position'));
        driftEntities.push(marker(last.lat, last.lon, `−${hrs} h probable origin${tag}`));
      }
    },
    setTracks: (storms) => {
      clearTracks();
      if (!storms || !storms.length || viewer.isDestroyed()) return;
      trackCollection = viewer.scene.primitives.add(new Cesium.PolylineCollection());
      trackPoints = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
      for (const st of storms) {
        const pts = st.points;
        // one short polyline per segment so each carries the colour of its intensity
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          trackCollection!.add({
            positions: Cesium.Cartesian3.fromDegreesArray([a[2], a[1], b[2], b[1]]),
            width: 2,
            material: Cesium.Material.fromType('Color', {
              color: Cesium.Color.fromCssColorString(trackColour(b[3])).withAlpha(0.85)
            })
          });
        }
        const g = st.genesis;
        trackPoints!.add({
          position: Cesium.Cartesian3.fromDegrees(g.lon, g.lat),
          pixelSize: 5,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1
        });
      }
    },
    destroy: () => {
      for (const layer of LAYERS) remove(layer);
      clearDrift();
      clearTracks();
    }
  };
}
