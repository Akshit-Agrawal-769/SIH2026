import { OceanTileData } from '../api/client';

export type ColormapPalette = 'turbo' | 'viridis' | 'chlorophyll' | 'thermal';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Google Turbo polynomial colormap implementation.
 * Provides high dynamic range and perceptual clarity for ocean surface temperature and anomalies.
 */
export function turboColormap(t: number): RgbColor {
  const x = Math.max(0, Math.min(1, t));
  const r = 0.1357 + x * (4.61539 + x * (-42.6603 + x * (132.131 + x * (-152.942 + x * 59.2864))));
  const g = 0.0914 + x * (-2.19418 + x * (16.4289 + x * (14.6455 + x * (-44.8236 + x * 16.7118))));
  const b = 0.1067 + x * (12.5833 + x * (-30.1604 + x * (18.0097 + x * (11.7584 + x * -12.4338))));

  return {
    r: Math.floor(Math.max(0, Math.min(255, r * 255))),
    g: Math.floor(Math.max(0, Math.min(255, g * 255))),
    b: Math.floor(Math.max(0, Math.min(255, b * 255)))
  };
}

/**
 * Viridis colormap piecewise interpolation.
 * Optimal for salinity fields and density gradients.
 */
const VIRIDIS_STOPS: [number, [number, number, number]][] = [
  [0.0, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5, [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1.0, [253, 231, 37]]
];

export function viridisColormap(t: number): RgbColor {
  return interpolateStops(t, VIRIDIS_STOPS);
}

/**
 * Oceanic Chlorophyll-a palette (phytoplankton photic bloom).
 */
const CHLOROPHYLL_STOPS: [number, [number, number, number]][] = [
  [0.0, [15, 23, 42]],
  [0.2, [14, 116, 144]],
  [0.5, [16, 185, 129]],
  [0.75, [132, 204, 22]],
  [1.0, [250, 204, 21]]
];

export function chlorophyllColormap(t: number): RgbColor {
  return interpolateStops(t, CHLOROPHYLL_STOPS);
}

/**
 * Thermal / Magma palette.
 */
const THERMAL_STOPS: [number, [number, number, number]][] = [
  [0.0, [10, 4, 30]],
  [0.25, [81, 18, 124]],
  [0.5, [182, 54, 121]],
  [0.75, [251, 136, 97]],
  [1.0, [254, 250, 200]]
];

export function thermalColormap(t: number): RgbColor {
  return interpolateStops(t, THERMAL_STOPS);
}

function interpolateStops(t: number, stops: [number, [number, number, number]][]): RgbColor {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      return {
        r: Math.floor(c0[0] + f * (c1[0] - c0[0])),
        g: Math.floor(c0[1] + f * (c1[1] - c0[1])),
        b: Math.floor(c0[2] + f * (c1[2] - c0[2]))
      };
    }
  }
  const last = stops[stops.length - 1][1];
  return { r: last[0], g: last[1], b: last[2] };
}

/**
 * Cool-Warm divergent colormap (blue to white to red).
 */
const COOLWARM_STOPS: [number, [number, number, number]][] = [
  [0.0, [59, 76, 192]],
  [0.25, [141, 175, 240]],
  [0.5, [221, 221, 221]],
  [0.75, [243, 148, 117]],
  [1.0, [180, 4, 38]]
];

export function coolwarmColormap(t: number): RgbColor {
  return interpolateStops(t, COOLWARM_STOPS);
}

export function sampleColormap(t: number, palette: string): RgbColor {
  switch (palette.toLowerCase()) {
    case 'viridis':
      return viridisColormap(t);
    case 'chlorophyll':
      return chlorophyllColormap(t);
    case 'thermal':
    case 'plasma':
    case 'magma':
      return thermalColormap(t);
    case 'coolwarm':
      return coolwarmColormap(t);
    case 'turbo':
    default:
      return turboColormap(t);
  }
}

export const LAND_POLYGONS: [number, number][][] = [
  // India Mainland & Northern Landmass
  [
    [68.0, 30.0], [91.0, 30.0], [91.0, 24.0], [89.8, 22.2], [88.5, 21.6],
    [87.0, 21.4], [85.0, 19.5], [83.3, 17.7], [80.3, 13.1], [79.8, 10.5],
    [78.2, 9.2], [77.5, 8.1], [76.5, 9.5], [75.0, 12.5], [74.0, 14.5],
    [73.5, 16.5], [72.8, 18.9], [72.8, 21.2], [70.0, 21.0], [69.0, 22.4],
    [68.2, 23.8], [68.0, 30.0]
  ],
  // Sri Lanka
  [
    [79.6, 9.8], [81.9, 9.8], [81.9, 5.9], [79.6, 5.9]
  ],
  // Arabian Peninsula & Iran/Pakistan
  [
    [45.0, 30.0], [68.2, 30.0], [68.2, 23.8], [66.5, 25.0], [61.5, 25.2],
    [57.0, 25.5], [56.3, 26.2], [58.5, 23.6], [59.8, 22.5], [58.0, 20.5],
    [54.0, 16.5], [51.0, 12.0], [45.0, 12.5]
  ],
  // Horn of Africa / Somalia / Kenya
  [
    [45.0, 11.5], [51.3, 12.0], [50.0, 8.0], [47.5, 4.0], [45.0, 1.5],
    [45.0, -15.0], [39.0, -15.0], [39.0, 11.5]
  ],
  // Southeast Asia (Myanmar, Thailand, Malaysia)
  [
    [92.5, 30.0], [100.0, 30.0], [100.0, 1.0], [98.5, 3.0], [98.5, 8.0],
    [98.5, 12.0], [96.5, 16.5], [94.5, 16.0], [94.0, 18.0], [92.5, 21.0]
  ],
  // Sumatra
  [
    [95.2, 5.6], [100.0, 1.5], [100.0, -6.0], [97.0, 1.0]
  ]
];

