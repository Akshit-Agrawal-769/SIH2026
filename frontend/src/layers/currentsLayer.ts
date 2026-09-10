import * as Cesium from 'cesium';
import { isLand } from '../rendering/colormaps';
import { TIMESTEPS } from '../config';

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

/**
 * Calculates (u, v) ocean velocity components in m/s at a given lon/lat and depth.
 * Models physical circulation features with realistic vertical depth decay and
 * Ekman spiral shear:
 * - Surface wind-driven layer: Somali Jet, Equatorial Wyrtki Jet, Monsoon Drift & eddies
 * - Thermocline layer (75m - 300m): exponential velocity attenuation with directional shear
 * - Deep abyssal layer (500m - 2000m): slow thermohaline drift and deep boundary currents
 */
export function computeOceanVelocity(
  lon: number,
  lat: number,
  depth: number,
  dateStr: string = TIMESTEPS[0]
): { u: number; v: number; speed: number; headingDeg: number } {
  // Vertical decay curve: rapid drop across pycnocline/thermocline, slow abyssal residual
  const depthDecay = Math.exp(-depth / 140.0);
  const abyssalFloor = 0.035 * Math.exp(-depth / 1500.0);

  // Directional Ekman spiral rotation with depth (up to 40° clockwise in Northern Hemisphere)
  const ekmanRotationDeg = Math.min(45.0, (depth / 200.0) * 35.0) * (lat >= 0 ? 1 : -1);
  const ekmanRotRad = (ekmanRotationDeg * Math.PI) / 180.0;

  let dayIdx = 0;
  try {
    dayIdx = parseInt(dateStr.split('-')[2] || '1', 10) - 1;
    if (isNaN(dayIdx)) dayIdx = 0;
  } catch {
    dayIdx = 0;
  }

  // 1. Somali Current / Western Boundary Jet (along 48°E - 58°E, 0°N - 15°N)
  // Peak surface velocity up to 2.6 m/s, rapidly decaying into intermediate depths
  const somaliPulse = 1.0 + 0.55 * Math.sin(dayIdx * 0.45);
  const somaliDist = Math.hypot(lon - (52.0 + dayIdx * 0.25), lat - 8.5);
  const somaliSpeed = 2.6 * somaliPulse * Math.exp(-(somaliDist * somaliDist) / 50.0) * depthDecay;
  const somaliAngle = 45.0 + 25.0 * Math.sin(dayIdx * 0.4);
  const somaliRad = (somaliAngle * Math.PI) / 180.0;
  const somaliU = somaliSpeed * Math.sin(somaliRad);
  const somaliV = somaliSpeed * Math.cos(somaliRad);

  // 2. Equatorial Wyrtki Jet (intense eastward current along 60°E - 95°E, -3°S - 3°N)
  const eqPulse = 1.0 + 0.35 * Math.cos(dayIdx * 0.38);
  const eqDist = Math.abs(lat - 0.5);
  const eqLonMask = lon >= 55.0 && lon <= 96.0 ? 1.0 : 0.0;
  const eqSpeed = 1.9 * eqPulse * Math.exp(-(eqDist * eqDist) / 8.0) * eqLonMask * depthDecay;
  const eqU = eqSpeed * 0.95;
  const eqV = eqSpeed * 0.35 * Math.sin((lon + dayIdx * 1.5) * 0.2);

  // 3. Monsoon Drift & Swirling Rossby Eddies in Arabian Sea
  const eddyTheta = dayIdx * 0.45;
  const arabianDist = Math.hypot(lon - (65.0 - dayIdx * 0.4), lat - 15.5);
  const arabianSpeed = (1.2 + 0.6 * Math.sin(eddyTheta)) * Math.exp(-(arabianDist * arabianDist) / 65.0) * depthDecay;
  const arabianU = arabianSpeed * Math.cos(eddyTheta + lon * 0.1);
  const arabianV = arabianSpeed * Math.sin(eddyTheta + lat * 0.1);

  // 4. Bay of Bengal Gyre (lat 8..20, lon 80..93)
  const bobTheta = -dayIdx * 0.4;
  const bobDist = Math.hypot(lon - (87.0 - dayIdx * 0.3), lat - (14.0 + dayIdx * 0.15));
  const bobSpeed = (1.0 + 0.45 * Math.cos(bobTheta)) * Math.exp(-(bobDist * bobDist) / 60.0) * depthDecay;
  const bobU = bobSpeed * Math.cos(bobTheta + 0.8);
  const bobV = bobSpeed * Math.sin(bobTheta + 0.8);

  // 5. Background geostrophic drift & abyssal thermohaline motion
  const bgSpeed = (0.35 + 0.2 * Math.sin((lat + dayIdx * 0.4) * 0.2)) * depthDecay + abyssalFloor;
  const bgU = bgSpeed * 0.8;
  const bgV = bgSpeed * 0.6;

  let totalU = somaliU + eqU + arabianU + bobU + bgU;
  let totalV = somaliV + eqV + arabianV + bobV + bgV;

  // Apply Ekman spiral depth rotation
  if (depth > 5.0) {
    const cosR = Math.cos(ekmanRotRad);
    const sinR = Math.sin(ekmanRotRad);
    const rotU = totalU * cosR - totalV * sinR;
    const rotV = totalU * sinR + totalV * cosR;
    totalU = rotU;
    totalV = rotV;
  }

  const totalSpeed = Math.hypot(totalU, totalV);

  // Heading in degrees (0 = North, 90 = East, 180 = South, 270 = West)
  let headingDeg = (Math.atan2(totalU, totalV) * 180.0) / Math.PI;
  if (headingDeg < 0) headingDeg += 360.0;

  return {
    u: totalU,
    v: totalV,
    speed: totalSpeed,
    headingDeg
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
  let currentDate = TIMESTEPS[0];
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
