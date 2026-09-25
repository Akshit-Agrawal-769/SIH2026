import * as Cesium from 'cesium';
import { dateKey } from '../api/config';

export interface CurrentsSettings {
  speed?: number;
  arrowScale?: number;
}

export type CurrentsStatus =
  | { state: 'hidden' }
  | { state: 'loading' }
  | { state: 'ok'; date: string; count: number }
  | { state: 'nodata' | 'error'; message: string };

export interface CurrentsLayerManager {
  updateDepth: (depth: number) => void;
  updateVisibility: (activeLayers: string[]) => void;
  updateArrowScale: (scale: number) => void;
  updateSettings: (settings: CurrentsSettings) => void;
  updateTime: (date: string) => void;
  destroy: () => void;
}

/** Vector grid produced by scripts/build_authentic_dataset.py (CMEMS ARMOR3D ugo/vgo). */
export interface CurrentsUVData {
  source_id: string;
  units: string;
  date: string;
  depth: number;
  lats: number[];
  lons: number[];
  u: (number | null)[][];
  v: (number | null)[][];
}

let uvPromise: Promise<CurrentsUVData | null> | null = null;
let loadedUV: CurrentsUVData | null = null;

export function loadCurrentsUV(): Promise<CurrentsUVData | null> {
  if (!uvPromise) {
    uvPromise = fetch('/data/currents_uv.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CurrentsUVData | null) => {
        loadedUV = data;
        return data;
      })
      .catch(() => {
        uvPromise = null;
        return null;
      });
  }
  return uvPromise;
}

export interface Velocity {
  u: number | null;
  v: number | null;
  speed: number | null;
  headingDeg: number | null;
  isAvailable: boolean;
  reason?: string;
}

const UNAVAILABLE = (reason: string): Velocity => ({ u: null, v: null, speed: null, headingDeg: null, isAvailable: false, reason });

/**
 * Velocity at the nearest vector grid point (within half a grid spacing). Only the
 * dataset's own date and depth are valid; any other request is reported unavailable.
 */
export function computeOceanVelocity(lon: number, lat: number, depth: number, date: string): Velocity {
  const uv = loadedUV;
  if (!uv) return UNAVAILABLE('current vectors not loaded');
  if (!date || dateKey(date) !== uv.date) return UNAVAILABLE(`current vectors exist only for ${uv.date}`);
  if (Math.abs(depth - uv.depth) > 1e-6) return UNAVAILABLE(`current vectors exist only at ${uv.depth} m`);
  const dLat = uv.lats[1] - uv.lats[0];
  const dLon = uv.lons[1] - uv.lons[0];
  const i = Math.round((lat - uv.lats[0]) / dLat);
  const j = Math.round((lon - uv.lons[0]) / dLon);
  if (i < 0 || j < 0 || i >= uv.lats.length || j >= uv.lons.length) return UNAVAILABLE('outside vector grid');
  const u = uv.u[i]?.[j];
  const v = uv.v[i]?.[j];
  if (u === null || v === null || u === undefined || v === undefined) return UNAVAILABLE('no vector at this location');
  let headingDeg = (Math.atan2(u, v) * 180) / Math.PI; // oceanographic "towards" direction, 0 = north
  if (headingDeg < 0) headingDeg += 360;
  return { u, v, speed: Math.hypot(u, v), headingDeg, isAvailable: true };
}

function arrowTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(32, 6);
  ctx.lineTo(46, 28);
  ctx.lineTo(36, 28);
  ctx.lineTo(36, 58);
  ctx.lineTo(28, 58);
  ctx.lineTo(28, 28);
  ctx.lineTo(18, 28);
  ctx.closePath();
  ctx.fill();
  return canvas.toDataURL('image/png');
}

/** Speed ramp: light grey (slow) -> amber -> red (fast). */
function speedColor(speed: number): Cesium.Color {
  const t = Math.max(0, Math.min(1, speed / 1.0));
  const stops: [number, [number, number, number]][] = [
    [0.0, [212, 212, 212]],
    [0.4, [251, 191, 36]],
    [1.0, [239, 68, 68]]
  ];
  let k = 0;
  while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
  const [t0, c0] = stops[k];
  const [t1, c1] = stops[k + 1];
  const f = (t - t0) / (t1 - t0);
  return Cesium.Color.fromBytes(
    Math.round(c0[0] + f * (c1[0] - c0[0])),
    Math.round(c0[1] + f * (c1[1] - c0[1])),
    Math.round(c0[2] + f * (c1[2] - c0[2]))
  );
}

/**
 * Surface geostrophic current arrows placed on the real vector grid points. Arrows
 * glide along their own (fixed) vector to convey direction; the field itself is static.
 */
