import * as Cesium from 'cesium';
import { fetchOceanTile, NoDataError, OceanTileData } from '../api/client';
import { renderTileToCanvas, sampleOceanDataAt } from './colormaps';
import { GRID } from './grid';

export interface SliceParams {
  variable: string;
  date: string;
  depth: number;
  palette?: string;
  opacity?: number;
  customRange?: [number, number];
  scaleType?: 'linear' | 'log';
}

export type SliceStatus =
  | { state: 'loading' }
  | { state: 'ok'; variable: string; date: string; depth: number }
  | { state: 'nodata' | 'error'; message: string };

export interface DepthSliceLayerManager {
  updateSlice: (params: SliceParams) => Promise<void>;
  updateVisibility: (activeLayers: string[]) => void;
  setOpacity: (opacity: number) => void;
  sampleAt: (lon: number, lat: number) => { value: number | null; isLand: boolean };
  getCurrentTileData: () => OceanTileData | null;
  destroy: () => void;
}

/**
 * Drapes the selected gridded field over the Cesium globe. Only the most recent
 * request may update the globe (older responses are discarded), and a missing tile
 * removes the previous image instead of leaving stale data on screen.
 */
export async function createDepthSliceLayer(
  viewer: Cesium.Viewer,
  onStatus?: (status: SliceStatus) => void
): Promise<DepthSliceLayerManager> {
  let currentImageryLayer: Cesium.ImageryLayer | null = null;
  let currentVariable = 'temperature';
  let isLayerVisible = true;
  let currentOpacity = 0.85;
  let currentTileData: OceanTileData | null = null;
  let requestSeq = 0;
  let lastKey = '';

  const clear = () => {
    if (currentImageryLayer && !viewer.isDestroyed()) {
      viewer.imageryLayers.remove(currentImageryLayer, true);
    }
    currentImageryLayer = null;
    currentTileData = null;
  };

  const updateSlice = async (params: SliceParams) => {
    currentVariable = params.variable;
    if (params.opacity !== undefined) currentOpacity = params.opacity;
    const key = JSON.stringify([params.variable, params.date, params.depth, params.palette, params.customRange,
      params.scaleType]);
    if (key === lastKey) return;
    lastKey = key;
    const seq = ++requestSeq;

    if (!params.date) {
      clear();
      onStatus?.({ state: 'nodata', message: `No timesteps available for ${params.variable}` });
      return;
    }
    onStatus?.({ state: 'loading' });
    try {
      const tileData = await fetchOceanTile(params.variable, params.date, params.depth);
      if (seq !== requestSeq || viewer.isDestroyed()) return; // superseded by a newer request
      const canvas = renderTileToCanvas(tileData, {
        palette: params.palette,
        opacity: 1.0,
        customRange: params.customRange,
        scaleType: params.scaleType
      });
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'), {
        rectangle: Cesium.Rectangle.fromDegrees(...GRID.bbox)
      });
      if (seq !== requestSeq || viewer.isDestroyed()) return;
      const layer = viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha = currentOpacity;
      layer.show = isLayerVisible;
      viewer.imageryLayers.raiseToTop(layer);
      if (currentImageryLayer) viewer.imageryLayers.remove(currentImageryLayer, true);
      currentImageryLayer = layer;
      currentTileData = tileData;
      onStatus?.({ state: 'ok', variable: params.variable, date: params.date, depth: params.depth });
    } catch (err) {
      if (seq !== requestSeq) return;
      clear();
      lastKey = '';
      const message = err instanceof NoDataError
        ? `${err.message} (no synthetic substitute is shown)`
        : `Failed to load ${params.variable}: ${(err as Error).message}`;
      onStatus?.({ state: err instanceof NoDataError ? 'nodata' : 'error', message });
    }
  };

  return {
    updateSlice,
    updateVisibility: (activeLayers: string[]) => {
      isLayerVisible = activeLayers.includes(currentVariable);
      if (currentImageryLayer) currentImageryLayer.show = isLayerVisible;
    },
    setOpacity: (opacity: number) => {
      currentOpacity = opacity;
      if (currentImageryLayer) currentImageryLayer.alpha = opacity;
    },
    sampleAt: (lon: number, lat: number) => {
      if (!currentTileData || !isLayerVisible) return { value: null, isLand: false };
      return sampleOceanDataAt(currentTileData, lon, lat);
    },
    getCurrentTileData: () => currentTileData,
    destroy: () => {
      requestSeq++;
      clear();
    }
  };
}
