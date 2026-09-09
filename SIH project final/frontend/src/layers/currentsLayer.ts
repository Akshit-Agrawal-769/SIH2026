import * as Cesium from 'cesium';
import { isLand } from '../rendering/colormaps';

export interface CurrentsLayerManager {
  updateDepth: (depth: number) => void;
  updateVisibility: (activeLayers: string[]) => void;
  updateArrowScale: (scale: number) => void;
  updateTime: (date: string) => void;
  destroy: () => void;
}

let cachedArrowDataUrl: string | null = null;

/**
 * Generates a sleek, high-contrast cyan/lime glowing vector arrow texture.
 */
function getVectorArrowTexture(): string {
  if (cachedArrowDataUrl) return cachedArrowDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 32;
  const cy = 32;

  // Outer glow
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 8;

  // Arrow path pointing UP (0 radians = North)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);        // Arrow tip
  ctx.lineTo(cx + 12, cy - 4);     // Right barb
  ctx.lineTo(cx + 5, cy - 4);      // Right inner notch
  ctx.lineTo(cx + 5, cy + 20);     // Shaft bottom right
  ctx.lineTo(cx - 5, cy + 20);     // Shaft bottom left
  ctx.lineTo(cx - 5, cy - 4);      // Left inner notch
  ctx.lineTo(cx - 12, cy - 4);     // Left barb
  ctx.closePath();
  ctx.fill();

  cachedArrowDataUrl = canvas.toDataURL('image/png');
  return cachedArrowDataUrl;
}

/**
 * Calculates (u, v) ocean velocity components in m/s at a given lon/lat and depth.
 * Models real physical circulation features with day-over-day monsoonal dynamics:
 * - Somali Jet (pulsating with monsoonal wind stress)
 * - Equatorial Wyrtki Jet (intense eastward equatorial pulse)
 * - Southwest Monsoon Drift and Rossby mesoscale eddy advection
 */
