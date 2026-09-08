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
          window.__argoFloatEntities.push(entity);
        });
      });
    }
  }, [argoFloats]);

  // Sync Camera Actions
  useEffect(() => {
    const viewer = window.__godsEyeView?.viewer;
    if (!viewer || !cameraAction) return;

    import('cesium').then((Cesium) => {
      if (cameraAction === 'fit_indian_ocean') {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(75.0, 10.0, 8000000)
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

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#030712] gev-container">
      <div 
        ref={mountRef} 
        className="w-full h-full absolute top-0 left-0" 
      />
    </div>
  );
};
