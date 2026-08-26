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
  Radio,
  Activity,
  Globe
} from '../components/Icons';

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
    seaState,
    cursorProbe,
    setCursorProbe,
    argoFloats,
    selectedFloat,
    selectFloat,
    selectPlatform,
    isLoading,
    loadingMessage,
    errorState,
    cameraAction,
    clearCameraAction,
    targetCoordinate,
    showGrid,
    showBoundingBox,
    toggleGrid,
    toggleBoundingBox,
    toggleGoToLocationModal,
  } = useOceanStore();

  // Initialize OceanSceneController on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const controller = new OceanSceneController(container, {
      viewMode: useOceanStore.getState().viewMode || 'globe',
      onHoverFloat: (f) => setHoveredFloat(f),
      onSelectFloat: (f) => selectFloat(f),
      onSelectPlatform: (p) => selectPlatform(p),
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
  }, [selectFloat, selectPlatform, setCursorProbe]);

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

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#030712]">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Right Camera & Viewport Navigation Toolbar */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 p-1 bg-[#080e1a]/95 border border-[#1e293b] text-slate-300 shadow-md">
        {/* Mode Switcher */}
        <div className="flex items-center bg-[#040814] border border-[#1e293b] p-0.5 mr-1">
          <button
            onClick={() => setViewMode('globe')}
            title="3D Interactive Earth Exploration Globe"
            className={`px-2 py-0.5 text-[10px] font-mono font-bold transition-colors ${
              viewMode === 'globe'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            EARTH
          </button>
          <button
            onClick={() => setViewMode('ocean3d')}
            title="3D Ocean Volume Raymarching & Depth Slicing"
            className={`px-2 py-0.5 text-[10px] font-mono font-bold transition-colors ${
              viewMode === 'ocean3d'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            OCEAN 3D
          </button>
        </div>

        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('fit_indian_ocean')}
          title="Fit Indian Ocean Basin (10°N, 75°E)"
          className="px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-cyan-500 hover:text-cyan-300 text-[10px] font-mono transition-colors text-cyan-400 font-bold"
        >
          INDIAN OCEAN
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('fit_earth')}
          title="Fit Entire 3D Earth Globe"
          className="px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-cyan-500 hover:text-cyan-300 text-[10px] font-mono transition-colors text-slate-300"
        >
          FIT EARTH
        </button>
        <button
          onClick={() => toggleGoToLocationModal()}
          title="Jump to Specific Coordinates"
          className="px-2 py-0.5 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-[10px] font-mono transition-colors text-sky-300 font-bold"
        >
          GO TO
        </button>
        <div className="w-[1px] h-3 bg-[#1e293b] mx-0.5" />
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('reset')}
          title="Reset Camera Orientation"
          className="p-1 bg-[#0c1424] border border-[#1e293b] hover:border-sky-500 hover:text-sky-300 text-slate-400 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Top-Left Viewport Spatial Coordinates & Resolution HUD */}
      <div className="hidden sm:flex absolute top-2 left-2 z-10 items-center gap-2 px-2.5 py-1 bg-[#080e1a] border border-[#1e293b] text-[10px] font-mono text-slate-300 shadow-md">
        <div className="flex items-center gap-1.5 font-bold text-sky-300">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>INCOIS 3D EARTH</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="text-slate-400">
          Domain: <span className="text-amber-300 font-bold">30°E—120°E, 30°S—30°N</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="text-slate-400 flex items-center gap-1">
          <Layers className="w-3 h-3 text-cyan-400" />
          <span className="text-cyan-300">{Object.values(layers).filter(Boolean).length} Active Layers</span>
        </div>
      </div>

      {/* Real-Time Spherical Cursor Probe & Model Coverage HUD */}
      {cursorProbe && (
        <div className="hidden md:flex absolute top-10 left-2 z-10 items-center gap-2 px-2.5 py-1 bg-[#080e1a]/95 border border-[#1e293b] text-[10px] font-mono text-slate-300 shadow-md">
          <div className="flex items-center gap-1 text-cyan-400">
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">COORDINATE:</span>
          </div>
          <span className="text-slate-100 tabular-nums font-bold">
            {cursorProbe.lat >= 0 ? `${cursorProbe.lat.toFixed(2)}°N` : `${Math.abs(cursorProbe.lat).toFixed(2)}°S`},{' '}
            {cursorProbe.lon >= 0 ? `${cursorProbe.lon.toFixed(2)}°E` : `${Math.abs(cursorProbe.lon).toFixed(2)}°W`}
          </span>
          <span className="text-slate-600">|</span>
          {cursorProbe.isInsideModel ? (
            <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[9px] font-bold">
              INCOIS MODEL DOMAIN
            </span>
          ) : (
            <span className="px-1.5 py-0.2 bg-slate-900 border border-slate-700 text-slate-400 text-[9px]">
              OUTSIDE MODEL COVERAGE
            </span>
          )}
        </div>
      )}

      {/* Bottom Viewport Camera Orientation Readout */}
      <div className="hidden md:flex absolute bottom-2 right-2 z-10 items-center gap-2 px-2.5 py-0.5 bg-[#080e1a] border border-[#1e293b] text-[9px] font-mono text-slate-400 shadow-md">
        <span>AZ: <strong className="text-slate-200">{orbitStats.azimuth}°</strong></span>
        <span>EL: <strong className="text-slate-200">{orbitStats.elevation}°</strong></span>
        <span>R: <strong className="text-slate-200">{orbitStats.zoom}x</strong></span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-500">L-Drag: Rotate Earth · Wheel: Zoom · Click: Sample</span>
      </div>

      {/* Float Hover Tooltip HUD */}
      {hoveredFloat && (
        <div className="absolute top-16 left-2 z-20 px-2.5 py-1.5 bg-[#080e1a] border border-amber-500 text-xs text-slate-100 shadow-xl font-mono flex flex-col gap-0.5">
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
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 bg-[#080e1a] border border-cyan-500 text-cyan-300 text-xs font-mono shadow-xl">
          <span className="w-1.5 h-1.5 bg-cyan-400" />
          <span className="tracking-wide font-bold">{loadingMessage}</span>
        </div>
      )}

      {/* Error & Scientific Dataset Notice State */}
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
