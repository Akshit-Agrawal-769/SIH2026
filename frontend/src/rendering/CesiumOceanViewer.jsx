/**
 * INCOIS 3D Ocean Data Visualization Platform
 * Copyright (c) 2026 INCOIS / Ministry of Earth Sciences, Govt. of India
 * SPDX-License-Identifier: MIT
 *
 * CESIUM OCEAN VIEWER (PRIMARY 3D PLANETARY DIGITAL TWIN)
 */
import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useOceanStore } from '../store/oceanStore';

export const CesiumOceanViewer = () => {
  const mountRef = useRef(null);
  const viewerRef = useRef(null);

  // Zustand bindings
  const {
    viewMode,
    targetCoordinate,
    cameraAction,
    clearCameraAction,
    argoFloats,
    volumeBuffer,
    volumeMeta,
    settings,
  } = useOceanStore();

  // Initialize Native Cesium Globe
  useEffect(() => {
    if (!mountRef.current || viewerRef.current) return;

    let viewer;
    try {
      viewer = new Cesium.Viewer(mountRef.current, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        vrButton: false,
        selectionIndicator: false,
        infoBox: false,
        baseLayer: false,
        msaaSamples: 4,
        creditContainer: (() => {
          const el = document.createElement('div');
          el.id = 'cesium-credits';
          el.style.display = 'none';
          return el;
        })(),
        contextOptions: {
          webgl: {
            preserveDrawingBuffer: true,
          },
        },
      });

      // Asynchronously load ESRI World Imagery
      Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
        { enablePickFeatures: false }
      )
        .then((provider) => {
          if (!viewer.isDestroyed()) {
            viewer.imageryLayers.addImageryProvider(provider);
          }
        })
        .catch((err) => {
          console.warn('[Cesium] ArcGisMapServerImageryProvider fallback:', err);
          Cesium.createWorldImageryAsync()
            .then((provider) => {
              if (!viewer.isDestroyed()) {
                viewer.imageryLayers.addImageryProvider(provider);
              }
            })
            .catch(() => {});
        });

      viewer.targetFrameRate = 60;
      viewer.scene.globe.show = true;
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.depthTestAgainstTerrain = false;

      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyAtmosphere.atmosphereLightIntensity = 12;
      }

      // Initial Camera Centered on the Indian Ocean Basin
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(78.0, 12.0, 13500000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });

      // Maintain global reference for status bar and globe controls
      window.__cesiumViewer = viewer;
      viewerRef.current = viewer;

      // Coordinate Picking & Float Selection Handlers
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

      handler.setInputAction((movement) => {
        const picked = viewer.scene.pick(movement.position);
        if (Cesium.defined(picked) && picked.id && picked.id._argoFloat) {
          useOceanStore.getState().selectFloat(picked.id._argoFloat);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      let mouseMoveRaf = null;
      handler.setInputAction((movement) => {
        if (mouseMoveRaf) cancelAnimationFrame(mouseMoveRaf);
        mouseMoveRaf = requestAnimationFrame(() => {
          if (!viewer || viewer.isDestroyed()) return;
          const ray = viewer.camera.getPickRay(movement.endPosition);
          if (!ray) return;
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (cartesian) {
            const carto = Cesium.Cartographic.fromCartesian(cartesian);
            const lon = Cesium.Math.toDegrees(carto.longitude);
            const lat = Cesium.Math.toDegrees(carto.latitude);
            useOceanStore.setState({ cursorCoords: { lon, lat, depth: 0 } });
          }
        });
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      window.__oceanScreenHandler = handler;
      window.__mouseMoveRaf = mouseMoveRaf;
    } catch (err) {
      console.error('[CesiumOceanViewer] Native initialization error:', err);
    }

    return () => {
      if (window.__mouseMoveRaf) {
        cancelAnimationFrame(window.__mouseMoveRaf);
        window.__mouseMoveRaf = null;
      }
      window.__cesiumViewer = null;
      if (window.__oceanScreenHandler) {
        try {
          window.__oceanScreenHandler.destroy();
        } catch (e) {}
        window.__oceanScreenHandler = null;
      }
      if (viewer && !viewer.isDestroyed()) {
        try {
          viewer.destroy();
        } catch (e) {}
      }
      viewerRef.current = null;
    };
  }, []);

  // Sync Argo Floats as Geospatial Point Entities
  useEffect(() => {
    const viewer = viewerRef.current || window.__cesiumViewer;
    if (!viewer || viewer.isDestroyed()) return;

    if (!window.__argoFloatEntities) {
      window.__argoFloatEntities = [];
    }

    window.__argoFloatEntities.forEach((e) => viewer.entities.remove(e));
    window.__argoFloatEntities = [];

    if (argoFloats && argoFloats.length > 0) {
      argoFloats.forEach((float) => {
        if (!float.latest_position) return;
        const lat = float.latest_position.latitude;
        const lon = float.latest_position.longitude;

        const entity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#38bdf8'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.NONE,
          },
          name: `Argo Float ${float.platform_number}`,
          description: `Source: ${float.source || 'Argo'} | Profiles: ${float.profiles_count || 0}`,
        });
        entity._argoFloat = float;
        window.__argoFloatEntities.push(entity);
      });
    }
  }, [argoFloats]);

  // Sync Camera Navigation Actions
  useEffect(() => {
    const viewer = viewerRef.current || window.__cesiumViewer;
    if (!viewer || viewer.isDestroyed() || !cameraAction) return;

    if (cameraAction === 'fit_indian_ocean') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(78.0, 12.0, 13500000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
        duration: 1.5,
      });
    } else if (cameraAction === 'arabian_sea') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(65.0, 15.0, 4000000),
        duration: 1.5,
      });
    } else if (cameraAction === 'bay_of_bengal') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(90.0, 15.0, 4000000),
        duration: 1.5,
      });
    } else if (cameraAction === 'reset' || cameraAction === 'fit_earth') {
      viewer.camera.flyHome(2);
    }
    clearCameraAction();
  }, [cameraAction, clearCameraAction]);

  // Sync 3D Volume Point Cloud Buffer
  useEffect(() => {
    const viewer = viewerRef.current || window.__cesiumViewer;
    if (!viewer || viewer.isDestroyed() || !volumeBuffer || !volumeMeta) return;

    if (window.__volumePoints) {
      viewer.scene.primitives.remove(window.__volumePoints);
      window.__volumePoints = null;
    }

    if (!volumeBuffer || volumeBuffer.length === 0) return;

    const {
      dimX,
      dimY,
      dimZ,
      minVal,
      maxVal,
      minLon,
      maxLon,
      minLat,
      maxLat,
      minDepth = 0,
      maxDepth = 2000,
    } = volumeMeta;
    const data = volumeBuffer;

    const pointCollection = new Cesium.PointPrimitiveCollection();
    const range = maxVal !== undefined && minVal !== undefined ? maxVal - minVal : 1;

    for (let z = 0; z < dimZ; z += 2) {
      for (let y = 0; y < dimY; y += 2) {
        for (let x = 0; x < dimX; x += 2) {
          const idx = z * (dimX * dimY) + y * dimX + x;
          const val = data[idx];

          if (
            val === undefined ||
            isNaN(val) ||
            val < -900 ||
            val > 1000 ||
            Math.abs(val - -1.0) < 1e-3
          )
            continue;

          let norm = (val - minVal) / (range || 1);
          norm = Math.max(0, Math.min(1, norm));

          const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 3)));
          const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 2)));
          const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 1)));

          const lon = minLon + (x / Math.max(1, dimX - 1)) * (maxLon - minLon);
          const lat = minLat + (y / Math.max(1, dimY - 1)) * (maxLat - minLat);
          const depth = minDepth + (z / Math.max(1, dimZ - 1)) * (maxDepth - minDepth);
          const altitude = -depth * 100;

          pointCollection.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
            color: new Cesium.Color(r, g, b, 0.45),
            pixelSize: 3,
          });
        }
      }
    }

    window.__volumePoints = viewer.scene.primitives.add(pointCollection);

    return () => {
      const v = viewerRef.current || window.__cesiumViewer;
      if (v && !v.isDestroyed() && window.__volumePoints) {
        v.scene.primitives.remove(window.__volumePoints);
        window.__volumePoints = null;
      }
    };
  }, [volumeBuffer, volumeMeta]);

  // Dynamically apply rendering settings to Cesium Viewer
  useEffect(() => {
    const viewer = viewerRef.current || window.__cesiumViewer;
    if (!viewer || viewer.isDestroyed()) return;

    // 1. High-DPI resolution scaling
    viewer.resolutionScale = settings?.highDpi ? Math.min(window.devicePixelRatio || 1, 2) : 1.0;

    // 2. Target FPS cap throttling
    viewer.targetFrameRate = Number(settings?.fpsCap) || 60;

    // 3. Antialiasing (MSAA samples)
    if (viewer.scene) {
      viewer.scene.msaaSamples = settings?.antialiasing ? 4 : 1;
    }

    // 4. Volumetric shadows & solar lighting on globe
    if (viewer.scene?.globe) {
      viewer.scene.globe.enableLighting = Boolean(settings?.volumetricShadows);
    }

    viewer.scene?.requestRender();
  }, [settings]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#030712]">
      <div ref={mountRef} className="w-full h-full absolute top-0 left-0" />
    </div>
  );
};
