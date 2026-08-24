import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useOceanStore } from '../store/oceanStore';
import { VolumeVertexShader, VolumeFragmentShader } from './shaders/VolumeRaymarchingShader';

export const OceanViewer = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const volumeMaterialRef = useRef(null);
  const slicePlaneRef = useRef(null);
  const floatMarkersRef = useRef(null);
  const boxMeshRef = useRef(null);

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
    selectFloat,
  } = useOceanStore();

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(1.6, 1.4, 2.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 6.0;
    controls.minDistance = 0.8;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // Bounding Box (Lat 4-26N, Lon 58-96E, Depth 0-2000m)
    const boxGeo = new THREE.BoxGeometry(1.0, 0.6 * verticalExaggeration, 1.0);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 }));
    boxMeshRef.current = boxLine;
    scene.add(boxLine);

    const surfaceGrid = new THREE.GridHelper(1.0, 10, 0x0284c7, 0x1e293b);
    surfaceGrid.position.y = 0.3 * verticalExaggeration;
    scene.add(surfaceGrid);

    const floorGrid = new THREE.GridHelper(1.0, 10, 0x0f766e, 0x0f172a);
    floorGrid.position.y = -0.3 * verticalExaggeration;
    scene.add(floorGrid);

    // Volumetric Raymarching Mesh
    const volGeo = new THREE.BoxGeometry(1.0, 0.6 * verticalExaggeration, 1.0);
    const dummyData = new Float32Array(64 * 64 * 32);
    const dummyTexture = new THREE.Data3DTexture(dummyData, 64, 64, 32);
    dummyTexture.format = THREE.RedFormat;
    dummyTexture.type = THREE.FloatType;
    dummyTexture.minFilter = THREE.LinearFilter;
    dummyTexture.magFilter = THREE.LinearFilter;
    dummyTexture.unpackAlignment = 1;
    dummyTexture.needsUpdate = true;

    const colormapCode = { turbo: 0, viridis: 1, thermal: 2, jet: 3 };

    const volMat = new THREE.ShaderMaterial({
      vertexShader: VolumeVertexShader,
      fragmentShader: VolumeFragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_data: { value: dummyTexture },
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

    // 2D Slicing Plane
    const slicePlaneGeo = new THREE.PlaneGeometry(1.0, 1.0);
    slicePlaneGeo.rotateX(-Math.PI / 2);
    const slicePlaneMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const slicePlane = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
    slicePlane.position.y = (0.3 - (sliceDepthMeters / 2000.0) * 0.6) * verticalExaggeration;
    slicePlane.visible = enableSlice;
    slicePlaneRef.current = slicePlane;
    scene.add(slicePlane);

    // Argo Float Group
    const floatGroup = new THREE.Group();
    floatMarkersRef.current = floatGroup;
    scene.add(floatGroup);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

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

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
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
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.dispose();
      dummyTexture.dispose();
      volGeo.dispose();
      volMat.dispose();
    };
  }, []);

  // Update 3D Volume Texture
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

  // Render Argo Float Markers
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
      const lonSpan = maxLon > minLon ? (maxLon - minLon) : 1.0;
      const latSpan = maxLat > minLat ? (maxLat - minLat) : 1.0;
      const normX = ((float.latest_position.longitude - minLon) / lonSpan) - 0.5;
      const normZ = ((float.latest_position.latitude - minLat) / latSpan) - 0.5;
      const surfaceY = 0.3 * verticalExaggeration;

      const marker = new THREE.Group();
      marker.userData = { platform_number: float.platform_number };

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(normX, surfaceY, normZ),
        new THREE.Vector3(normX, -0.3 * verticalExaggeration, normZ),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xf59e0b,
        dashSize: 0.02,
        gapSize: 0.01,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      marker.add(line);

      const buoyGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.04, 16);
      const buoyMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
      });
      const buoy = new THREE.Mesh(buoyGeo, buoyMat);
      buoy.position.set(normX, surfaceY + 0.02, normZ);
      marker.add(buoy);

      const haloGeo = new THREE.RingGeometry(0.02, 0.035, 16);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(normX, surfaceY + 0.001, normZ);
      marker.add(halo);

      floatGroup.add(marker);
    });
  }, [argoFloats, verticalExaggeration]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
