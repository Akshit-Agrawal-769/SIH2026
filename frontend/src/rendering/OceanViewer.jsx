import React, { useEffect, useRef, useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { OceanSceneController } from './OceanSceneController';
import { RotateCcw, Crosshair, AlertTriangle, Compass, Eye, Navigation } from 'lucide-react';

export const OceanViewer = () => {
  const mountRef = useRef(null);
  const controllerRef = useRef(null);

  const [hoveredFloat, setHoveredFloat] = useState(null);
  const [orbitStats, setOrbitStats] = useState({ azimuth: 45, elevation: 35, zoom: 1.0 });

  const {
    viewMode,
    setViewMode,
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
    cursorProbe,
    setCursorProbe,
    argoFloats,
    selectedFloat,
    selectFloat,
    selectMission,
    selectOceanEvent,
    isLoading,
    loadingMessage,
    errorState,
    cameraAction,
    clearCameraAction,
    targetCoordinate,
  } = useOceanStore();

  // Initialize OceanSceneController on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const controller = new OceanSceneController(container, {
      viewMode: useOceanStore.getState().viewMode || 'globe',
      onHoverFloat: (f) => setHoveredFloat(f),
      onSelectFloat: (f) => selectFloat(f),
      onSelectMission: (id) => selectMission(id),
      onSelectOceanEvent: (id) => selectOceanEvent(id),
      onOrbitChange: (stats) => setOrbitStats(stats),
      onSampleProbe: (probe) => setCursorProbe(probe),
      onSelectCoordinate: (coord) => {
        useOceanStore.getState().focusCoordinateInExplorer(coord.lat, coord.lon, `Point (${coord.lat.toFixed(2)}°, ${coord.lon.toFixed(2)}°)`);
      },
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [selectFloat, selectMission, selectOceanEvent, setCursorProbe]);

  // Sync View Mode ('globe' | 'ocean3d')
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.setViewMode(viewMode);
  }, [viewMode]);

  // Sync Camera Actions
  useEffect(() => {
    if (!cameraAction || !controllerRef.current) return;
    controllerRef.current.setCameraPreset(cameraAction);
    clearCameraAction();
  }, [cameraAction, clearCameraAction]);

  // Sync Focused Target Coordinate
  useEffect(() => {
    if (!targetCoordinate || !controllerRef.current) return;
    controllerRef.current.focusCoordinate(targetCoordinate.lat, targetCoordinate.lon);
  }, [targetCoordinate]);

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

  // Sync Environmental & Planetary Layers Visibility
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.setLayerVisibility(layers);
  }, [layers]);

  // Sync In-Situ Argo Float 3D Markers
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.updateArgoMarkers(argoFloats, selectedFloat, verticalExaggeration, volumeMeta);
  }, [argoFloats, selectedFloat, verticalExaggeration, volumeMeta]);

  // Sync Scientific Visual Preset Mode (God's Eye View Shaders)
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.applyVisualPreset(visualPreset);
  }, [visualPreset]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#030712]">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Spatial Coordinates HUD (Top-Left under Header) */}
      {cursorProbe && (
        <div className="hidden sm:flex absolute top-12 left-3 md:left-4 z-10 items-center gap-2 px-3 py-1.5 glass-pill text-[10px] font-mono text-white/70 shadow-lg pointer-events-none">
          <Crosshair className="w-3 h-3 text-white/50" />
          <span className="text-white/90 tabular-nums font-normal">
            {cursorProbe.lat >= 0 ? `${cursorProbe.lat.toFixed(2)}°N` : `${Math.abs(cursorProbe.lat).toFixed(2)}°S`}, {cursorProbe.lon >= 0 ? `${cursorProbe.lon.toFixed(2)}°E` : `${Math.abs(cursorProbe.lon).toFixed(2)}°W`}
          </span>
          <span className="text-white/20">|</span>
          <span className="text-white/50">
            {cursorProbe.isInsideModel ? 'INCOIS Model Grid' : 'Global Ocean'}
          </span>
        </div>
      )}

      {/* Camera Regional Presets Floating Toolbar (Bottom-Right) */}
      <div className="absolute bottom-16 right-3 md:right-4 z-10 flex items-center gap-1 p-1 glass-pill shadow-lg">
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('fit_indian_ocean')}
          className="px-2.5 py-1 text-[10px] font-mono text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          title="Center on Indian Ocean Basin (10°N, 75°E)"
        >
          Indian Ocean
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('arabian_sea')}
          className="px-2 py-1 text-[10px] font-mono text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors hidden sm:block"
          title="Zoom to Arabian Sea"
        >
          Arabian Sea
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('bay_of_bengal')}
          className="px-2 py-1 text-[10px] font-mono text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors hidden sm:block"
          title="Zoom to Bay of Bengal"
        >
          Bay of Bengal
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('fit_earth')}
          className="px-2 py-1 text-[10px] font-mono text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          title="Fit Global Earth Sphere"
        >
          Globe
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('reset')}
          className="p-1 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          title="Reset Camera Orientation"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Float Hover Tooltip HUD */}
      {hoveredFloat && (
        <div className="absolute top-20 left-3 md:left-4 z-20 px-3 py-2 glass-panel rounded-xl text-xs text-white/90 shadow-2xl font-mono flex flex-col gap-0.5 animate-in fade-in duration-150 pointer-events-none">
          <div className="flex items-center gap-1.5 font-normal text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>Argo Profiler WMO {hoveredFloat.platform_number}</span>
          </div>
          <div className="text-[10px] text-white/50 tabular-nums">
            {hoveredFloat.latest_position.latitude.toFixed(2)}°N, {hoveredFloat.latest_position.longitude.toFixed(2)}°E
          </div>
          <div className="text-[9px] text-white/40">
            Click marker to inspect profile
          </div>
        </div>
      )}

      {/* Loading HUD Banner */}
      {isLoading && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-1.5 glass-panel rounded-full text-white/90 text-xs font-light shadow-2xl animate-in fade-in duration-200">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <span className="tracking-wide text-[11px]">{loadingMessage || 'Streaming INCOIS Ocean Dataset...'}</span>
        </div>
      )}

      {/* Error / Notice Banner */}
      {errorState && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 max-w-md px-4 py-2 glass-panel rounded-xl text-xs shadow-2xl flex items-center gap-2.5 text-white/90 border border-white/20">
          <AlertTriangle className="w-4 h-4 text-white/80 shrink-0" />
          <span className="text-[11px] text-white/70 font-light">{errorState}</span>
        </div>
      )}
    </div>
  );
};
