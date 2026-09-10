import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useOceanStore } from '../store/useOceanStore';
import { parseUrlState, syncStateToUrl } from '../store/urlState';
import { serializeCameraState, setCameraState } from './cameraUtils';
import { createInstrumentsLayer, InstrumentsLayerManager } from '../layers/instrumentsLayer';
import { createDepthSliceLayer, DepthSliceLayerManager } from '../rendering/depthSliceLayer';
import { createCurrentsLayer, CurrentsLayerManager, computeOceanVelocity } from '../layers/currentsLayer';
import { createVolumetricBlockLayer, VolumetricBlockManager } from '../rendering/volumetricBlockLayer';
import { createGraticuleLayer, GraticuleLayerManager } from '../rendering/graticuleLayer';

interface CesiumViewerProps {
  onViewerReady?: (viewer: Cesium.Viewer) => void;
}

export const CesiumViewer: React.FC<CesiumViewerProps> = ({ onViewerReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const eezDataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const instrumentsManagerRef = useRef<InstrumentsLayerManager | null>(null);
  const depthSliceManagerRef = useRef<DepthSliceLayerManager | null>(null);
  const currentsManagerRef = useRef<CurrentsLayerManager | null>(null);
  const volumetricBlockManagerRef = useRef<VolumetricBlockManager | null>(null);
  const graticuleManagerRef = useRef<GraticuleLayerManager | null>(null);

  const {
    activeLayers,
    depthLevel,
    currentTime,
    selectedVariable,
    mode,
    opacity,
    colorPalette,
    colorRange,
    scaleType,
    vectorArrowScale,
    currentsStyle,
    currentsSpeed,
    currentsDensity,
    currentsTrailLength,
    currentsColorTheme,
    verticalExaggeration,
    is3DVolumeBlockEnabled,
    isGraticuleEnabled,
    setLayers,
    setDepthLevel,
    setCurrentTime,
    setSelectedVariable,
    setMode,
    setSelectedInstrumentId
  } = useOceanStore();

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Check for permalink URL state to restore
    const initialUrlState = parseUrlState();

    if (initialUrlState.layers) setLayers(initialUrlState.layers);
    if (initialUrlState.depth !== undefined) setDepthLevel(initialUrlState.depth);
    if (initialUrlState.time) setCurrentTime(initialUrlState.time);
    if (initialUrlState.variable) setSelectedVariable(initialUrlState.variable);
    if (initialUrlState.mode) setMode(initialUrlState.mode);

    // Zero API key configuration: use Esri World Imagery (Public ArcGIS MapServer)
    const baseLayer = Cesium.ImageryLayer.fromProviderAsync(
      Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
        { enablePickFeatures: false }
      )
    );

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer,
      baseLayerPicker: false,
      geocoder: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      contextOptions: {
        webgl: {
          alpha: true,
          depth: true,
          stencil: true,
          antialias: true,
          preserveDrawingBuffer: true
        }
      }
    });

    // Dark space & deep ocean styling
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#020b14');
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#01050a');

    // Restore camera from URL state if provided, or default to Full Globe view
    if (initialUrlState.camera) {
      setCameraState(viewer, initialUrlState.camera);
    } else {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(78.0, 15.0, 24000000),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-90.0),
          roll: 0.0
        }
      });
    }

    // Globe translucency to reveal 3D subsurface ocean depth block
    viewer.scene.globe.translucency.enabled = true;
    viewer.scene.globe.translucency.frontFaceAlpha = 0.70;
    viewer.scene.globe.translucency.backFaceAlpha = 0.25;
    viewer.scene.globe.depthTestAgainstTerrain = false;

    // Enable smooth inertia zooming and tilting with generous zoom limits (no terrain collision lock)
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 80000000;

    // 1. Load India Exclusive Economic Zone (EEZ) boundary polygon overlay
    Cesium.GeoJsonDataSource.load('/data/india_eez.geojson', {
      stroke: Cesium.Color.fromCssColorString('#00e5ff'),
      fill: Cesium.Color.fromCssColorString('rgba(0, 229, 255, 0.08)'),
      strokeWidth: 2,
      clampToGround: true
    }).then((ds) => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewer.dataSources.add(ds);
        eezDataSourceRef.current = ds;
        const currentActiveLayers = useOceanStore.getState().activeLayers;
        ds.show = currentActiveLayers.includes('india_eez');
      }
    }).catch((err) => {
      console.warn('[Cesium] Failed to load India EEZ boundary:', err);
    });

    // 2. Initialize In-situ Instruments Layer (Argo Floats & Gliders)
    createInstrumentsLayer(viewer, (instId: string) => {
      setSelectedInstrumentId(instId);
    }).then((manager) => {
      instrumentsManagerRef.current = manager;
      manager.updateVisibility(useOceanStore.getState().activeLayers);
    });

    // 3. Initialize Ocean Model Depth-Slice Layer
    createDepthSliceLayer(viewer).then((manager) => {
      depthSliceManagerRef.current = manager;
      const state = useOceanStore.getState();
      manager.updateSlice({
        variable: state.selectedVariable,
        date: state.currentTime,
        depth: state.depthLevel,
        palette: state.colorPalette,
        opacity: state.opacity,
        customRange: state.colorRange
      });
      manager.updateVisibility(state.activeLayers);
    });

    // 4. Sample Ocean Model Field on Mouse Move for real-time Hover HUD readout
    const hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    hoverHandler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      if (!depthSliceManagerRef.current) return;

      const ray = viewer.camera.getPickRay(movement.endPosition);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        const sample = depthSliceManagerRef.current.sampleAt(lon, lat);
        if (sample.value !== null) {
          const store = useOceanStore.getState();
          const varUnit = store.selectedVariable === 'temperature' ? '°C' : store.selectedVariable === 'salinity' ? 'PSU' : 'mg/m³';

          let curSpeed: number | undefined;
          let curHeading: number | undefined;
          if (store.activeLayers.includes('currents')) {
            const vel = computeOceanVelocity(lon, lat, store.depthLevel, store.currentTime);
            curSpeed = parseFloat(vel.speed.toFixed(2));
            curHeading = Math.round(vel.headingDeg);
          }

          store.setHoveredOceanInfo({
            lon: parseFloat(lon.toFixed(2)),
            lat: parseFloat(lat.toFixed(2)),
            variable: store.selectedVariable,
            depth: store.depthLevel,
            value: parseFloat(sample.value.toFixed(2)),
            unit: varUnit,
            minVal: store.colorRange[0],
            maxVal: store.colorRange[1],
            screenX: movement.endPosition.x,
            screenY: movement.endPosition.y,
            currentSpeed: curSpeed,
            currentHeading: curHeading
          });
          return;
        }
      }
      useOceanStore.getState().setHoveredOceanInfo(null);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 4b. Handle Click on Ocean Surface to extract local 3D Water Column Cube
    hoverHandler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      // If an instrument entity was clicked, instrumentsLayer will handle it
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && picked.id.properties?.hasProperty('externalId')) {
        return;
      }

      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);

      // Determine basin name
      let basinName = 'Indian Ocean';
      if (lon >= 52 && lon <= 78 && lat >= 8 && lat <= 26) {
        basinName = 'Arabian Sea Basin';
      } else if (lon >= 78 && lon <= 96 && lat >= 6 && lat <= 23) {
        basinName = 'Bay of Bengal Basin';
      } else if (lon >= 91 && lon <= 98 && lat >= 6 && lat <= 15) {
        basinName = 'Andaman Sea Basin';
      } else if (lat < 6) {
        basinName = 'Equatorial Indian Ocean';
      }

      useOceanStore.getState().setClickedGlobePoint({
        lon: parseFloat(lon.toFixed(2)),
        lat: parseFloat(lat.toFixed(2)),
        screenX: click.position.x,
        screenY: click.position.y,
        basin: basinName
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 5. Initialize Ocean Currents Layer (Weather-Map Streamlines + Directional Vector Arrows)
    const currentsManager = createCurrentsLayer(viewer);
    currentsManagerRef.current = currentsManager;
    const initStore = useOceanStore.getState();
    currentsManager.updateVisibility(initStore.activeLayers);
    currentsManager.updateDepth(initStore.depthLevel);
    currentsManager.updateArrowScale(initStore.vectorArrowScale);
    currentsManager.updateTime(initStore.currentTime);
    currentsManager.updateSettings({
      speed: initStore.currentsSpeed,
      arrowScale: initStore.vectorArrowScale
    });

    // 6. Initialize 3D Volumetric Ocean Block Layer (True 3D Cutaway with Depth Walls & Stratification)
    const volumetricBlockManager = createVolumetricBlockLayer(viewer);
    volumetricBlockManagerRef.current = volumetricBlockManager;
    volumetricBlockManager.update({
      variable: initStore.selectedVariable,
      depthLevel: initStore.depthLevel,
      verticalExaggeration: initStore.verticalExaggeration,
      colorPalette: initStore.colorPalette,
      colorRange: initStore.colorRange,
      opacity: initStore.opacity,
      isVisible: initStore.is3DVolumeBlockEnabled
    });

    // 7. Initialize NOAA-style Cartographic Graticules Layer
    const graticuleManager = createGraticuleLayer(viewer);
    graticuleManagerRef.current = graticuleManager;
    graticuleManager.setVisible(initStore.isGraticuleEnabled);

    const handleFlyToBlock = () => {
      volumetricBlockManagerRef.current?.flyToBlock();
    };
    window.addEventListener('fly-to-ocean-block', handleFlyToBlock);

    // Sync camera moves to URL query params
    const removeMoveEndListener = viewer.camera.moveEnd.addEventListener(() => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        const camState = serializeCameraState(viewerRef.current);
        syncStateToUrl(camState, useOceanStore.getState());
      }
    });

    viewerRef.current = viewer;
    if (onViewerReady) {
      onViewerReady(viewer);
    }

    return () => {
      window.removeEventListener('fly-to-ocean-block', handleFlyToBlock);
      removeMoveEndListener();
      hoverHandler.destroy();
      instrumentsManagerRef.current?.destroy();
      depthSliceManagerRef.current?.destroy();
      currentsManagerRef.current?.destroy();
      volumetricBlockManagerRef.current?.destroy();
      graticuleManagerRef.current?.destroy();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [onViewerReady]);

  // Update layers and slices when activeLayers, depth, variable, or color settings change
  useEffect(() => {
    if (eezDataSourceRef.current) {
      eezDataSourceRef.current.show = activeLayers.includes('india_eez');
    }
    if (instrumentsManagerRef.current) {
      instrumentsManagerRef.current.updateVisibility(activeLayers);
    }
    if (currentsManagerRef.current) {
      currentsManagerRef.current.updateVisibility(activeLayers);
      currentsManagerRef.current.updateDepth(depthLevel);
      currentsManagerRef.current.updateArrowScale(vectorArrowScale);
      currentsManagerRef.current.updateTime(currentTime);
      currentsManagerRef.current.updateSettings({
        speed: currentsSpeed,
        arrowScale: vectorArrowScale
      });
    }
    if (depthSliceManagerRef.current) {
      depthSliceManagerRef.current.updateVisibility(activeLayers);
      depthSliceManagerRef.current.setOpacity(opacity);
      depthSliceManagerRef.current.updateSlice({
        variable: selectedVariable,
        date: currentTime,
        depth: depthLevel,
        palette: colorPalette,
        opacity,
        customRange: colorRange,
        scaleType
      });
    }
    if (volumetricBlockManagerRef.current) {
      volumetricBlockManagerRef.current.update({
        variable: selectedVariable,
        depthLevel,
        verticalExaggeration,
        colorPalette,
        colorRange,
        opacity,
        isVisible: is3DVolumeBlockEnabled
      });
    }
    if (graticuleManagerRef.current) {
      graticuleManagerRef.current.setVisible(isGraticuleEnabled);
    }
    if (viewerRef.current) {
      const camState = serializeCameraState(viewerRef.current);
      syncStateToUrl(camState, useOceanStore.getState());
    }
  }, [
    activeLayers,
    depthLevel,
    currentTime,
    selectedVariable,
    mode,
    opacity,
    colorPalette,
    colorRange,
    scaleType,
    vectorArrowScale,
    currentsStyle,
    currentsSpeed,
    currentsDensity,
    currentsTrailLength,
    currentsColorTheme,
    verticalExaggeration,
    is3DVolumeBlockEnabled,
    isGraticuleEnabled
  ]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
