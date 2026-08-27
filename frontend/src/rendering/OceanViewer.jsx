import React, { useEffect, useRef, useState } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { OceanSceneController } from './OceanSceneController';
import { RotateCcw, Crosshair, AlertTriangle, Compass, Radio, Activity } from 'lucide-react';
import { sampleVolumeScalar } from '../utils/geography';

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
    variable,
    depthLevelMeters,
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
    selectedCycle,
    selectFloat,
    selectMission,
    selectOceanEvent,
    isLoading,
    loadingMessage,
    errorState,
    cameraAction,
    clearCameraAction,
    targetCoordinate,
    visualPreset,
  } = useOceanStore();

  // Initialize OceanSceneController on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const controller = new OceanSceneController(container, {
      viewMode: useOceanStore.getState().viewMode || 'globe',
      onHoverFloat: (f) => setHoveredFloat(f),
      onSelectFloat: (f) => selectFloat(f),
      onSelectCycle: (cycleNum) => {
        useOceanStore.getState().setSelectedCycle(cycleNum);
        const activeFl = useOceanStore.getState().selectedFloat;
        if (activeFl) {
          useOceanStore.getState().fetchArgoProfile(activeFl.platform_number, cycleNum);
        }
      },
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

  // Sync In-Situ Argo Float 3D Markers & Multi-Cycle Trajectory
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.updateArgoMarkers(argoFloats, selectedFloat, verticalExaggeration, volumeMeta, selectedCycle);
  }, [argoFloats, selectedFloat, verticalExaggeration, volumeMeta, selectedCycle]);

  // Sync Scientific Visual Preset Mode (God's Eye View Shaders)
  useEffect(() => {
    if (!controllerRef.current) return;
    controllerRef.current.applyVisualPreset(visualPreset);
  }, [visualPreset]);

  // Compute live scalar field sampled value at cursor coordinate
  const sampledValue = cursorProbe
    ? sampleVolumeScalar(cursorProbe.lat, cursorProbe.lon, depthLevelMeters, volumeBuffer, volumeMeta)
    : null;

  const currentUnits = volumeMeta?.units || (variable === 'temp' ? '°C' : (variable === 'salt' ? 'PSU' : 'm/s'));

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[var(--surface-base)]">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Scientific Coordinates & Scalar Field Probe HUD (Top-Left) */}
      {cursorProbe && (
        <div className="hidden sm:flex absolute top-12 left-76 z-10 items-center gap-3 px-3 py-1.5 bg-[var(--surface-rack-backdrop)] backdrop-blur-md border border-[var(--border-hairline)] rounded-sm text-[11px] font-mono text-slate-300 shadow-xl pointer-events-none">
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
            <span className="text-slate-100 font-bold tabular-nums">
              {Math.abs(cursorProbe.lat).toFixed(4)}°{cursorProbe.lat >= 0 ? 'N' : 'S'}, {Math.abs(cursorProbe.lon).toFixed(4)}°{cursorProbe.lon >= 0 ? 'E' : 'W'}
            </span>
          </div>

          <span className="h-3 w-px bg-[var(--border-hairline)]" />

          {/* Sampled Value at depth */}
          {sampledValue !== null ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 uppercase text-[9px]">{variable}:</span>
              <span className="text-sky-300 font-bold tabular-nums">
                {sampledValue.toFixed(2)} {currentUnits}
              </span>
              <span className="text-slate-500 text-[9px]">(@ {depthLevelMeters}m)</span>
            </div>
          ) : (
            <span className="text-slate-500 text-[10px]">
              {cursorProbe.isInsideModel ? 'ROMS Model Grid' : 'Global Ocean (No Model Data)'}
            </span>
          )}
        </div>
      )}

      {/* Camera Regional Presets Floating Toolbar (Bottom-Right) */}
      <div className="absolute bottom-16 right-3 md:right-4 z-10 flex items-center gap-1 p-1 bg-[var(--surface-rack-backdrop)] backdrop-blur-md border border-[var(--border-hairline)] rounded-sm shadow-xl font-mono text-[10px]">
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('fit_indian_ocean')}
          className="px-2 py-1 text-slate-300 hover:text-white rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] transition-colors"
          title="Center on Indian Ocean Basin (10°N, 75°E)"
        >
          INDIAN OCEAN
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('arabian_sea')}
          className="px-2 py-1 text-slate-300 hover:text-white rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] transition-colors hidden sm:block"
          title="Zoom to Arabian Sea"
        >
          ARABIAN SEA
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('bay_of_bengal')}
          className="px-2 py-1 text-slate-300 hover:text-white rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] transition-colors hidden sm:block"
          title="Zoom to Bay of Bengal"
        >
          BAY OF BENGAL
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('fit_earth')}
          className="px-2 py-1 text-slate-300 hover:text-white rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] transition-colors"
          title="Fit Global Earth Sphere"
        >
          FIT GLOBE
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('reset')}
          className="p-1 text-slate-400 hover:text-white rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] transition-colors"
          title="Reset Camera Orientation"
        >
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Float Hover Tooltip HUD */}
      {hoveredFloat && (
        <div className="absolute top-20 left-76 z-20 px-3 py-2 bg-[var(--surface-rack-backdrop)] backdrop-blur-md border border-amber-500/40 rounded-sm text-xs text-slate-100 shadow-2xl font-mono flex flex-col gap-0.5 animate-in fade-in duration-150 pointer-events-none">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Radio className="w-3 h-3 text-amber-400" strokeWidth={1.75} />
            <span>Argo Float WMO {hoveredFloat.platform_number}</span>
          </div>
          <div className="text-[10px] text-slate-400 tabular-nums">
            {hoveredFloat.latest_position?.latitude?.toFixed(2)}°N, {hoveredFloat.latest_position?.longitude?.toFixed(2)}°E
          </div>
          <div className="text-[9px] text-emerald-400 mt-0.5">
            Click to inspect vertical CTD profile & compute residuals
          </div>
        </div>
      )}

      {/* Error / Notice Banner */}
      {errorState && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 max-w-md px-4 py-2 bg-rose-950/80 backdrop-blur-md rounded-sm text-xs shadow-2xl flex items-center gap-2.5 text-rose-200 border border-rose-500/40 font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" strokeWidth={1.75} />
          <span className="text-[11px] font-normal">{errorState}</span>
        </div>
      )}
    </div>
  );
};
