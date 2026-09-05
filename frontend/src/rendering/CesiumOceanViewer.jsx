import React, { useEffect, useRef } from 'react';
import { useOceanStore } from '../store/oceanStore';
import '../gods-eye-view/style.css';
import { GEV_HTML } from '../gods-eye-view/GevHtml.js';

export const CesiumOceanViewer = () => {
  const mountRef = useRef(null);
  const initialized = useRef(false);

  // Zustand bindings
  const { viewMode, targetCoordinate, cameraAction, clearCameraAction, argoFloats, volumeData } = useOceanStore();

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
    if (!viewer || !volumeData) return;

    import('cesium').then((Cesium) => {
      // Remove old points if they exist
      if (window.__volumePoints) {
        viewer.scene.primitives.remove(window.__volumePoints);
        window.__volumePoints = null;
      }

      // If rendering is disabled or mode is invalid, skip
      if (!volumeData.data || volumeData.data.length === 0) return;

      const { data, dimX, dimY, dimZ, minVal, maxVal, minLon, maxLon, minLat, maxLat, minDepth, maxDepth } = volumeData;
      
      const pointCollection = new Cesium.PointPrimitiveCollection();
      
      const range = maxVal - minVal;
      
      // We'll downsample slightly if needed for performance, but 131k points is usually fine.
      // 64x64x32 grid
      for (let z = 0; z < dimZ; z+=2) { // stride 2 on depth to save points
        for (let y = 0; y < dimY; y+=2) {
          for (let x = 0; x < dimX; x+=2) {
            const idx = z * (dimX * dimY) + y * dimX + x;
            const val = data[idx];
            
            // NaN or dummy value check
            if (isNaN(val) || val < -900 || val > 1000) continue;
            
            // Normalize value to 0..1 for coloring (Turbo approximation)
            let norm = (val - minVal) / (range || 1);
            norm = Math.max(0, Math.min(1, norm));
            
            // Jet-like color
            const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 3)));
            const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 2)));
            const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * norm - 1)));

            // Calculate geographical pos
            const lon = minLon + (x / (dimX - 1)) * (maxLon - minLon);
            const lat = minLat + (y / (dimY - 1)) * (maxLat - minLat);
            const depth = minDepth + (z / (dimZ - 1)) * (maxDepth - minDepth);
            
            // depth is usually positive down, we negate it for altitude, but amplify it for visibility
            const altitude = -depth * 100; // exaggerate depth 100x

            pointCollection.add({
              position: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
              color: new Cesium.Color(r, g, b, 0.4),
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
  }, [volumeData]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#030712] gev-container">
      <div 
        ref={mountRef} 
        className="w-full h-full absolute top-0 left-0" 
      />
    </div>
  );
};