export function createCurrentsLayer(viewer: Cesium.Viewer, onStatus?: (s: CurrentsStatus) => void): CurrentsLayerManager {
  const billboards = viewer.scene.primitives.add(new Cesium.BillboardCollection({ scene: viewer.scene })) as Cesium.BillboardCollection;
  billboards.show = false;
  const texture = arrowTexture();

  interface Arrow {
    lon: number;
    lat: number;
    speed: number;
    heading: number;
    phase: number;
    color: Cesium.Color;
    bb: Cesium.Billboard;
    pos: Cesium.Cartesian3;
  }
  const arrows: Arrow[] = [];
  let visibleRequested = false;
  let date = '';
  let depth = 0;
  let arrowScale = 1.0;
  let flowSpeed = 1.0;
  let destroyed = false;

  const build = (uv: CurrentsUVData) => {
    for (let i = 0; i < uv.lats.length; i++) {
      for (let j = 0; j < uv.lons.length; j++) {
        const u = uv.u[i][j];
        const v = uv.v[i][j];
        if (u === null || v === null) continue;
        const speed = Math.hypot(u, v);
        let heading = (Math.atan2(u, v) * 180) / Math.PI;
        if (heading < 0) heading += 360;
        const pos = Cesium.Cartesian3.fromDegrees(uv.lons[j], uv.lats[i], 300);
        const color = speedColor(speed);
        // Align the arrow's "up" with local geographic north so heading stays correct in oblique views.
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
        const north4 = Cesium.Matrix4.getColumn(enu, 1, new Cesium.Cartesian4());
        const north = Cesium.Cartesian3.normalize(new Cesium.Cartesian3(north4.x, north4.y, north4.z), new Cesium.Cartesian3());
        const bb = billboards.add({
          position: pos,
          image: texture,
          width: 18,
          height: 18,
          rotation: -(heading * Math.PI) / 180,
          alignedAxis: north,
          color,
          scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.3, 1.6e7, 0.55),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        });
        // Deterministic stagger (grid position based), not a random value.
        arrows.push({ lon: uv.lons[j], lat: uv.lats[i], speed, heading, phase: ((i * 7 + j * 13) % 20) / 20, color, bb, pos });
      }
    }
  };

  const refresh = () => {
    if (destroyed) return;
    if (!visibleRequested) {
      billboards.show = false;
      onStatus?.({ state: 'hidden' });
      return;
    }
    const uv = loadedUV;
    if (!uv) {
      billboards.show = false;
      onStatus?.({ state: 'loading' });
      return;
    }
    if (dateKey(date) !== uv.date || Math.abs(depth - uv.depth) > 1e-6) {
      billboards.show = false;
      onStatus?.({
        state: 'nodata',
        message: `Current vectors exist only for ${uv.date} at ${uv.depth} m (CMEMS ARMOR3D surface geostrophic). ` +
          `Selected: ${dateKey(date) || '—'} at ${depth} m.`
      });
      return;
    }
    billboards.show = true;
    for (const a of arrows) {
      a.bb.scale = Math.max(0.45, Math.min(1.6, 0.5 + a.speed * 1.4)) * arrowScale;
    }
    onStatus?.({ state: 'ok', date: uv.date, count: arrows.length });
  };

  loadCurrentsUV().then((uv) => {
    if (destroyed) return;
    if (!uv) {
      onStatus?.({ state: 'error', message: 'Current vector file could not be loaded' });
      return;
    }
    build(uv);
    refresh();
  });

  let lastTime = performance.now();
  const scratchColor = new Cesium.Color();
  const onPreRender = () => {
    if (!billboards.show) return;
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    for (const a of arrows) {
      a.phase = (a.phase + dt * 0.35 * flowSpeed) % 1;
      const travel = a.phase * Math.min(0.9, 0.15 + a.speed * 0.6); // degrees along the vector
      const rad = (a.heading * Math.PI) / 180;
      a.bb.position = Cesium.Cartesian3.fromDegrees(a.lon + travel * Math.sin(rad), a.lat + travel * Math.cos(rad), 300,
        Cesium.Ellipsoid.WGS84, a.pos);
      a.bb.color = a.color.withAlpha(Math.sin(a.phase * Math.PI) * 0.9, scratchColor);
    }
  };
  const removePreRender = viewer.scene.preRender.addEventListener(onPreRender);

  return {
    updateDepth: (d) => { depth = d; refresh(); },
    updateTime: (t) => { date = t; refresh(); },
    updateVisibility: (layers) => { visibleRequested = layers.includes('currents'); refresh(); },
    updateArrowScale: (s) => { arrowScale = s; refresh(); },
    updateSettings: (s) => {
      if (s.speed !== undefined) flowSpeed = s.speed;
      if (s.arrowScale !== undefined) arrowScale = s.arrowScale;
      refresh();
    },
    destroy: () => {
      destroyed = true;
      removePreRender();
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(billboards);
      arrows.length = 0;
    }
  };
}
