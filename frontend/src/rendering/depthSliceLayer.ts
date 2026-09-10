import * as Cesium from 'cesium';
import { fetchOceanTile, OceanTileData } from '../api/client';
import { renderTileToCanvas, sampleOceanDataAt } from './colormaps';

export interface DepthSliceLayerManager {
  updateSlice: (params: {
    variable: string;
    date: string;
    depth: number;
    palette?: string;
    opacity?: number;
    customRange?: [number, number];
    scaleType?: 'linear' | 'log';
  }) => Promise<void>;
  updateVisibility: (activeLayers: string[]) => void;
  setOpacity: (opacity: number) => void;
  sampleAt: (lon: number, lat: number) => { value: number | null; isLand: boolean };
  getCurrentTileData: () => OceanTileData | null;
  destroy: () => void;
}

// Authentic North Indian Ocean & Arabian Sea / Bay of Bengal bounding box
export const OCEAN_BOUNDS = {
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

/**
 * Creates and manages high-performance 2D/3D depth-slice field rendering
 * draped over the Indian Ocean water column.
 */
export async function createDepthSliceLayer(
  viewer: Cesium.Viewer
): Promise<DepthSliceLayerManager> {
  let currentImageryLayer: Cesium.ImageryLayer | null = null;
  let currentVariable = 'temperature';
  let isLayerVisible = true;
  let currentOpacity = 0.85;
  let currentTileData: OceanTileData | null = null;

  const updateSlice = async (params: {
    variable: string;
    date: string;
    depth: number;
    palette?: string;
    opacity?: number;
    customRange?: [number, number];
    scaleType?: 'linear' | 'log';
  }) => {
    currentVariable = params.variable;
    if (params.opacity !== undefined) {
      currentOpacity = params.opacity;
    }

    try {
      const tileData: OceanTileData = await fetchOceanTile(
        params.variable,
        params.date,
        params.depth
      );
      currentTileData = tileData;

      const canvas = renderTileToCanvas(tileData, {
        palette: params.palette,
        opacity: currentOpacity,
        customRange: params.customRange,
        scaleType: params.scaleType
      });

      const dataUrl = canvas.toDataURL('image/png');

      const provider = await Cesium.SingleTileImageryProvider.fromUrl(dataUrl, {
        rectangle: OCEAN_RECTANGLE
      });

      if (viewer.isDestroyed()) return;

      const newImageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      newImageryLayer.alpha = currentOpacity;
      newImageryLayer.show = isLayerVisible;

      // Ensure depth-slice sits above base satellite map (index 0)
      if (viewer.imageryLayers.length > 2) {
        viewer.imageryLayers.raiseToTop(newImageryLayer);
      }

      // Remove previous depth-slice layer after new one is ready
      if (currentImageryLayer) {
        viewer.imageryLayers.remove(currentImageryLayer, true);
      }
      currentImageryLayer = newImageryLayer;

      console.log(
        `[DepthSliceLayer] Rendered authentic ${params.variable} at depth ${params.depth}m (min: ${tileData.header.minVal.toFixed(2)}, max: ${tileData.header.maxVal.toFixed(2)})`
      );
    } catch (err) {
      console.warn(`[DepthSliceLayer] No authentic data available for ${params.variable} at depth ${params.depth}m (strict no-mock policy):`, err);
      // Cleanly remove any previous imagery layer so stale data is not displayed
      if (currentImageryLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(currentImageryLayer, true);
        currentImageryLayer = null;
      }
      currentTileData = null;
    }
  };

  return {
    updateSlice,
    updateVisibility: (activeLayers: string[]) => {
      isLayerVisible = activeLayers.includes(currentVariable);
      if (currentImageryLayer) {
        currentImageryLayer.show = isLayerVisible;
      }
    },
    setOpacity: (opacity: number) => {
      currentOpacity = opacity;
      if (currentImageryLayer) {
        currentImageryLayer.alpha = opacity;
      }
    },
    sampleAt: (lon: number, lat: number) => {
      if (!currentTileData || !isLayerVisible) {
        return { value: null, isLand: false };
      }
      return sampleOceanDataAt(currentTileData, lon, lat);
    },
    getCurrentTileData: () => currentTileData,
    destroy: () => {
      if (currentImageryLayer && !viewer.isDestroyed()) {
        viewer.imageryLayers.remove(currentImageryLayer, true);
        currentImageryLayer = null;
      }
      currentTileData = null;
    }
  };
}