export function computeOceanVelocity(
  lon: number,
  lat: number,
  depth: number,
  dateStr: string = '2024-06-01'
): { u: number; v: number; speed: number; headingDeg: number } {
  const depthDecay = Math.exp(-depth / 150.0);
  let dayIdx = 0;
  try {
    dayIdx = parseInt(dateStr.split('-')[2] || '1', 10) - 1;
    if (isNaN(dayIdx)) dayIdx = 0;
  } catch {
    dayIdx = 0;
  }

  // 1. Somali Current / Western Boundary Jet (along 48°E - 58°E, 0°N - 15°N)
  // Powerful monsoonal surge & Great Whirl rotation
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
  // Rotate velocity direction with eddy spin:
  const arabianU = arabianSpeed * Math.cos(eddyTheta + lon * 0.1);
  const arabianV = arabianSpeed * Math.sin(eddyTheta + lat * 0.1);

  // 4. Bay of Bengal Gyre (lat 8..20, lon 80..93)
  const bobTheta = -dayIdx * 0.4;
  const bobDist = Math.hypot(lon - (87.0 - dayIdx * 0.3), lat - (14.0 + dayIdx * 0.15));
  const bobSpeed = (1.0 + 0.45 * Math.cos(bobTheta)) * Math.exp(-(bobDist * bobDist) / 60.0) * depthDecay;
  const bobU = bobSpeed * Math.cos(bobTheta + 0.8);
  const bobV = bobSpeed * Math.sin(bobTheta + 0.8);

  // Background geostrophic drift
  const bgSpeed = (0.35 + 0.2 * Math.sin((lat + dayIdx * 0.4) * 0.2)) * depthDecay;
  const bgU = bgSpeed * 0.8;
  const bgV = bgSpeed * 0.6;

  const totalU = somaliU + eqU + arabianU + bobU + bgU;
  const totalV = somaliV + eqV + arabianV + bobV + bgV;
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
 * Creates and manages GPU-instanced vector arrow glyphs representing
 * ocean current velocity fields (u, v) on the 3D Cesium globe with
 * continuous real-time streamline flow animation.
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

  // Subsample grid across North Indian Ocean & EEZ (every 1.6° lon/lat for rich continuous streamlines)
  const lonStart = 46.5;
  const lonEnd = 98.5;
  const lonStep = 1.6;

  const latStart = -13.0;
  const latEnd = 24.5;
  const latStep = 1.6;

  for (let lat = latStart; lat <= latEnd; lat += latStep) {
    for (let lon = lonStart; lon <= lonEnd; lon += lonStep) {
      // Omit land coordinates
      if (isLand(lon, lat)) continue;

      const pos = Cesium.Cartesian3.fromDegrees(lon, lat, 350); // 350m above surface
      const bb = billboards.add({
        position: pos,
        image: arrowTexture,
        width: 26,
        height: 26,
        scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.25, 1.6e7, 0.55),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER
      });

      arrowList.push({
        baseLon: lon,
        baseLat: lat,
        phase: Math.random(), // Staggered initial life phases so arrows march continuously
        speed: 0.5,
        headingDeg: 0,
        posCache: pos,
        billboard: bb
      });
    }
  }

  // Updates velocity values when depth, date, or visibility changes
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

      // Scale proportionally to velocity magnitude (0.4x to 1.7x)
      const dynamicScale = Math.max(0.4, Math.min(1.7, (vel.speed / 1.1) * 1.05 * userArrowScale));
      arrow.billboard.scale = dynamicScale;
    }
  };

  updateVelocities();

  // 60FPS Continuous Flow Animation Loop
  let lastTime = performance.now();
  const onPreRender = () => {
    if (!isVisible || arrowList.length === 0) return;

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000.0, 0.1);
    lastTime = now;

    // Movement speed multiplier: fast enough to be clearly seen, silky smooth
    const flowSpeedMult = 0.65;

    for (let i = 0; i < arrowList.length; i++) {
      const arrow = arrowList[i];
      // Faster currents advance faster along their streamline
      const speedRate = Math.max(0.35, arrow.speed * 0.95);
      arrow.phase += dt * speedRate * flowSpeedMult;

      if (arrow.phase >= 1.0) {
        arrow.phase -= 1.0;
      }

      // Smooth bell curve alpha for birth -> peak -> fade
      const alpha = Math.sin(arrow.phase * Math.PI);

      // Travel along heading: max travel radius is ~1.5 degrees
      const travelDist = arrow.phase * 1.5;
      const headingRad = (arrow.headingDeg * Math.PI) / 180.0;
      // Heading 0 = North (lat+), 90 = East (lon+), 180 = South (lat-), 270 = West (lon-)
      const curLon = arrow.baseLon + travelDist * Math.sin(headingRad);
      const curLat = arrow.baseLat + travelDist * Math.cos(headingRad);

      if (isLand(curLon, curLat)) {
        arrow.billboard.color = Cesium.Color.TRANSPARENT;
        continue;
      }

      // Update position without heap allocation
      arrow.billboard.position = Cesium.Cartesian3.fromDegrees(
        curLon,
        curLat,
        350,
        Cesium.Ellipsoid.WGS84,
        arrow.posCache
      );

      // Color coding with dynamic pulsing alpha
      if (arrow.speed > 1.2) {
        // High-speed jet: Radiant Gold
        arrow.billboard.color = Cesium.Color.fromCssColorString('#ffeb3b').withAlpha(alpha * 0.95);
      } else if (arrow.speed > 0.6) {
        // Moderate monsoon drift: Neon Lime
        arrow.billboard.color = Cesium.Color.fromCssColorString('#39ff14').withAlpha(alpha * 0.9);
      } else {
        // Calm ocean current: Electric Cyan
        arrow.billboard.color = Cesium.Color.fromCssColorString('#00e5ff').withAlpha(alpha * 0.85);
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
    destroy: () => {
      removePreRenderListener();
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(billboards);
      }
      arrowList.length = 0;
    }
  };
}
