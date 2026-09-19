import * as Cesium from 'cesium';
import { isLand } from '../rendering/colormaps';

export interface CurrentsSettings {
  speed?: number;
  arrowScale?: number;
}

export interface CurrentsLayerManager {
  updateDepth: (depth: number) => void;
  updateVisibility: (activeLayers: string[]) => void;
  updateArrowScale: (scale: number) => void;
  updateSettings: (settings: CurrentsSettings) => void;
  updateTime: (date: string) => void;
  destroy: () => void;
}

let cachedArrowDataUrl: string | null = null;

/**
 * Generates an ultra-crisp, high-contrast glowing vector arrow texture.
 * Features a streamlined aerodynamic chevron with needle tip, dual inner notch,
 * and a radiant core aura.
 */
function getVectorArrowTexture(): string {
  if (cachedArrowDataUrl) return cachedArrowDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 64;
  const cy = 64;

  // Outer ambient neon glow
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 14;

  // Gradient fill for arrow body
  const grad = ctx.createLinearGradient(cx, cy - 48, cx, cy + 42);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.35, '#d5faff');
  grad.addColorStop(1.0, '#a5f3fc');

  ctx.fillStyle = grad;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(cx, cy - 48);        // Sharp needle tip
  ctx.lineTo(cx + 26, cy - 6);    // Right barb outer tip
  ctx.lineTo(cx + 11, cy - 6);    // Right inner notch
  ctx.lineTo(cx + 10, cy + 44);   // Shaft bottom right
  ctx.lineTo(cx - 10, cy + 44);   // Shaft bottom left
  ctx.lineTo(cx - 11, cy - 6);    // Left inner notch
  ctx.lineTo(cx - 26, cy - 6);    // Left barb outer tip
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Illuminated central core line
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 38);
  ctx.lineTo(cx, cy + 36);
  ctx.stroke();

  cachedArrowDataUrl = canvas.toDataURL('image/png');
  return cachedArrowDataUrl;
}

interface CurrentsUVData {
  lats: number[];
  lons: number[];
  days: string[];
  u: number[][][];
  v: number[][][];
}

let loadedUV: CurrentsUVData | null = null;
if (typeof window !== 'undefined') {
  fetch('/data/currents_uv.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data) {
        loadedUV = data;
        console.log('[CurrentsLayer] Successfully loaded authentic ROMS (u, v) velocity grid.');
      }
    })
    .catch(() => {});
}

/**
 * Calculates (u, v) ocean velocity components in m/s at a given lon/lat and depth.
 * Samples directly from authentic ROMS 3.9 numerical model output when available.
 */
export function computeOceanVelocity(
  lon: number,
  lat: number,
  depth: number,
  dateStr: string = '2024-06-01'
): { u: number | null; v: number | null; speed: number; headingDeg: number; isAvailable: boolean } {
  // Vertical decay curve: rapid drop across pycnocline/thermocline, slow abyssal residual
  const depthDecay = Math.exp(-depth / 140.0);

  // Directional Ekman spiral rotation with depth (up to 40° clockwise in Northern Hemisphere)
  const ekmanRotationDeg = Math.min(45.0, (depth / 200.0) * 35.0) * (lat >= 0 ? 1 : -1);
  const ekmanRotRad = (ekmanRotationDeg * Math.PI) / 180.0;

  let dayIdx = 0;
  try {
    dayIdx = parseInt(dateStr.split('-')[2] || '1', 10) - 1;
    if (isNaN(dayIdx)) dayIdx = 0;
    dayIdx = Math.max(0, Math.min(4, dayIdx));
  } catch {
    dayIdx = 0;
  }

  // 1. Sample from authentic ROMS (u, v) grid if loaded
  if (loadedUV && loadedUV.u && loadedUV.u[dayIdx]) {
    const lats = loadedUV.lats;
    const lons = loadedUV.lons;
    if (lat >= lats[0] && lat <= lats[lats.length - 1] && lon >= lons[0] && lon <= lons[lons.length - 1]) {
      let bestLatIdx = 0;
      let minLatDiff = 999;
      for (let i = 0; i < lats.length; i++) {
        const d = Math.abs(lats[i] - lat);
        if (d < minLatDiff) { minLatDiff = d; bestLatIdx = i; }
      }
      let bestLonIdx = 0;
      let minLonDiff = 999;
      for (let j = 0; j < lons.length; j++) {
        const d = Math.abs(lons[j] - lon);
        if (d < minLonDiff) { minLonDiff = d; bestLonIdx = j; }
      }

      const rawU = loadedUV.u[dayIdx][bestLatIdx]?.[bestLonIdx];
      const rawV = loadedUV.v[dayIdx][bestLatIdx]?.[bestLonIdx];

      if (rawU !== undefined && rawV !== undefined && rawU !== null && rawV !== null && !isNaN(rawU) && !isNaN(rawV)) {
        let romsU = rawU * depthDecay;
        let romsV = rawV * depthDecay;

        if (depth > 5.0) {
          const cosR = Math.cos(ekmanRotRad);
          const sinR = Math.sin(ekmanRotRad);
          const rotU = romsU * cosR - romsV * sinR;
          const rotV = romsU * sinR + romsV * cosR;
          romsU = rotU;
          romsV = rotV;
        }
        const speed = Math.hypot(romsU, romsV);
        let headingDeg = (Math.atan2(romsU, romsV) * 180.0) / Math.PI;
        if (headingDeg < 0) headingDeg += 360.0;
        return { u: romsU, v: romsV, speed, headingDeg, isAvailable: true };
      }
    }
  }

  // ZERO MOCK POLICY: If outside authentic model domain or authentic data is not loaded,
  // do NOT synthesize procedural ocean jets (Somali/Wyrtki/Arabian eddies).
  // Return explicit unavailable state so particles/HUD do not render fabricated velocity.
  return {
    u: null,
    v: null,
    speed: 0,
    headingDeg: 0,
    isAvailable: false
  };
}

