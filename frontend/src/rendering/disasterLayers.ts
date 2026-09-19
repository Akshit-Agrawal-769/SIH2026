import * as Cesium from 'cesium';
import { fetchOceanTile, OceanTileData } from '../api/client';
import { isLand } from './colormaps';
import { computeOceanVelocity } from '../layers/currentsLayer';

const OCEAN_BOUNDS = {
  west: 35.0,
  south: -10.0,
  east: 100.0,
  north: 25.0
};
const OCEAN_RECTANGLE = Cesium.Rectangle.fromDegrees(
  OCEAN_BOUNDS.west,
  OCEAN_BOUNDS.south,
  OCEAN_BOUNDS.east,
  OCEAN_BOUNDS.north
);

export interface DisasterLayersManager {
  updateVisibility: (activeLayers: string[]) => void;
  updateTime: (date: string) => void;
  simulateDrift: (lon: number, lat: number) => void;
  clearDrift: () => void;
  destroy: () => void;
}

export async function createDisasterLayers(viewer: Cesium.Viewer): Promise<DisasterLayersManager> {
  let heatwaveImageryLayer: Cesium.ImageryLayer | null = null;
  let cyclogenesisImageryLayer: Cesium.ImageryLayer | null = null;
  let driftEntity: Cesium.Entity | null = null;
  let currentDate = '2024-06-01';

  let sstTileData: OceanTileData | null = null;

  async function loadSSTData() {
    try {
      sstTileData = await fetchOceanTile('temperature', currentDate, 0.5);
    } catch (e) {
      console.warn('Failed to load SST for disaster layers', e);
      sstTileData = null;
    }
  }

  function renderHeatwaveCanvas(tile: OceanTileData): HTMLCanvasElement {
    const { width, height } = tile.header;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Pass 1: Calculate Mean and StdDev
    let sum = 0;
    let count = 0;
    for (let i = 0; i < tile.values.length; i++) {
      const val = tile.values[i];
      if (!isNaN(val)) {
        sum += val;
        count++;
      }
    }

    if (count === 0) return canvas;

    const mean = sum / count;
    let varianceSum = 0;
    for (let i = 0; i < tile.values.length; i++) {
      const val = tile.values[i];
      if (!isNaN(val)) {
        varianceSum += Math.pow(val - mean, 2);
      }
    }
    const stdDev = Math.sqrt(varianceSum / count);
    const threshold = mean + 1.5 * stdDev;

    // Pass 2: Render Statistical Anomaly
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      for (let x = 0; x < width; x++) {
        const srcIdx = srcY * width + x;
        const targetIdx = (y * width + x) * 4;
        const val = tile.values[srcIdx];

        if (isNaN(val) || val <= threshold) {
          data[targetIdx + 3] = 0;
        } else {
          // Statistical anomaly (Z-score > 1.5) -> Glowing Red
          data[targetIdx] = 255; 
          data[targetIdx + 1] = 20; 
          data[targetIdx + 2] = 50; 
          data[targetIdx + 3] = 200; 
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function renderCyclogenesisCanvas(tile: OceanTileData): HTMLCanvasElement {
    const { width, height } = tile.header;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const dx = 65.0 / (width - 1);
    const dy = 35.0 / (height - 1);

    // Pass 1: Calculate curl and track maxCurl
    let maxCurl = 0;
    const curlArray = new Float32Array(width * height);
    curlArray.fill(0);

    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const lat = -10.0 + (srcY * dy);
      
      for (let x = 0; x < width; x++) {
        const srcIdx = srcY * width + x;
        const lon = 35.0 + (x * dx);
        const sst = tile.values[srcIdx];

        if (isNaN(sst) || isLand(lon, lat)) {
          continue;
        }

        const vRight = computeOceanVelocity(lon + dx, lat, 0.5, currentDate);
        const vLeft = computeOceanVelocity(lon - dx, lat, 0.5, currentDate);
        const vUp = computeOceanVelocity(lon, lat + dy, 0.5, currentDate);
        const vDown = computeOceanVelocity(lon, lat - dy, 0.5, currentDate);

        if (!vRight.isAvailable || !vLeft.isAvailable || !vUp.isAvailable || !vDown.isAvailable) {
          continue;
        }

        const dv_dx = ((vRight.v || 0) - (vLeft.v || 0)) / (2 * dx);
        const du_dy = ((vUp.u || 0) - (vDown.u || 0)) / (2 * dy);
        const vorticity = dv_dx - du_dy;

        const cyclonicScore = lat >= 0 ? vorticity : -vorticity;
        
        if (cyclonicScore > 0) {
           curlArray[srcIdx] = cyclonicScore;
           if (cyclonicScore > maxCurl) {
             maxCurl = cyclonicScore;
           }
        }
      }
    }

    const curlThreshold = maxCurl * 0.85;

    // Pass 2: Render Top 15% Curl
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      for (let x = 0; x < width; x++) {
        const srcIdx = srcY * width + x;
        const targetIdx = (y * width + x) * 4;
        const score = curlArray[srcIdx];

        if (score === 0 || score <= curlThreshold || maxCurl === 0) {
          data[targetIdx + 3] = 0;
        } else {
          // Top 15% rotational intensity -> Solid Amber
          data[targetIdx] = 245; 
          data[targetIdx + 1] = 158; 
          data[targetIdx + 2] = 11; 
          data[targetIdx + 3] = 200; 
        }
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  async function syncLayers(activeLayers: string[]) {
    const showHeatwave = activeLayers.includes('heatwave');
    const showCyclogenesis = activeLayers.includes('cyclogenesis');

    if (showHeatwave || showCyclogenesis) {
      if (!sstTileData) await loadSSTData();
    }

    // Heatwave Layer
    if (showHeatwave && sstTileData) {
      if (!heatwaveImageryLayer) {
        const canvas = renderHeatwaveCanvas(sstTileData);
        const dataUrl = canvas.toDataURL('image/png');
        const provider = await Cesium.SingleTileImageryProvider.fromUrl(dataUrl, { rectangle: OCEAN_RECTANGLE });
        if (!viewer.isDestroyed()) {
          heatwaveImageryLayer = viewer.imageryLayers.addImageryProvider(provider);
          heatwaveImageryLayer.alpha = 0.8;
        }
      }
      if (heatwaveImageryLayer) heatwaveImageryLayer.show = true;
    } else {
      if (heatwaveImageryLayer) heatwaveImageryLayer.show = false;
    }

    // Cyclogenesis Layer
    if (showCyclogenesis && sstTileData) {
      if (!cyclogenesisImageryLayer) {
        const canvas = renderCyclogenesisCanvas(sstTileData);
        const dataUrl = canvas.toDataURL('image/png');
        const provider = await Cesium.SingleTileImageryProvider.fromUrl(dataUrl, { rectangle: OCEAN_RECTANGLE });
        if (!viewer.isDestroyed()) {
          cyclogenesisImageryLayer = viewer.imageryLayers.addImageryProvider(provider);
          cyclogenesisImageryLayer.alpha = 0.9;
        }
      }
      if (cyclogenesisImageryLayer) cyclogenesisImageryLayer.show = true;
    } else {
      if (cyclogenesisImageryLayer) cyclogenesisImageryLayer.show = false;
    }
  }

  const manager: DisasterLayersManager = {
    updateVisibility: (activeLayers) => {
      syncLayers(activeLayers);
    },
    updateTime: async (date) => {
      if (currentDate === date) return;
      currentDate = date;
      // Invalidate layers
      if (heatwaveImageryLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(heatwaveImageryLayer, true);
        heatwaveImageryLayer = null;
      }
      if (cyclogenesisImageryLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(cyclogenesisImageryLayer, true);
        cyclogenesisImageryLayer = null;
      }
      sstTileData = null; // force reload
      // A caller will call updateVisibility right after time update
    },
    simulateDrift: (lon, lat) => {
      if (driftEntity) {
        viewer.entities.remove(driftEntity);
        driftEntity = null;
      }

      // Euler Integration for 48 hours
      // Time step = 1 hour (3600 seconds)
      const positions = [];
      let currentLon = lon;
      let currentLat = lat;
      const dt = 3600; 
      const earthRadius = 6371000;

      // Increased to 14 days (336 hours) for demo visibility
      for (let hour = 0; hour <= 336; hour++) {
        positions.push(Cesium.Cartesian3.fromDegrees(currentLon, currentLat, 10));
        
        const vel = computeOceanVelocity(currentLon, currentLat, 0.5, currentDate);
        if (!vel.isAvailable || isLand(currentLon, currentLat)) {
          break; // Hit land or out of bounds
        }

        // Convert u,v (m/s) to degrees offset
        const dLat = (vel.v! * dt) / earthRadius;
        const dLon = (vel.u! * dt) / (earthRadius * Math.cos((currentLat * Math.PI) / 180));

        currentLat += (dLat * 180) / Math.PI;
        currentLon += (dLon * 180) / Math.PI;
      }

      driftEntity = viewer.entities.add({
        polyline: {
          positions: positions,
          width: 8,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            taperPower: 0.2,
            color: Cesium.Color.CYAN
          }),
          clampToGround: true
        }
      });
    },
    clearDrift: () => {
      if (driftEntity) {
        viewer.entities.remove(driftEntity);
        driftEntity = null;
      }
    },
    destroy: () => {
      if (heatwaveImageryLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(heatwaveImageryLayer, true);
      }
      if (cyclogenesisImageryLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(cyclogenesisImageryLayer, true);
      }
      if (driftEntity && !viewer.isDestroyed()) {
        viewer.entities.remove(driftEntity);
      }
    }
  };

  return manager;
}
