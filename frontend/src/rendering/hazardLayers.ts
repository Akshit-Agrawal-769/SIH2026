import * as Cesium from 'cesium';
import { DisasterLayerId, DriftResult, fetchHazardTile } from '../api/hazardsClient';
import { NoDataError, OceanTileData } from '../api/client';
import { GRID } from './grid';

/**
 * Disaster Early Warning overlays on the Cesium globe:
 *  - MHW index (Hobday category colours) and the warm-water & eddy convergence indicator
 *    (amber->orange by indicator value) as semi-transparent, glow-softened imagery layers;
 *  - drift paths as glowing polylines (neon green forward, magenta reverse).
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
export const DRIFT_COLORS = { forward: '#39FF14', reverse: '#FF00FF' } as const;

export interface HazardStatus {
  layer: DisasterLayerId;
  state: 'loading' | 'ok' | 'nodata' | 'error';
  message?: string;
}

export interface HazardLayersManager {
  update: (active: DisasterLayerId[], date: string | null) => void;
  setDrift: (result: DriftResult | null) => void;
  destroy: () => void;
}

function colourFor(layer: DisasterLayerId, v: number): [number, number, number, number] | null {
  if (!Number.isFinite(v)) return null;
  if (layer === 'mhw_intensity') {
    if (v < 1) return null;
    const cat = Math.min(4, Math.floor(v));
    const [r, g, b] = MHW_COLORS[cat];
    return [r, g, b, 190];
  }
  if (v <= 0) return null;
  const t = Math.min(1, v / 100);
  // amber (255,191,0) -> deep orange (255,94,0); opacity grows with the indicator
  return [255, Math.round(191 - 97 * t), 0, Math.round(70 + 150 * t)];
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

export function createHazardLayers(viewer: Cesium.Viewer, onStatus?: (s: HazardStatus) => void): HazardLayersManager {
  const LAYERS: DisasterLayerId[] = ['mhw_intensity', 'eddy_convergence'];
  const imagery = new Map<DisasterLayerId, Cesium.ImageryLayer>();
  const keys = new Map<DisasterLayerId, string>();
  const seq = new Map<DisasterLayerId, number>();
  let driftEntities: Cesium.Entity[] = [];

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

  return {
    update: (active, date) => {
      for (const layer of LAYERS) {
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
      if (result.mode === 'forward') {
        driftEntities.push(marker(result.start.lat, result.start.lon, 'Release point'));
        driftEntities.push(marker(last.lat, last.lon, `+${hrs} h (geostrophic only)`));
      } else {
        driftEntities.push(marker(result.start.lat, result.start.lon, 'Last known position'));
        driftEntities.push(marker(last.lat, last.lon, `−${hrs} h probable origin (geostrophic only)`));
      }
    },
    destroy: () => {
      for (const layer of LAYERS) remove(layer);
      clearDrift();
    }
  };
}
