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

    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      for (let x = 0; x < width; x++) {
        const srcIdx = srcY * width + x;
        const targetIdx = (y * width + x) * 4;
        const val = tile.values[srcIdx];

        if (isNaN(val) || val <= 30.5) {
          data[targetIdx] = 0;
          data[targetIdx + 1] = 0;
          data[targetIdx + 2] = 0;
          data[targetIdx + 3] = 0;
        } else {
          // Heatwave threshold exceeded (SST > 30.5°C) -> Glowing Red
          data[targetIdx] = 239; // ef
          data[targetIdx + 1] = 68; // 44
          data[targetIdx + 2] = 68; // 44
          data[targetIdx + 3] = 160;
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

    // Grid resolution
    const dx = 65.0 / (width - 1);
    const dy = 35.0 / (height - 1);

    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const lat = -10.0 + (srcY * dy);
      for (let x = 0; x < width; x++) {
        const srcIdx = srcY * width + x;
        const targetIdx = (y * width + x) * 4;
        const lon = 35.0 + (x * dx);
        const sst = tile.values[srcIdx];

        if (isNaN(sst) || sst <= 26.5 || isLand(lon, lat)) {
          data[targetIdx + 3] = 0;
          continue;
        }

        // Compute vorticity via finite difference (dv/dx - du/dy)
        // Note: Very simplified pseudo-vorticity index based on currents
        const vRight = computeOceanVelocity(lon + dx, lat, 0.5, currentDate);
        const vLeft = computeOceanVelocity(lon - dx, lat, 0.5, currentDate);
        const vUp = computeOceanVelocity(lon, lat + dy, 0.5, currentDate);
        const vDown = computeOceanVelocity(lon, lat - dy, 0.5, currentDate);

        if (!vRight.isAvailable || !vLeft.isAvailable || !vUp.isAvailable || !vDown.isAvailable) {
          data[targetIdx + 3] = 0;
          continue;
        }

        // Cyclonic vorticity threshold (Northern hemisphere: counter-clockwise positive)
        const dv_dx = ((vRight.v || 0) - (vLeft.v || 0)) / (2 * dx);
        const du_dy = ((vUp.u || 0) - (vDown.u || 0)) / (2 * dy);
        const vorticity = dv_dx - du_dy;

        // Arbitrary threshold for significant cyclonic spin
        const cyclonicScore = lat >= 0 ? vorticity : -vorticity; // southern hemisphere cyclonic is clockwise

        if (cyclonicScore > 0.05) {
          // Cyclogenesis Threat Level met -> Amber Warning
          data[targetIdx] = 245; // f5
          data[targetIdx + 1] = 158; // 9e
          data[targetIdx + 2] = 11; // 0b
          data[targetIdx + 3] = Math.min(220, 100 + cyclonicScore * 500);
        } else {
          data[targetIdx + 3] = 0;
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

      for (let hour = 0; hour <= 48; hour++) {
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
          width: 5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.fromCssColorString('#00ffcc')
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