export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  let j = poly.length - 1;
  for (let i = 0; i < poly.length; i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

export function isLand(lon: number, lat: number): boolean {
  for (let i = 0; i < LAND_POLYGONS.length; i++) {
    if (pointInPolygon(lon, lat, LAND_POLYGONS[i])) {
      return true;
    }
  }
  return false;
}

export interface RenderTileOptions {
  palette?: string;
  opacity?: number;
  customRange?: [number, number];
  scaleType?: 'linear' | 'log';
}

/**
 * Converts a Float32Array depth slice into an HTML5 Canvas texture
 * with intelligent land masking (transparent over landmasses),
 * linear or logarithmic scaling, and vibrant scientific colormap gradients.
 */
export function renderTileToCanvas(
  tileData: OceanTileData,
  options: RenderTileOptions = {}
): HTMLCanvasElement {
  const { width, height, minVal, maxVal } = tileData.header;
  const palette = options.palette || (tileData.variable === 'salinity' ? 'viridis' : tileData.variable === 'chlorophyll' ? 'chlorophyll' : 'turbo');
  const opacity = options.opacity !== undefined ? Math.max(0, Math.min(1, options.opacity)) : 0.85;
  const isLog = options.scaleType === 'log';

  const minRange = options.customRange ? options.customRange[0] : minVal;
  const maxRange = options.customRange ? options.customRange[1] : maxVal;
  const rangeDelta = maxRange - minRange > 0.0001 ? maxRange - minRange : 1.0;

  const logMin = Math.log10(Math.max(1e-4, minRange));
  const logMax = Math.log10(Math.max(1e-4, maxRange));
  const logDelta = logMax - logMin > 0.0001 ? logMax - logMin : 1.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  const values = tileData.values;

  // Standard geographic bounding box
  const lonMin = 45.0;
  const lonSpan = 55.0; // 100.0 - 45.0
  const latMin = -15.0;
  const latSpan = 45.0; // 30.0 - (-15.0)

  // Map each pixel: flip latitude so row 0 = North (+30°N)
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const lat = latMin + (srcY / (height - 1)) * latSpan;

    for (let x = 0; x < width; x++) {
      const lon = lonMin + (x / (width - 1)) * lonSpan;
      const srcIdx = srcY * width + x;
      const targetIdx = (y * width + x) * 4;

      // 1. Land Masking: If pixel falls on Indian subcontinent or surrounding land, make 100% transparent!
      if (isLand(lon, lat)) {
        data[targetIdx] = 0;
        data[targetIdx + 1] = 0;
        data[targetIdx + 2] = 0;
        data[targetIdx + 3] = 0;
        continue;
      }

      const rawVal = values[srcIdx];
      if (isNaN(rawVal)) {
        data[targetIdx] = 0;
        data[targetIdx + 1] = 0;
        data[targetIdx + 2] = 0;
        data[targetIdx + 3] = 0;
      } else {
        let norm = 0;
        if (isLog) {
          const logVal = Math.log10(Math.max(1e-4, rawVal));
          norm = Math.max(0, Math.min(1, (logVal - logMin) / logDelta));
        } else {
          norm = Math.max(0, Math.min(1, (rawVal - minRange) / rangeDelta));
        }
        const color = sampleColormap(norm, palette);

        data[targetIdx] = color.r;
        data[targetIdx + 1] = color.g;
        data[targetIdx + 2] = color.b;
        data[targetIdx + 3] = Math.floor(opacity * 255);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Samples the scalar physical ocean value at arbitrary geographic coordinates (lon, lat)
 */
export function sampleOceanDataAt(
  tileData: OceanTileData,
  lon: number,
  lat: number
): { value: number | null; isLand: boolean } {
  if (lon < 45.0 || lon > 100.0 || lat < -15.0 || lat > 30.0) {
    return { value: null, isLand: false };
  }

  if (isLand(lon, lat)) {
    return { value: null, isLand: true };
  }

  const { width, height } = tileData.header;
  const x = Math.round(((lon - 45.0) / 55.0) * (width - 1));
  const y = Math.round(((lat - (-15.0)) / 45.0) * (height - 1));

  if (x < 0 || x >= width || y < 0 || y >= height) {
    return { value: null, isLand: false };
  }

  const idx = y * width + x;
  const val = tileData.values[idx];
  return { value: isNaN(val) ? null : val, isLand: false };
}

