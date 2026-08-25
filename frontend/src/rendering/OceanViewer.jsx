import React, { useEffect, useRef, useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { OceanSceneController } from './OceanSceneController';
import {
  RotateCcw,
  Grid,
  Box,
  Crosshair,
  AlertTriangle,
  Compass,
  Layers,
  Radio
} from '../components/Icons';

export const OceanViewer = () => {
  const mountRef = useRef(null);
  const controllerRef = useRef(null);

  const [hoveredFloat, setHoveredFloat] = useState(null);
  const [orbitStats, setOrbitStats] = useState({ azimuth: 45, elevation: 35, zoom: 1.0 });

  const {
    volumeBuffer,
    volumeMeta,
    renderMode,
    colormap,
    opacity,
    threshold,
    isoValue,
    sliceDepthMeters,
    enableSlice,
    verticalExaggeration,
    layers,
    argoFloats,
    selectedFloat,
    selectFloat,
    selectPlatform,
    isLoading,
    loadingMessage,
    errorState,
    cameraAction,
    clearCameraAction,
    showGrid,
    showBoundingBox,
    toggleGrid,
    toggleBoundingBox,
  } = useOceanStore();

  // Initialize OceanSceneController on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const controller = new OceanSceneController(container, {
      onHoverFloat: (f) => setHoveredFloat(f),
      onSelectFloat: (f) => selectFloat(f),
      onSelectPlatform: (p) => selectPlatform(p),
      onOrbitChange: (stats) => setOrbitStats(stats),
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [selectFloat, selectPlatform]);

  // Sync Camera Actions
  useEffect(() => {
    if (!cameraAction || !controllerRef.current) return;
    controllerRef.current.setCameraPreset(cameraAction);
    clearCameraAction();
  }, [cameraAction, clearCameraAction]);

  // Sync 3D Volume Data Buffer
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.updateVolumeData(volumeBuffer, volumeMeta);
  }, [volumeBuffer, volumeMeta]);

  // Sync Shading & Slicing Uniforms
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.updateUniforms({
      opacity,
      threshold,
      isoValue,
      renderMode,
      colormap,
      sliceDepthMeters,
      enableSlice,
      verticalExaggeration,
    });
  }, [opacity, threshold, isoValue, renderMode, colormap, sliceDepthMeters, enableSlice, verticalExaggeration]);

  // Sync Environmental & Marine Layers Visibility
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.setLayerVisibility(layers);
  }, [layers]);

  // Sync Grid and Bounding Box Visibility
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.updateGridAndBox({ showGrid, showBoundingBox });
  }, [showGrid, showBoundingBox]);

  // Sync In-Situ Argo Float 3D Markers
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.updateArgoMarkers(argoFloats, selectedFloat, verticalExaggeration, volumeMeta);
  }, [argoFloats, selectedFloat, verticalExaggeration, volumeMeta]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#040711]">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Right Camera Viewport Toolbar */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 p-1 bg-[#080e1a] border border-[#1e293b] text-slate-300 shadow-md">
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('cinematic')}
          title="Cinematic Low-Horizon Ocean Perspective"
          className="px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-[10px] font-mono transition-colors"
        >
          CINEMATIC
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('platform')}
          title="Focus on Moored Intelligence Station"
          className="px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-[10px] font-mono transition-colors text-amber-300 font-bold"
        >
          STATION
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('geospatial')}
          title="Tactical Top-Down Plan View (North Up)"
          className="px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-[10px] font-mono transition-colors"
        >
          GEOSPATIAL
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('subsurface')}
          title="Subsurface Thermocline Profiling View"
          className="px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-[10px] font-mono transition-colors text-teal-300"
        >
          SUBSURFACE
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('iso')}
          title="Isometric 3D Perspective"
          className="px-1.5 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-[10px] font-mono transition-colors"
        >
          3D ISO
        </button>
        <div className="w-[1px] h-3 bg-[#1e293b] mx-0.5" />
        <button
          onClick={toggleGrid}
          title={showGrid ? 'Hide Bathymetric Grid' : 'Show Bathymetric Grid'}
          className={`p-1 border text-xs transition-colors ${
            showGrid ? 'bg-[#10243e] border-sky-500 text-sky-300' : 'bg-[#0c1424] border-[#1e293b] text-slate-500'
          }`}
        >
          <Grid className="w-3 h-3" />
        </button>
        <button
          onClick={toggleBoundingBox}
          title={showBoundingBox ? 'Hide Bounding Frame' : 'Show Bounding Frame'}
          className={`p-1 border text-xs transition-colors ${
            showBoundingBox ? 'bg-[#10243e] border-sky-500 text-sky-300' : 'bg-[#0c1424] border-[#1e293b] text-slate-500'
          }`}
        >
          <Box className="w-3 h-3" />
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('reset')}
          title="Reset Camera Target"
          className="p-1 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-slate-400 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Top-Left Viewport Spatial Coordinates & Resolution HUD */}
      <div className="hidden sm:flex absolute top-2 left-2 z-10 items-center gap-2 px-2.5 py-1 bg-[#080e1a] border border-[#1e293b] text-[10px] font-mono text-slate-300 shadow-md">
        <div className="flex items-center gap-1.5 font-bold text-sky-300">
          <Radio className="w-3 h-3 text-sky-400" />
          <span>INCOIS OCEAN 3D</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="text-slate-400">
          Res: <span className="text-teal-300">64x64x32 Float32</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="text-slate-400">
          Z: <span className="text-slate-200">0—2000 m</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="text-slate-400 flex items-center gap-1">
          <Layers className="w-3 h-3 text-amber-400" />
          <span className="text-amber-300">{Object.values(layers).filter(Boolean).length} Active Layers</span>
        </div>
      </div>

      {/* Bottom Viewport Camera Orientation Readout */}
      <div className="hidden md:flex absolute bottom-2 right-2 z-10 items-center gap-2 px-2.5 py-0.5 bg-[#080e1a] border border-[#1e293b] text-[9px] font-mono text-slate-400 shadow-md">
        <span>AZ: <strong className="text-slate-200">{orbitStats.azimuth}°</strong></span>
        <span>EL: <strong className="text-slate-200">{orbitStats.elevation}°</strong></span>
        <span>R: <strong className="text-slate-200">{orbitStats.zoom}x</strong></span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-500">L-Drag: Orbit · R-Drag: Pan · Scroll: Zoom</span>
      </div>

      {/* Float Hover Tooltip HUD */}
      {hoveredFloat && (
        <div className="absolute top-10 left-2 z-20 px-2.5 py-1.5 bg-[#080e1a] border border-amber-500 text-xs text-slate-100 shadow-xl font-mono flex flex-col gap-0.5">
          <div className="flex items-center gap-1 font-bold text-amber-300">
            <span className="w-1.5 h-1.5 bg-amber-400" />
            <span>ARGO WMO {hoveredFloat.platform_number}</span>
          </div>
          <div className="text-[10px] text-slate-300 tabular-nums">
            Lat: {hoveredFloat.latest_position.latitude.toFixed(2)}°N | Lon: {hoveredFloat.latest_position.longitude.toFixed(2)}°E
          </div>
          <div className="text-[9px] text-slate-400">
            Click marker to inspect profile & compute residuals
          </div>
        </div>
      )}

      {/* Loading HUD Banner */}
      {isLoading && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 bg-[#080e1a] border border-sky-500 text-sky-300 text-xs font-mono shadow-xl">
          <span className="w-1.5 h-1.5 bg-sky-400" />
          <span className="tracking-wide font-bold">{loadingMessage}</span>
        </div>
      )}

      {/* Error & Scientific Dataset Missing State */}
      {errorState && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 max-w-md px-3.5 py-2.5 bg-[#080e1a] border border-amber-500 text-xs shadow-2xl flex items-start gap-2.5 text-slate-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 font-mono">
            <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
              DATASET NOTICE
            </div>
            <div className="text-[10px] text-slate-300 leading-normal">
              {errorState}
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Verify NetCDF archives in datasets/model/ and datasets/argo/
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
