import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useOceanStore } from '../store/oceanStore';
import { VolumeVertexShader, VolumeFragmentShader } from './shaders/VolumeRaymarchingShader';
import {
  Camera,
  RotateCcw,
  Grid,
  Box,
  Crosshair,
  AlertTriangle,
  Compass
} from '../components/Icons';

export const OceanViewer = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const volumeMaterialRef = useRef(null);
  const slicePlaneRef = useRef(null);
  const floatMarkersRef = useRef(null);
  const boxMeshRef = useRef(null);
  const surfaceGridRef = useRef(null);
  const floorGridRef = useRef(null);

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
    argoFloats,
    selectedFloat,
    selectFloat,
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

  // Initialize Three.js WebGL2 Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050811);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(1.6, 1.4, 2.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 7.0;
    controls.minDistance = 0.6;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    dirLight.position.set(2.5, 4.5, 3.5);
    scene.add(dirLight);

    // Bounding Box (Lat 4-26N, Lon 58-96E, Depth 0-2000m)
    const boxGeo = new THREE.BoxGeometry(1.0, 0.6 * verticalExaggeration, 1.0);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 })
    );
    boxMeshRef.current = boxLine;
    boxLine.visible = showBoundingBox;
    scene.add(boxLine);

    // Surface and Floor Bathymetry Grids
    const surfaceGrid = new THREE.GridHelper(1.0, 10, 0x0284c7, 0x1e293b);
    surfaceGrid.position.y = 0.3 * verticalExaggeration;
    surfaceGrid.visible = showGrid;
    surfaceGridRef.current = surfaceGrid;
    scene.add(surfaceGrid);

    const floorGrid = new THREE.GridHelper(1.0, 10, 0x0f766e, 0x0f172a);
    floorGrid.position.y = -0.3 * verticalExaggeration;
    floorGrid.visible = showGrid;
    floorGridRef.current = floorGrid;
    scene.add(floorGrid);

    // Volumetric Raymarching Mesh
    const volGeo = new THREE.BoxGeometry(1.0, 0.6 * verticalExaggeration, 1.0);
    const initialData = new Float32Array(64 * 64 * 32);
    const initialTexture = new THREE.Data3DTexture(initialData, 64, 64, 32);
    initialTexture.format = THREE.RedFormat;
    initialTexture.type = THREE.FloatType;
    initialTexture.minFilter = THREE.LinearFilter;
    initialTexture.magFilter = THREE.LinearFilter;
    initialTexture.unpackAlignment = 1;
    initialTexture.needsUpdate = true;

    const colormapCode = { turbo: 0, viridis: 1, thermal: 2, jet: 3 };

    const volMat = new THREE.ShaderMaterial({
      vertexShader: VolumeVertexShader,
      fragmentShader: VolumeFragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_data: { value: initialTexture },
        u_dim: { value: new THREE.Vector3(64, 64, 32) },
        u_opacity: { value: opacity },
        u_threshold: { value: threshold },
        u_isoValue: { value: isoValue },
        u_renderMode: { value: renderMode === 'iso' ? 1 : 0 },
        u_colormap: { value: colormapCode[colormap] || 0 },
        u_stepSize: { value: 0.008 },
        u_sliceZ: { value: sliceDepthMeters / 2000.0 },
        u_enableSlice: { value: enableSlice ? 1 : 0 },
      },
    });
    volumeMaterialRef.current = volMat;

    const volMesh = new THREE.Mesh(volGeo, volMat);
    scene.add(volMesh);

    // 2D Slicing Plane Wireframe
    const slicePlaneGeo = new THREE.PlaneGeometry(1.0, 1.0);
    slicePlaneGeo.rotateX(-Math.PI / 2);
    const slicePlaneMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const slicePlane = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
    slicePlane.position.y = (0.3 - (sliceDepthMeters / 2000.0) * 0.6) * verticalExaggeration;
    slicePlane.visible = enableSlice;
    slicePlaneRef.current = slicePlane;
    scene.add(slicePlane);

    // Argo Floats Group
    const floatGroup = new THREE.Group();
    floatMarkersRef.current = floatGroup;
    scene.add(floatGroup);

    // Raycasting for Argo Hover & Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(floatGroup.children, true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.platform_number && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.platform_number) {
          const target = argoFloats.find(f => f.platform_number === obj.userData.platform_number);
          setHoveredFloat(target || null);
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredFloat(null);
      container.style.cursor = 'grab';
    };

    const handlePointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(floatGroup.children, true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.platform_number && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.platform_number) {
          const targetFloat = argoFloats.find(f => f.platform_number === obj.userData.platform_number);
          if (targetFloat) {
            selectFloat(targetFloat);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();

      // Read camera angles for HUD
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      setOrbitStats({
        azimuth: Math.round(THREE.MathUtils.radToDeg(spherical.theta)),
        elevation: Math.round(THREE.MathUtils.radToDeg(Math.PI / 2 - spherical.phi)),
        zoom: Math.round(spherical.radius * 10) / 10,
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.dispose();
      initialTexture.dispose();
      volGeo.dispose();
      volMat.dispose();
    };
  }, []);

  // Update Camera Viewpoint from Presets
  useEffect(() => {
    if (!cameraAction || !cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (cameraAction) {
      case 'top':
        camera.position.set(0, 3.2, 0.001);
        controls.target.set(0, 0, 0);
        break;
      case 'front':
        camera.position.set(0, 0.1, 2.8);
        controls.target.set(0, 0, 0);
        break;
      case 'side':
        camera.position.set(2.8, 0.1, 0);
        controls.target.set(0, 0, 0);
        break;
      case 'iso':
        camera.position.set(1.6, 1.4, 2.2);
        controls.target.set(0, 0, 0);
        break;
      case 'reset':
      default:
        camera.position.set(1.6, 1.4, 2.2);
        controls.target.set(0, 0, 0);
        break;
    }
    controls.update();
    clearCameraAction();
  }, [cameraAction, clearCameraAction]);

  // Update 3D Volume Data Texture
  useEffect(() => {
    if (!volumeBuffer || !volumeMeta || !volumeMaterialRef.current) return;

    const { dimX, dimY, dimZ } = volumeMeta;
    const texture = new THREE.Data3DTexture(volumeBuffer, dimX, dimY, dimZ);
    texture.format = THREE.RedFormat;
    texture.type = THREE.FloatType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    if (volumeMaterialRef.current.uniforms.u_data.value) {
      volumeMaterialRef.current.uniforms.u_data.value.dispose();
    }
    volumeMaterialRef.current.uniforms.u_data.value = texture;
    volumeMaterialRef.current.uniforms.u_dim.value = new THREE.Vector3(dimX, dimY, dimZ);
  }, [volumeBuffer, volumeMeta]);

  // Update Uniforms
  useEffect(() => {
    if (!volumeMaterialRef.current) return;
    const colormapCode = { turbo: 0, viridis: 1, thermal: 2, jet: 3 };

    volumeMaterialRef.current.uniforms.u_opacity.value = opacity;
    volumeMaterialRef.current.uniforms.u_threshold.value = threshold;
    volumeMaterialRef.current.uniforms.u_isoValue.value = isoValue;
    volumeMaterialRef.current.uniforms.u_renderMode.value = renderMode === 'iso' ? 1 : 0;
    volumeMaterialRef.current.uniforms.u_colormap.value = colormapCode[colormap] || 0;
    volumeMaterialRef.current.uniforms.u_sliceZ.value = sliceDepthMeters / 2000.0;
    volumeMaterialRef.current.uniforms.u_enableSlice.value = enableSlice ? 1 : 0;

    if (slicePlaneRef.current) {
      slicePlaneRef.current.visible = enableSlice;
      slicePlaneRef.current.position.y = (0.3 - (sliceDepthMeters / 2000.0) * 0.6) * verticalExaggeration;
    }
  }, [opacity, threshold, isoValue, renderMode, colormap, sliceDepthMeters, enableSlice, verticalExaggeration]);

  // Update Grid and Bounding Box Visibility
  useEffect(() => {
    if (surfaceGridRef.current) surfaceGridRef.current.visible = showGrid;
    if (floorGridRef.current) floorGridRef.current.visible = showGrid;
    if (boxMeshRef.current) boxMeshRef.current.visible = showBoundingBox;
  }, [showGrid, showBoundingBox]);

  // Render Argo Float 3D Markers
  useEffect(() => {
    const floatGroup = floatMarkersRef.current;
    if (!floatGroup) return;

    while (floatGroup.children.length > 0) {
      floatGroup.remove(floatGroup.children[0]);
    }

    const minLon = volumeMeta?.minLon ?? 58.0;
    const maxLon = volumeMeta?.maxLon ?? 96.0;
    const minLat = volumeMeta?.minLat ?? 4.0;
    const maxLat = volumeMeta?.maxLat ?? 26.0;

    argoFloats.forEach((float) => {
      const isSelected = selectedFloat?.platform_number === float.platform_number;
      const lonSpan = maxLon > minLon ? (maxLon - minLon) : 1.0;
      const latSpan = maxLat > minLat ? (maxLat - minLat) : 1.0;
      const normX = ((float.latest_position.longitude - minLon) / lonSpan) - 0.5;
      const normZ = ((float.latest_position.latitude - minLat) / latSpan) - 0.5;
      const surfaceY = 0.3 * verticalExaggeration;

      const marker = new THREE.Group();
      marker.userData = { platform_number: float.platform_number };

      // Vertical Trajectory Descent Cable
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(normX, surfaceY, normZ),
        new THREE.Vector3(normX, -0.3 * verticalExaggeration, normZ),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: isSelected ? 0x38bdf8 : 0xf59e0b,
        dashSize: 0.02,
        gapSize: 0.01,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      marker.add(line);

      // Surface Buoy Marker
      const buoyGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.045, 16);
      const buoyMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x38bdf8 : 0xf59e0b,
        roughness: 0.2,
        metalness: 0.8,
        emissive: isSelected ? 0x0284c7 : 0xd97706,
        emissiveIntensity: isSelected ? 0.8 : 0.4,
      });
      const buoy = new THREE.Mesh(buoyGeo, buoyMat);
      buoy.position.set(normX, surfaceY + 0.022, normZ);
      marker.add(buoy);

      // Surface Halo Ring
      const haloGeo = new THREE.RingGeometry(0.02, 0.04, 24);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x38bdf8 : 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.7,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(normX, surfaceY + 0.001, normZ);
      marker.add(halo);

      floatGroup.add(marker);
    });
  }, [argoFloats, selectedFloat, verticalExaggeration, volumeMeta]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Right Camera Viewport Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-lg text-slate-300 shadow-xl">
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('iso')}
          title="Isometric 3D Perspective"
          className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-sky-500 hover:text-sky-300 rounded text-[11px] font-mono transition-colors"
        >
          3D
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('top')}
          title="Top-Down Plan View (North Up)"
          className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-sky-500 hover:text-sky-300 rounded text-[11px] font-mono transition-colors"
        >
          Top
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('front')}
          title="Front Elevation View (Depth Profile)"
          className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-sky-500 hover:text-sky-300 rounded text-[11px] font-mono transition-colors"
        >
          Front
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('side')}
          title="Side Elevation View (Zonal)"
          className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-sky-500 hover:text-sky-300 rounded text-[11px] font-mono transition-colors"
        >
          Side
        </button>
        <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />
        <button
          onClick={toggleGrid}
          title={showGrid ? 'Hide Bathymetric Grid' : 'Show Bathymetric Grid'}
          className={`p-1 rounded border text-xs transition-colors ${
            showGrid ? 'bg-slate-800 border-sky-500/60 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={toggleBoundingBox}
          title={showBoundingBox ? 'Hide Bounding Frame' : 'Show Bounding Frame'}
          className={`p-1 rounded border text-xs transition-colors ${
            showBoundingBox ? 'bg-slate-800 border-sky-500/60 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => useOceanStore.getState().triggerCameraAction('reset')}
          title="Reset Camera Target"
          className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-sky-500 hover:text-sky-300 text-slate-400 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top-Left Viewport Spatial Coordinates & Resolution HUD */}
      <div className="hidden sm:flex absolute top-4 left-80 z-10 items-center gap-3 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 shadow-lg">
        <div className="flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400 text-[11px]">FOV:</span>
          <span className="text-slate-200">ROMS 3D</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="text-[11px] text-slate-400">
          Res: <span className="text-teal-300">64x64x32</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="text-[11px] text-slate-400">
          Z-Span: <span className="text-slate-200">0 to 2000 m</span>
        </div>
      </div>

      {/* Bottom Viewport Camera Orientation Readout */}
      <div className="hidden md:flex absolute bottom-24 right-4 z-10 items-center gap-3 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-lg text-[10px] font-mono text-slate-400 shadow-md">
        <span>AZ: <strong className="text-slate-200">{orbitStats.azimuth}°</strong></span>
        <span>EL: <strong className="text-slate-200">{orbitStats.elevation}°</strong></span>
        <span>R: <strong className="text-slate-200">{orbitStats.zoom}x</strong></span>
        <span className="text-slate-600">|</span>
        <span className="text-[9px] text-slate-500">L-Drag: Rotate | R-Drag: Pan | Scroll: Zoom</span>
      </div>

      {/* Float Hover Tooltip HUD */}
      {hoveredFloat && (
        <div className="absolute top-16 left-80 z-20 px-3 py-2 bg-slate-900/95 border border-amber-500/70 rounded-lg text-xs text-slate-100 shadow-2xl backdrop-blur-md flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Argo Float WMO {hoveredFloat.platform_number}</span>
          </div>
          <div className="text-[11px] text-slate-300 font-mono">
            Lat: {hoveredFloat.latest_position.latitude.toFixed(2)}°N | Lon: {hoveredFloat.latest_position.longitude.toFixed(2)}°E
          </div>
          <div className="text-[10px] text-slate-400">
            Click to inspect in-situ profile & calculate residuals
          </div>
        </div>
      )}

      {/* Loading HUD Banner */}
      {isLoading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-slate-900/95 border border-sky-500/60 rounded-lg text-sky-300 text-xs font-mono shadow-2xl backdrop-blur">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span className="tracking-wide font-bold">{loadingMessage}</span>
        </div>
      )}

      {/* Error & Scientific Dataset Missing State */}
      {errorState && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-lg px-4 py-3 bg-slate-900/95 border border-amber-500/60 rounded-xl text-xs shadow-2xl backdrop-blur flex items-start gap-3 text-slate-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <div className="font-bold text-amber-300 uppercase tracking-wider font-mono">
              Scientific Dataset Notice
            </div>
            <div className="font-mono text-[11px] text-slate-300 leading-relaxed">
              {errorState}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Place real INCOIS ROMS NetCDF in datasets/model/ and Argo files in datasets/argo/
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