/**
 * Creates and manages GPU-instanced 3D vector arrow glyphs representing
 * ocean current velocity fields (u, v) on the 3D Cesium globe with
 * physically grounded depth attenuation, continuous marching flow animation,
 * and responsive scaling.
 */
export function createCurrentsLayer(
  viewer: Cesium.Viewer
): CurrentsLayerManager {
  const billboards = viewer.scene.primitives.add(new Cesium.BillboardCollection({
    scene: viewer.scene
  })) as Cesium.BillboardCollection;

  const arrowTexture = getVectorArrowTexture();
  let isVisible = false;
  let currentDepth = 0.5;
  let currentDate = '2024-06-01';
  let userArrowScale = 1.0;
  let flowSpeedMultiplier = 1.0;

  interface ArrowData {
    baseLon: number;
    baseLat: number;
    phase: number;
    speed: number;
    headingDeg: number;
    posCache: Cesium.Cartesian3;
    billboard: Cesium.Billboard;
  }
  const arrowList: ArrowData[] = [];

  // Subsample grid across North Indian Ocean & EEZ (every 1.75° for rich spatial coverage)
  const lonStart = 46.5;
  const lonEnd = 98.5;
  const lonStep = 1.75;

  const latStart = -13.0;
  const latEnd = 24.5;
  const latStep = 1.75;

  for (let lat = latStart; lat <= latEnd; lat += latStep) {
    for (let lon = lonStart; lon <= lonEnd; lon += lonStep) {
      if (isLand(lon, lat)) continue;

      const pos = Cesium.Cartesian3.fromDegrees(lon, lat, 350);
      const bb = billboards.add({
        position: pos,
        image: arrowTexture,
        width: 26,
        height: 26,
        scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.25, 1.6e7, 0.5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER
      });

      arrowList.push({
        baseLon: lon,
        baseLat: lat,
        phase: Math.random(), // Staggered initial life phases for continuous flow
        speed: 0.5,
        headingDeg: 0,
        posCache: pos,
        billboard: bb
      });
    }
  }

  // Updates velocity values, scales, and rotations when depth, date, or scale changes
  const updateVelocities = () => {
    billboards.show = isVisible;
    if (!isVisible) return;

    for (let i = 0; i < arrowList.length; i++) {
      const arrow = arrowList[i];
      const vel = computeOceanVelocity(arrow.baseLon, arrow.baseLat, currentDepth, currentDate);
      if (!vel.isAvailable) {
        arrow.billboard.show = false;
        arrow.speed = 0;
        continue;
      }

      arrow.billboard.show = isVisible;
      arrow.speed = vel.speed;
      arrow.headingDeg = vel.headingDeg;

      // Update rotation
      const headingRad = (vel.headingDeg * Math.PI) / 180.0;
      arrow.billboard.rotation = -headingRad;

      // Scale proportionally to velocity magnitude and depth layer:
      // Surface (high speed) -> 1.0x to 1.7x; Abyssal depth (slow) -> 0.38x to 0.55x
      const dynamicScale = Math.max(0.35, Math.min(1.75, (vel.speed / 1.05) * 1.1 * userArrowScale));
      arrow.billboard.scale = dynamicScale;
    }
  };

  updateVelocities();

  // 60FPS Continuous Flow Animation Loop on the 3D Globe
  let lastTime = performance.now();
  const onPreRender = () => {
    if (!isVisible || arrowList.length === 0) return;

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000.0, 0.1);
    lastTime = now;

    // Movement speed multiplier: fast at surface, slow at depth
    const flowSpeedMult = 0.65 * flowSpeedMultiplier;

    // Arrow altitude: drops slightly with depth to visually convey subsurface flow
    const altitude = Math.max(120, 380 - (currentDepth / 2000.0) * 220);

    for (let i = 0; i < arrowList.length; i++) {
      const arrow = arrowList[i];
      if (!arrow.billboard.show || arrow.speed <= 0) continue;

      // Physical velocity-dependent animation rate:
      // Surface fast jets advance quickly; deep abyssal currents drift gently
      const speedRate = Math.max(0.04, arrow.speed * 0.9);
      arrow.phase += dt * speedRate * flowSpeedMult;

      if (arrow.phase >= 1.0) {
        arrow.phase -= 1.0;
      }

      // Smooth bell curve alpha for organic birth -> peak -> fade
      const alpha = Math.sin(arrow.phase * Math.PI);

      // Travel distance along heading is proportional to velocity:
      // Fast surface jets stride up to ~1.1 degrees; deep ocean currents advance only 0.08 degrees
      const travelDistanceMax = Math.min(1.2, Math.max(0.08, arrow.speed * 0.75));
      const travelDist = arrow.phase * travelDistanceMax;

      const headingRad = (arrow.headingDeg * Math.PI) / 180.0;
      const curLon = arrow.baseLon + travelDist * Math.sin(headingRad);
      const curLat = arrow.baseLat + travelDist * Math.cos(headingRad);

      if (isLand(curLon, curLat)) {
        arrow.billboard.color = Cesium.Color.TRANSPARENT;
        continue;
      }

      // Update position without heap allocations
      arrow.billboard.position = Cesium.Cartesian3.fromDegrees(
        curLon,
        curLat,
        altitude,
        Cesium.Ellipsoid.WGS84,
        arrow.posCache
      );

      // Dynamic Depth & Speed Color Coding:
      // - Fast surface jets: Radiant Gold
      // - Active monsoon drift: Electric Lime
      // - Moderate surface basins: Electric Cyan
      // - Thermocline shear layer: Cool Sky Blue
      // - Abyssal depth: Calming Translucent Slate / Indigo
      if (arrow.speed > 1.2) {
        arrow.billboard.color = Cesium.Color.fromCssColorString('#ffeb3b').withAlpha(alpha * 0.95);
      } else if (arrow.speed > 0.5) {
        arrow.billboard.color = Cesium.Color.fromCssColorString('#39ff14').withAlpha(alpha * 0.90);
      } else if (arrow.speed > 0.2) {
        arrow.billboard.color = Cesium.Color.fromCssColorString('#00e5ff').withAlpha(alpha * 0.85);
      } else if (arrow.speed > 0.07) {
        arrow.billboard.color = Cesium.Color.fromCssColorString('#38bdf8').withAlpha(alpha * 0.75);
      } else {
        // Deep abyssal flow
        arrow.billboard.color = Cesium.Color.fromCssColorString('#818cf8').withAlpha(alpha * 0.60);
      }
    }
  };

  const removePreRenderListener = viewer.scene.preRender.addEventListener(onPreRender);

  return {
    updateDepth: (depth: number) => {
      currentDepth = depth;
      updateVelocities();
    },
    updateTime: (date: string) => {
      currentDate = date;
      updateVelocities();
    },
    updateVisibility: (activeLayers: string[]) => {
      isVisible = activeLayers.includes('currents');
      updateVelocities();
    },
    updateArrowScale: (scale: number) => {
      userArrowScale = scale;
      updateVelocities();
    },
    updateSettings: (settings: CurrentsSettings) => {
      if (settings.speed !== undefined) flowSpeedMultiplier = settings.speed;
      if (settings.arrowScale !== undefined) userArrowScale = settings.arrowScale;
      updateVelocities();
    },
    destroy: () => {
      removePreRenderListener();
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(billboards);
      }
      arrowList.length = 0;
    }
  };
}
