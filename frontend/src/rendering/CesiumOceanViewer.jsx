import React, { useEffect, useRef } from 'react';
import { useOceanStore } from '../store/oceanStore';
import '../gods-eye-view/style.css';
import { GEV_HTML } from '../gods-eye-view/GevHtml.js';

export const CesiumOceanViewer = () => {
  const mountRef = useRef(null);
  const initialized = useRef(false);

  // Zustand bindings
  const { viewMode, targetCoordinate, cameraAction, clearCameraAction, argoFloats, volumeBuffer, volumeMeta } = useOceanStore();

  useEffect(() => {
    if (!mountRef.current || initialized.current) return;
    initialized.current = true;
    
    // Inject the HTML
    mountRef.current.innerHTML = GEV_HTML;

    window.__GEV_EMBEDDED__ = true;
    window.__GEV_CONTAINER__ = mountRef.current;

    let cleanup = null;

    import('../gods-eye-view/main.js')
      .then((module) => {
        if (module.initViewer) {
          cleanup = module.initViewer(mountRef.current);
        }
      })
      .catch((err) => {
        console.error("Failed to load God's Eye View module", err);
      });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Sync Argo Floats to Cesium
  useEffect(() => {
    const viewer = window.__godsEyeView?.viewer;
    if (!viewer) return;
    
    // Cesium viewer is available. We can add Argo Floats as Points
    // We should first remove old argo float entities if any.
    if (!window.__argoFloatEntities) {
      window.__argoFloatEntities = [];
    }
    
    window.__argoFloatEntities.forEach(e => viewer.entities.remove(e));
    window.__argoFloatEntities = [];

    if (argoFloats && argoFloats.length > 0) {
      // Import Cesium dynamically or use window.Cesium if available
      import('cesium').then((Cesium) => {
        argoFloats.forEach(float => {
          if (!float.latest_position) return;
          const lat = float.latest_position.latitude;
          const lon = float.latest_position.longitude;
          
          const entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
            point: {
              pixelSize: 10,
              color: Cesium.Color.AQUA,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            name: `Argo Float ${float.platform_number}`,
            description: `Source: ${float.source} <br/> Profiles: ${float.profiles_count}`
          });
          entity._argoFloat = float;
          window.__argoFloatEntities.push(entity);
        });

        // Add Interactive INCOIS Model Domain Footprint on Cesium Globe
        if (!window.__incoisDomainEntity) {
          window.__incoisDomainEntity = viewer.entities.add({
            name: 'INCOIS Model Domain Footprint',
            rectangle: {
              coordinates: Cesium.Rectangle.fromDegrees(50.0, 0.0, 95.0, 26.0),
              material: new Cesium.Color(0.06, 0.72, 0.95, 0.12),
              outline: true,
              outlineColor: new Cesium.Color(0.22, 0.74, 0.97, 0.85),
              outlineWidth: 2,
            },
            description: 'Click to drill down into 3D Volumetric Water Column Analysis',
          });
          window.__incoisDomainEntity._isModelDomain = true;
        }


      });
    }
  }, [argoFloats]);

  // Dedicated Robust Cesium ScreenSpaceEventHandler for Instant Globe Click-to-3D
  useEffect(() => {
    let handler = null;
    let pollInterval = null;
    let isCancelled = false;

    import('cesium').then((Cesium) => {
      if (isCancelled) return;

      const initHandler = () => {
        const viewer = window.__godsEyeView?.viewer;
        if (!viewer || !viewer.canvas) return false;

        if (window.__oceanScreenHandler) {
          try { window.__oceanScreenHandler.destroy(); } catch (e) {}
          window.__oceanScreenHandler = null;
        }

        handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        handler.setInputAction((movement) => {
          // 1. Check if an Argo Float was clicked
          try {
            const picked = viewer.scene.pick(movement.position);
            if (Cesium.defined(picked) && picked.id?._argoFloat) {
              useOceanStore.getState().selectFloat(picked.id._argoFloat);
              return;
            }
          } catch (err) {}

          // 2. Pick coordinates on globe surface
          let lon = 72.5;
          let lat = 13.0;
          let cartesian = null;

          try {
            cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
          } catch (e) {}

          if (!cartesian) {
            try {
              const ray = viewer.camera.getPickRay(movement.position);
              if (ray) cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            } catch (e) {}
          }

          if (cartesian) {
            try {
              const carto = Cesium.Cartographic.fromCartesian(cartesian);
              lon = Cesium.Math.toDegrees(carto.longitude);
              lat = Cesium.Math.toDegrees(carto.latitude);
            } catch (e) {}
          }

          console.log(`[CesiumOceanViewer] Globe LEFT_CLICK at Lon: ${lon.toFixed(2)}, Lat: ${lat.toFixed(2)} -> Switching to 3D Volumetric`);

          useOceanStore.getState().selectRegionAndSwitchTo3D({
            id: 'clicked_sector',
            name: `Sector (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E)`,
            centerLon: lon,
            centerLat: lat,
            minLon: lon - 3.0,
            maxLon: lon + 3.0,
            minLat: lat - 3.0,
            maxLat: lat + 3.0,
            minDepth: 0,
            maxDepth: 2000,
          });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((movement) => {
          try {
            const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
            if (cartesian) {
              const carto = Cesium.Cartographic.fromCartesian(cartesian);
              const lon = Cesium.Math.toDegrees(carto.longitude);
              const lat = Cesium.Math.toDegrees(carto.latitude);
              useOceanStore.setState({ cursorCoords: { lon, lat, depth: 0 } });
            }
          } catch (err) {}
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        window.__oceanScreenHandler = handler;

        // Native DOM click fallback directly on the canvas element
        const onCanvasClick = (evt) => {
          let lon = 72.5;
          let lat = 13.0;
          try {
            const rect = viewer.canvas.getBoundingClientRect();
            const pos = new Cesium.Cartesian2(evt.clientX - rect.left, evt.clientY - rect.top);
            const cartesian = viewer.camera.pickEllipsoid(pos, viewer.scene.globe.ellipsoid);
            if (cartesian) {
              const carto = Cesium.Cartographic.fromCartesian(cartesian);
              lon = Cesium.Math.toDegrees(carto.longitude);
              lat = Cesium.Math.toDegrees(carto.latitude);
            }
          } catch (err) {}

          useOceanStore.getState().selectRegionAndSwitchTo3D({
            id: 'clicked_sector',
            name: `Sector (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E)`,
            centerLon: lon,
            centerLat: lat,
            minLon: lon - 3.0,
            maxLon: lon + 3.0,
            minLat: lat - 3.0,
            maxLat: lat + 3.0,
            minDepth: 0,
            maxDepth: 2000,
          });
        };
        viewer.canvas.addEventListener('click', onCanvasClick);
        viewer.canvas._onOceanClick = onCanvasClick;

        return true;
      };

      if (!initHandler()) {
        pollInterval = setInterval(() => {
          if (initHandler()) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }, 100);
      }
    });

    return () => {
      isCancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (handler) {
        try { handler.destroy(); } catch (e) {}
        handler = null;
      }
      if (window.__oceanScreenHandler) {
        try { window.__oceanScreenHandler.destroy(); } catch (e) {}
        window.__oceanScreenHandler = null;
      }
    };
  }, []);

  // Sync Camera Actions
  useEffect(() => {
    const viewer = window.__godsEyeView?.viewer;
    if (!viewer || !cameraAction) return;

    import('cesium').then((Cesium) => {
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
          destination: Cesium.Cartesian3.fromDegrees(65.0, 15.0, 4000000)
        });
      } else if (cameraAction === 'bay_of_bengal') {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(90.0, 15.0, 4000000)
        });
      } else if (cameraAction === 'reset' || cameraAction === 'fit_earth') {
        viewer.camera.flyHome(2);
      }
      clearCameraAction();
    });
  }, [cameraAction, clearCameraAction]);

  // Sync Volume Data (Point Cloud rendering)
  useEffect(() => {
    const viewer = window.__godsEyeView?.viewer;
    if (!viewer || !volumeBuffer || !volumeMeta) return;

    import('cesium').then((Cesium) => {
      // Remove old points if they exist
      if (window.__volumePoints) {
        viewer.scene.primitives.remove(window.__volumePoints);
        window.__volumePoints = null;
      }

      // If rendering is disabled or buffer is empty, skip
      if (!volumeBuffer || volumeBuffer.length === 0) return;

      const { dimX, dimY, dimZ, minVal, maxVal, minLon, maxLon, minLat, maxLat, minDepth = 0, maxDepth = 2000 } = volumeMeta;
      const data = volumeBuffer;
      
      const pointCollection = new Cesium.PointPrimitiveCollection();
      const range = (maxVal !== undefined && minVal !== undefined) ? (maxVal - minVal) : 1;
      
      // Downsample stride on 64x64x32 grid to keep performance smooth
      for (let z = 0; z < dimZ; z += 2) {
        for (let y = 0; y < dimY; y += 2) {
          for (let x = 0; x < dimX; x += 2) {
            const idx = z * (dimX * dimY) + y * dimX + x;
            const val = data[idx];
            
            // NaN or sentinel check (-1.0 or <-900)
            if (val === undefined || isNaN(val) || val < -900 || val > 1000 || Math.abs(val - (-1.0)) < 1e-3) continue;
            
            // Normalize value to 0..1
            let norm = (val - minVal) / (range || 1);
            norm = Math.max(0, Math.min(1, norm));
            
            // Jet/Turbo approximation
            const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 3)));
            const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 2)));
            const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 1)));

            const lon = minLon + (x / Math.max(1, dimX - 1)) * (maxLon - minLon);
            const lat = minLat + (y / Math.max(1, dimY - 1)) * (maxLat - minLat);
            const depth = minDepth + (z / Math.max(1, dimZ - 1)) * (maxDepth - minDepth);
            
            // Exaggerate depth for visual inspection
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
    });

    return () => {
      const viewer = window.__godsEyeView?.viewer;
      if (viewer && window.__volumePoints) {
        viewer.scene.primitives.remove(window.__volumePoints);
        window.__volumePoints = null;
      }
    };
  }, [volumeBuffer, volumeMeta]);

  const pointerDownPosRef = useRef(null);

  const handlePointerDown = (e) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    if (!pointerDownPosRef.current) return;
    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
    pointerDownPosRef.current = null;

    if (dx < 10 && dy < 10) {
      const viewer = window.__godsEyeView?.viewer;
      let lon = 72.5;
      let lat = 13.0;

      if (viewer && window.Cesium) {
        try {
          const rect = mountRef.current?.getBoundingClientRect();
          const localX = e.clientX - (rect?.left || 0);
          const localY = e.clientY - (rect?.top || 0);
          const pos = new window.Cesium.Cartesian2(localX, localY);
          const cartesian = viewer.camera.pickEllipsoid(pos, viewer.scene.globe.ellipsoid);
          if (cartesian) {
            const carto = window.Cesium.Cartographic.fromCartesian(cartesian);
            lon = window.Cesium.Math.toDegrees(carto.longitude);
            lat = window.Cesium.Math.toDegrees(carto.latitude);
          }
        } catch (err) {}
      }

      useOceanStore.getState().selectRegionAndSwitchTo3D({
        id: 'clicked_sector',
        name: `Sector (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E)`,
        centerLon: lon,
        centerLat: lat,
        minLon: Math.max(30.0, lon - 15.0),
        maxLon: Math.min(120.0, lon + 15.0),
        minLat: Math.max(-30.0, lat - 10.0),
        maxLat: Math.min(30.0, lat + 10.0),
        minDepth: 0,
        maxDepth: 2000,
      });
    }
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#030712] gev-container">
      <div 
        ref={mountRef} 
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className="w-full h-full absolute top-0 left-0 cursor-crosshair" 
      />

      {/* Master Overview Drill-Down Floating HUD */}
      <div className="absolute bottom-20 left-6 z-20 flex flex-col gap-2 p-3.5 bg-slate-950/85 backdrop-blur-md border border-cyan-500/25 rounded-2xl shadow-2xl max-w-xs sm:max-w-sm text-white">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Master: God's Eye Globe
          </span>
          <span className="text-[9px] font-mono text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
            Select Region
          </span>
        </div>
        <p className="text-[11px] text-slate-300 font-light leading-relaxed">
          Click any ocean sector on the globe or select below to drill down into <strong className="text-cyan-300 font-semibold">3D Volumetric Water Column Analysis</strong>.
        </p>
        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
          <button
            onClick={() => useOceanStore.getState().selectRegionAndSwitchTo3D({
              id: 'arabian_sea',
              name: 'Arabian Sea Sector',
              minLon: 52.0,
              maxLon: 77.0,
              minLat: 6.0,
              maxLat: 25.0,
              centerLon: 65.0,
              centerLat: 15.0,
              minDepth: 0,
              maxDepth: 2000,
            })}
            className="px-2 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/40 rounded-xl text-[10px] font-mono text-cyan-200 transition-all text-center hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
          >
            Arabian Sea
          </button>
          <button
            onClick={() => useOceanStore.getState().selectRegionAndSwitchTo3D({
              id: 'bay_of_bengal',
              name: 'Bay of Bengal Sector',
              minLon: 78.0,
              maxLon: 96.0,
              minLat: 6.0,
              maxLat: 24.0,
              centerLon: 88.0,
              centerLat: 15.0,
              minDepth: 0,
              maxDepth: 2000,
            })}
            className="px-2 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/40 rounded-xl text-[10px] font-mono text-cyan-200 transition-all text-center hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
          >
            Bay of Bengal
          </button>
          <button
            onClick={() => useOceanStore.getState().selectRegionAndSwitchTo3D({
              id: 'full_domain',
              name: 'North Indian Ocean Basin',
              minLon: 50.0,
              maxLon: 95.0,
              minLat: 0.0,
              maxLat: 26.0,
              centerLon: 72.5,
              centerLat: 13.0,
              minDepth: 0,
              maxDepth: 2000,
            })}
            className="px-2 py-1.5 bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 rounded-xl text-[10px] font-mono text-sky-200 transition-all text-center hover:shadow-[0_0_12px_rgba(56,189,248,0.3)] cursor-pointer"
          >
            Full Basin
          </button>
        </div>
      </div>
    </div>
  );
};
