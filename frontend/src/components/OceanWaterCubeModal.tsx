import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useOceanStore } from '../store/useOceanStore';
import { fetchOceanTile, OceanTileData } from '../api/client';
import { renderTileToCanvas, sampleOceanDataAt } from '../rendering/colormaps';
import {
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Play,
  Pause,
  Waves,
  Droplets,
  Wind,
  Activity,
  Box,
  Sparkles,
  Compass,
  ArrowDown,
  AlertTriangle,
  CheckCircle,
  Database,
  Radio
} from 'lucide-react';

export const OceanWaterCubeModal: React.FC = () => {
  const { activeWaterBlockTarget, closeWaterBlock } = useOceanStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // UI state
  const [activeVar, setActiveVar] = useState<'temperature' | 'salinity' | 'currents' | 'chlorophyll'>('temperature');
  const [sliceDepth, setSliceDepth] = useState<number>(0.5);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [showFlowParticles, setShowFlowParticles] = useState<boolean>(true);
  const [showStrataPlanes, setShowStrataPlanes] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [authenticProfile, setAuthenticProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);

  // Authentic Model Tile state (from authoritative C++ ocean_core tile store)
  const [modelTileData, setModelTileData] = useState<OceanTileData | null>(null);
  const [modelTileLoading, setModelTileLoading] = useState<boolean>(false);
  const [modelTileError, setModelTileError] = useState<string | null>(null);
  const [modelSampledValue, setModelSampledValue] = useState<number | null>(null);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Dynamic mesh references
  const cubeMeshRef = useRef<THREE.Mesh | null>(null);
  const laserPlaneRef = useRef<THREE.Group | null>(null);
  const laserPlaneMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const strataGroupRef = useRef<THREE.Group | null>(null);

  // Physical constants of the 3D Cube
  const CUBE_W = 10;
  const CUBE_L = 10;
  const CUBE_H = 14; // Represents 0m at top (y = 7) down to 2000m at bottom (y = -7)
  const MAX_DEPTH = 2000;

  // Convert depth in meters (0 to 2000) to Three.js local Y (-7 to +7)
  const depthToY = (depthMeters: number) => {
    const fraction = Math.min(Math.max(depthMeters, 0), MAX_DEPTH) / MAX_DEPTH;
    return CUBE_H / 2 - fraction * CUBE_H;
  };

  // 1. Procedural Texture Generator for the 4 Vertical Walls
  const generateWallTexture = (variable: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const w = canvas.width;
    const h = canvas.height;

    // Draw ocean depth vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (variable === 'salinity') {
      grad.addColorStop(0.0, '#fde725'); // Surface high salinity (36.5 PSU)
      grad.addColorStop(0.15, '#5ec962'); // Upper halocline
      grad.addColorStop(0.35, '#21918c'); // Mid halocline
      grad.addColorStop(0.65, '#3b528b'); // Deep salinity
      grad.addColorStop(1.0, '#440154'); // Abyssal salinity (34.7 PSU)
    } else if (variable === 'chlorophyll') {
      grad.addColorStop(0.0, '#facc15'); // Photic bloom (2.5 mg/m³)
      grad.addColorStop(0.12, '#10b981'); // Deep chlorophyll max
      grad.addColorStop(0.25, '#0e7490'); // Twilight onset
      grad.addColorStop(0.6, '#0f172a'); // Aphotic zone
      grad.addColorStop(1.0, '#020617'); // Abyss
    } else if (variable === 'currents') {
      grad.addColorStop(0.0, '#f43f5e'); // Surface energetic flow (1.8 m/s)
      grad.addColorStop(0.15, '#eab308'); // Subsurface current
      grad.addColorStop(0.35, '#10b981'); // Decay zone
      grad.addColorStop(0.65, '#06b6d4'); // Slow deep drift
      grad.addColorStop(1.0, '#1e1b4b'); // Abyssal calm (<0.05 m/s)
    } else {
      // Temperature (Turbo)
      grad.addColorStop(0.0, '#d93806'); // Warm surface 29.5°C
      grad.addColorStop(0.12, '#f3c63a'); // Mixed layer 28.0°C
      grad.addColorStop(0.3, '#24eca6'); // Thermocline drop (20°C)
      grad.addColorStop(0.55, '#4675ed'); // Intermediate (10°C)
      grad.addColorStop(1.0, '#30123b'); // Cold abyssal floor (3.2°C)
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Overlay horizontal depth tick lines and annotations
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 13px monospace';

    const ticks = [
      { y: 0.02, text: '0m [SEA SURFACE]' },
      { y: 0.1, text: '-50m [EUPHOTIC BASE]' },
      { y: 0.2, text: '-150m [THERMOCLINE CORE]' },
      { y: 0.4, text: '-500m [INTERMEDIATE WATER]' },
      { y: 0.7, text: '-1000m [DEEP OXYGEN MIN]' },
      { y: 0.96, text: '-2000m [ABYSSAL BASIN]' }
    ];

    ticks.forEach((t) => {
      const yPos = t.y * h;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(w, yPos);
      ctx.stroke();
      ctx.fillText(t.text, 14, Math.max(16, yPos - 4));
    });

    // Technical grid pattern
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Outer neon border
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, w, h);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  };

  // 2. Procedural Sea Surface Texture
  const generateSurfaceTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#062846';
    ctx.fillRect(0, 0, 256, 256);

    // Oceanic wave ripples
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 256; i += 16) {
      ctx.beginPath();
      ctx.arc(128, 128, i, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Compass rose cross
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(128, 20);
    ctx.lineTo(128, 236);
    ctx.moveTo(20, 128);
    ctx.lineTo(236, 128);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('N ▲', 120, 24);

    return new THREE.CanvasTexture(canvas);
  };

  // 3. Procedural Abyssal Floor Texture
  const generateFloorTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('BENTHIC SEABED [-2000m]', 45, 132);

    return new THREE.CanvasTexture(canvas);
  };

  // Mount Three.js Scene
  useEffect(() => {
    if (!activeWaterBlockTarget || !canvasRef.current) return;

    const width = canvasRef.current.clientWidth;
    const height = canvasRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(16, 11, 20);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 50;
    controls.minDistance = 6;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00e5ff, 1.2);
    dirLight1.position.set(20, 30, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // 6. Create 3D Ocean Cube Mesh
    const wallTex = generateWallTexture(activeVar);
    const surfaceTex = generateSurfaceTexture();
    const floorTex = generateFloorTexture();

    const materials = [
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }), // +X (East)
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }), // -X (West)
      new THREE.MeshStandardMaterial({ map: surfaceTex, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.92 }), // +Y (Surface)
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8, metalness: 0.1, transparent: true, opacity: 0.95 }), // -Y (Abyssal Floor)
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }), // +Z (South)
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 })  // -Z (North)
    ];

    const boxGeo = new THREE.BoxGeometry(CUBE_W, CUBE_H, CUBE_L);
    const cubeMesh = new THREE.Mesh(boxGeo, materials);
    scene.add(cubeMesh);
    cubeMeshRef.current = cubeMesh;

    // Outer wireframe edge lines
    const wireframeGeo = new THREE.EdgesGeometry(boxGeo);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 2 });
    const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
    cubeMesh.add(wireframe);

    // 7. Dynamic Slicing Laser Plane
    const laserGroup = new THREE.Group();
    const laserPlaneGeo = new THREE.PlaneGeometry(CUBE_W * 0.99, CUBE_L * 0.99);
    laserPlaneGeo.rotateX(-Math.PI / 2);
    const laserPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const laserPlaneMesh = new THREE.Mesh(laserPlaneGeo, laserPlaneMat);
    laserGroup.add(laserPlaneMesh);
    laserPlaneMeshRef.current = laserPlaneMesh;

    // Glowing laser border
    const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_W * 0.99, 0.05, CUBE_L * 0.99));
    const borderMat = new THREE.LineBasicMaterial({ color: 0x39ff14, linewidth: 2 });
    const borderLines = new THREE.LineSegments(borderGeo, borderMat);
    laserGroup.add(borderLines);

    laserGroup.position.y = depthToY(sliceDepth);
    scene.add(laserGroup);
    laserPlaneRef.current = laserGroup;

    // 8. Static Stratification Planes
    const strataGroup = new THREE.Group();
    const strataDepths = [
      { depth: 50, color: 0x00e5ff, opacity: 0.12 },
      { depth: 150, color: 0x10b981, opacity: 0.14 },
      { depth: 500, color: 0xa855f7, opacity: 0.16 },
      { depth: 1000, color: 0x3b82f6, opacity: 0.18 }
    ];

    strataDepths.forEach((st) => {
      const pGeo = new THREE.PlaneGeometry(CUBE_W * 0.98, CUBE_L * 0.98);
      pGeo.rotateX(-Math.PI / 2);
      const pMat = new THREE.MeshBasicMaterial({
        color: st.color,
        transparent: true,
        opacity: st.opacity,
        side: THREE.DoubleSide
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.y = depthToY(st.depth);

      // Border outline
      const pBorder = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_W * 0.98, 0.02, CUBE_L * 0.98)),
        new THREE.LineBasicMaterial({ color: st.color, transparent: true, opacity: 0.4 })
      );
      pMesh.add(pBorder);
      strataGroup.add(pMesh);
    });
    scene.add(strataGroup);
    strataGroupRef.current = strataGroup;

    // 9. Animated Subsurface Current Flow Particles
    const particleCount = 450;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      particlePositions[idx] = (Math.random() - 0.5) * (CUBE_W - 0.8);
      particlePositions[idx + 1] = (Math.random() - 0.5) * (CUBE_H - 0.8);
      particlePositions[idx + 2] = (Math.random() - 0.5) * (CUBE_L - 0.8);

      // Depth attenuation: particles near surface move much faster!
      const depthFraction = (CUBE_H / 2 - particlePositions[idx + 1]) / CUBE_H;
      const speed = Math.max(0.015, (1.0 - depthFraction) * 0.08);

      particleVelocities[idx] = speed; // Flow in +X direction (eastward drift)
      particleVelocities[idx + 1] = (Math.random() - 0.5) * 0.005; // Vertical turbulence
      particleVelocities[idx + 2] = (Math.random() - 0.5) * 0.01;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.18,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    // 10. Corner Depth Ruler Pillars
    const pillarMat = new THREE.LineDashedMaterial({
      color: 0x00e5ff,
      dashSize: 0.5,
      gapSize: 0.3
    });
    const corners = [
      [-CUBE_W / 2, -CUBE_L / 2],
      [CUBE_W / 2, -CUBE_L / 2],
      [CUBE_W / 2, CUBE_L / 2],
      [-CUBE_W / 2, CUBE_L / 2]
    ];
    corners.forEach(([cx, cz]) => {
      const points = [
        new THREE.Vector3(cx, CUBE_H / 2, cz),
        new THREE.Vector3(cx, -CUBE_H / 2, cz)
      ];
      const pGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(pGeo, pillarMat);
      line.computeLineDistances();
      scene.add(line);
    });

    // 11. Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Auto-rotation around vertical axis
      if (isAutoRotating && controlsRef.current) {
        cubeMesh.rotation.y += 0.003;
        strataGroup.rotation.y += 0.003;
        laserGroup.rotation.y += 0.003;
        particles.rotation.y += 0.003;
      }

      // Animate current flow particles
      if (particlesRef.current && showFlowParticles) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          positions[idx] += particleVelocities[idx];
          positions[idx + 1] += particleVelocities[idx + 1];
          positions[idx + 2] += particleVelocities[idx + 2];

          // Wrap around X boundary
          if (positions[idx] > (CUBE_W / 2 - 0.4)) {
            positions[idx] = -CUBE_W / 2 + 0.4;
          }
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Window resize handler
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = canvasRef.current.clientWidth;
      const newH = canvasRef.current.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
    };
  }, [activeWaterBlockTarget, activeVar]);

  // Update Laser Slicing Plane when depth slider changes
  useEffect(() => {
    if (laserPlaneRef.current) {
      laserPlaneRef.current.position.y = depthToY(sliceDepth);
    }
  }, [sliceDepth]);

  // Toggle Visibility of Particles & Strata
  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.visible = showFlowParticles;
    }
  }, [showFlowParticles]);

  useEffect(() => {
    if (strataGroupRef.current) {
      strataGroupRef.current.visible = showStrataPlanes;
    }
  }, [showStrataPlanes]);

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(16, 11, 20);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Fetch authentic gridded ocean model depth slice (Strict real-data zero-synthetic policy)
  useEffect(() => {
    let isMounted = true;
    setModelTileLoading(true);
    setModelTileError(null);

    // In CMEMS and INCOIS-BIO-ROMS, only depth 0.0-0.5m is authentically present in source NetCDFs
    const targetDepth = sliceDepth <= 0.5 ? 0.5 : sliceDepth;

    fetchOceanTile(activeVar, '2024-06-01', targetDepth)
      .then((tile) => {
        if (!isMounted) return;
        setModelTileData(tile);
        setModelTileLoading(false);
        if (activeWaterBlockTarget) {
          const sample = sampleOceanDataAt(tile, activeWaterBlockTarget.lon, activeWaterBlockTarget.lat);
          setModelSampledValue(sample.value);
        }
        // Render authentic tile directly onto Three.js laser plane and surface mesh
        try {
          const canvas = renderTileToCanvas(tile);
          const tileTex = new THREE.CanvasTexture(canvas);
          tileTex.wrapS = THREE.ClampToEdgeWrapping;
          tileTex.wrapT = THREE.ClampToEdgeWrapping;
          if (laserPlaneMeshRef.current) {
            (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).map = tileTex;
            (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
            (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.95;
            (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
          }
          if (cubeMeshRef.current && Array.isArray(cubeMeshRef.current.material)) {
            const topMat = cubeMeshRef.current.material[2] as THREE.MeshStandardMaterial;
            topMat.map = tileTex;
            topMat.needsUpdate = true;
          }
          if (typeof window !== 'undefined') {
            (window as any).__OCEAN_VERIFICATION__ = (window as any).__OCEAN_VERIFICATION__ || {};
            (window as any).__OCEAN_VERIFICATION__.modalTileData = tile;
            (window as any).__OCEAN_VERIFICATION__.laserPlaneMesh = laserPlaneMeshRef.current;
            (window as any).__OCEAN_VERIFICATION__.cubeMesh = cubeMeshRef.current;
            (window as any).__OCEAN_VERIFICATION__.renderer = rendererRef.current;
            (window as any).__OCEAN_VERIFICATION__.scene = sceneRef.current;
            (window as any).__OCEAN_VERIFICATION__.camera = cameraRef.current;
          }
        } catch (e) {
          console.error('[ThreeJS] Colormap texture generation error:', e);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setModelTileData(null);
        setModelSampledValue(null);
        setModelTileLoading(false);
        const errMsg = `No authentic gridded model slice at depth ${sliceDepth}m (Source NetCDF contains depth: 1 at 0.0m). Synthetic subsurface interpolation strictly forbidden.`;
        setModelTileError(errMsg);
        if (typeof window !== 'undefined') {
          (window as any).__OCEAN_VERIFICATION__ = (window as any).__OCEAN_VERIFICATION__ || {};
          (window as any).__OCEAN_VERIFICATION__.modalTileData = null;
          (window as any).__OCEAN_VERIFICATION__.modalTileError = errMsg;
        }
        if (laserPlaneMeshRef.current) {
          (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).map = null;
          (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).color.setHex(0x00e5ff);
          (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.20;
          (laserPlaneMeshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeVar, sliceDepth, activeWaterBlockTarget]);

  // Fetch authentic instrument profile for this water column target (NO synthetic generation)
  useEffect(() => {
    if (!activeWaterBlockTarget) return;

    let isMounted = true;
    setProfileLoading(true);

    const loadProfile = async () => {
      try {
        let instId = activeWaterBlockTarget.instrumentId;
        if (!instId) {
          const res = await fetch('/api/instruments');
          if (res.ok) {
            const data = await res.json();
            const features = data.features || [];
            let bestDist = 4.0;
            let bestId = null;
            for (const f of features) {
              const [fLon, fLat] = f.geometry?.coordinates || [0, 0];
              const dist = Math.hypot(fLon - activeWaterBlockTarget.lon, fLat - activeWaterBlockTarget.lat);
              if (dist < bestDist) {
                bestDist = dist;
                bestId = f.properties?.external_id || f.properties?.id;
              }
            }
            instId = bestId;
          }
        }

        if (instId) {
          const res = await fetch(`/api/instruments/${encodeURIComponent(instId)}/profile`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted) {
              setAuthenticProfile(data);
              setProfileLoading(false);
              return;
            }
          }
        }

        if (isMounted) {
          setAuthenticProfile(null);
          setProfileLoading(false);
        }
      } catch {
        if (isMounted) {
          setAuthenticProfile(null);
          setProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [activeWaterBlockTarget]);

  if (!activeWaterBlockTarget) return null;

  // Authentic Observations: Sample closest in-situ measurement without mathematical synthesis
  const measurements: any[] = authenticProfile?.measurements || [];
  let closestMeas: any = null;
  if (measurements.length > 0) {
    let minDiff = 100.0;
    for (const m of measurements) {
      const diff = Math.abs(m.depth - sliceDepth);
      if (diff < minDiff) {
        minDiff = diff;
        closestMeas = m;
      }
    }
  }

  const tempAtDepth: number | null = closestMeas?.temperature ?? null;
  const salinityAtDepth: number | null = closestMeas?.salinity ?? null;
  const currentSpeedAtDepth: number | null = closestMeas?.currentSpeed ?? null;
  const chlAtDepth: number | null = closestMeas?.chlorophyll ?? null;

  // Sound speed (Mackenzie equation) computed strictly on authentic in-situ readings
  const soundSpeed: number | null = (tempAtDepth !== null && salinityAtDepth !== null)
    ? 1448.96 + 4.591 * tempAtDepth - 0.05304 * Math.pow(tempAtDepth, 2) + 1.34 * (salinityAtDepth - 35) + 0.0163 * (closestMeas?.depth ?? sliceDepth)
    : null;

  return (
    <div className={`fixed z-50 transition-all duration-300 flex flex-col bg-ocean-dark/95 backdrop-blur-2xl border border-cyan-500/40 shadow-2xl overflow-hidden ${
      isFullscreen
        ? 'inset-2 rounded-2xl'
        : 'right-6 top-16 bottom-16 w-[940px] max-w-[calc(100vw-3rem)] rounded-2xl'
    }`}>
      {/* 1. Studio Header */}
      <div className="p-3.5 border-b border-ocean-border/80 flex items-center justify-between bg-ocean-panel/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/30 to-blue-600/30 border border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20">
            <Box className="w-5 h-5 animate-pulse text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40">
                3D Volumetric Ocean Block Studio
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                [0m Surface ➔ -2000m Abyssal Floor]
              </span>
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide mt-0.5 flex items-center gap-2">
              <span>{activeWaterBlockTarget.name || 'Ocean Water Column'}</span>
              <span className="text-xs font-mono text-cyan-400 font-normal">
                ({activeWaterBlockTarget.lat.toFixed(2)}°N, {activeWaterBlockTarget.lon.toFixed(2)}°E)
              </span>
            </h2>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition ${
              isAutoRotating
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'text-slate-400 hover:text-white border-ocean-border hover:bg-white/5'
            }`}
            title="Toggle continuous 3D auto-rotation"
          >
            {isAutoRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline text-[10px]">Auto-Orbit</span>
          </button>

          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-lg border border-ocean-border hover:border-ocean-accent text-slate-400 hover:text-white transition"
            title="Reset 3D camera angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-ocean-border hover:border-ocean-accent text-slate-400 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={closeWaterBlock}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/40 transition ml-1"
            title="Close 3D Block View"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Main Body: 3D Viewport + Telemetry Panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Three.js 3D Viewport */}
        <div className="flex-1 relative h-64 md:h-auto bg-gradient-to-b from-[#020713] to-[#01040a]">
          <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing outline-none" />

          {/* Mouse Orbit Hint */}
          <div className="absolute top-3 left-3 pointer-events-none bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] text-slate-300 font-mono flex items-center gap-1.5 shadow-md">
            <Compass className="w-3 h-3 text-cyan-400 animate-spin" />
            <span>Drag mouse to 3D Orbit • Scroll to Zoom</span>
          </div>

          {/* Slicing Laser Plane Float Badge */}
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-400/60 text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>LASER SCAN DEPTH: <strong className="text-white font-bold">{sliceDepth}m</strong></span>
          </div>
        </div>

        {/* Right Side: Oceanographic Telemetry & Physical Stratification */}
        <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-ocean-border/80 bg-ocean-dark/70 backdrop-blur-md p-3.5 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar">
          {/* 1. ROMS / CMEMS Gridded Numerical Model Volume */}
          <div className="bg-ocean-panel/80 p-3 rounded-xl border border-cyan-500/40 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                ROMS/CMEMS Gridded Model
              </span>
              <span className="font-mono text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-500/20 text-[10px]">
                {sliceDepth <= 0.5 ? '0.0m Surface' : `${sliceDepth}m Subsurface`}
              </span>
            </div>

            {modelTileLoading ? (
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Loading C++ ocean_core gridded tile...</span>
              </div>
            ) : modelSampledValue !== null && modelTileData ? (
              <div className="space-y-1.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Authentic C++ Model Grid Cell
                  </span>
                  <span className="font-bold text-white">
                    {modelSampledValue.toFixed(4)} {activeVar === 'temperature' ? '°C' : activeVar === 'salinity' ? 'PSU' : activeVar === 'currents' ? 'm/s' : 'mg/m³'}
                  </span>
                </div>
                <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between px-1">
                  <span>Grid: {modelTileData.header.width}×{modelTileData.header.height} ({modelTileData.header.width * modelTileData.header.height} cells)</span>
                  <span>Source: {activeVar === 'chlorophyll' ? 'INCOIS-BIO-ROMS' : 'CMEMS.nc'}</span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[10px] font-mono text-amber-200 space-y-1">
                <div className="flex items-start gap-1.5 font-bold text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>No Gridded Model Level at {sliceDepth}m</span>
                </div>
                <p className="text-[9px] text-slate-300 leading-relaxed">
                  {modelTileError || (
                    <>Source NetCDF contains single surface level (<code className="text-amber-300">depth: 1</code> at 0.0m). Per strict scientific integrity policy, subsurface model levels are <strong>never fabricated or interpolated</strong>.</>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* 2. Autonomous In-Situ Argo CTD Profiler Observations */}
          <div className="bg-ocean-panel/80 p-3 rounded-xl border border-emerald-500/40 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                Argo In-Situ CTD Observations
              </span>
              <span className="font-mono text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px]">
                {sliceDepth}m Target
              </span>
            </div>

            {/* Authentic Provenance Status */}
            {profileLoading ? (
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Querying authentic in-situ CTD profile...</span>
              </div>
            ) : authenticProfile ? (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">
                  Float: {authenticProfile.external_id} (QC Flags 1 &amp; 2)
                </span>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  No in-situ CTD float collocated at this coordinate.
                </span>
              </div>
            )}

            <div className="space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/5">
                <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                  <Waves className="w-3 h-3 text-red-400" /> Temperature:
                </span>
                {tempAtDepth !== null ? (
                  <span className="text-red-400 font-bold">{tempAtDepth.toFixed(3)} °C <span className="text-[9px] text-slate-400 font-normal">(@{closestMeas?.depth?.toFixed(1)}m)</span></span>
                ) : (
                  <span className="text-slate-500 italic text-[10px]">No authentic data</span>
                )}
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/5">
                <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                  <Droplets className="w-3 h-3 text-cyan-400" /> Salinity:
                </span>
                {salinityAtDepth !== null ? (
                  <span className="text-cyan-300 font-bold">{salinityAtDepth.toFixed(3)} PSU <span className="text-[9px] text-slate-400 font-normal">(@{closestMeas?.depth?.toFixed(1)}m)</span></span>
                ) : (
                  <span className="text-slate-500 italic text-[10px]">No authentic data</span>
                )}
              </div>

              {currentSpeedAtDepth !== null && (
                <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/5">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Wind className="w-3 h-3 text-lime-400" /> Current Velocity:
                  </span>
                  <span className="text-lime-400 font-bold">{currentSpeedAtDepth.toFixed(2)} m/s</span>
                </div>
              )}

              {chlAtDepth !== null && (
                <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/5">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Activity className="w-3 h-3 text-emerald-400" /> Chlorophyll-a:
                  </span>
                  <span className="text-emerald-400 font-bold">{chlAtDepth.toFixed(2)} mg/m³</span>
                </div>
              )}

              <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/5">
                <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Sound Speed:
                </span>
                {soundSpeed !== null ? (
                  <span className="text-amber-300 font-bold">{soundSpeed.toFixed(1)} m/s</span>
                ) : (
                  <span className="text-slate-500 italic text-[10px]">No authentic data</span>
                )}
              </div>
            </div>

            <p className="text-[9px] text-slate-400 italic pt-1 border-t border-white/5">
              * Scientifically Distinct: In-situ Argo CTD profiles measure authentic physical depth (0–2000m), whereas Eulerian model in cmems.nc is surface-only (0.0m).
            </p>
          </div>

          {/* Vertical Stratification Layers */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
              Water Mass Stratification
            </span>
            <div className="space-y-1 text-[10px] font-mono">
              <div className={`p-1.5 rounded border transition ${
                sliceDepth <= 50 ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold' : 'bg-black/30 border-white/5 text-slate-400'
              }`}>
                0 – 50m: Euphotic Mixed Layer (Sunlit &amp; Warm)
              </div>
              <div className={`p-1.5 rounded border transition ${
                sliceDepth > 50 && sliceDepth <= 200 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold' : 'bg-black/30 border-white/5 text-slate-400'
              }`}>
                50 – 200m: Thermocline Rapid Gradient
              </div>
              <div className={`p-1.5 rounded border transition ${
                sliceDepth > 200 && sliceDepth <= 1000 ? 'bg-purple-500/20 border-purple-400 text-purple-200 font-bold' : 'bg-black/30 border-white/5 text-slate-400'
              }`}>
                200 – 1000m: Intermediate Oxygen Minimum Layer
              </div>
              <div className={`p-1.5 rounded border transition ${
                sliceDepth > 1000 ? 'bg-blue-500/20 border-blue-400 text-blue-200 font-bold' : 'bg-black/30 border-white/5 text-slate-400'
              }`}>
                1000 – 2000m: Deep Abyssal Cold Water (3.2°C)
              </div>
            </div>
          </div>

          {/* 3D Visual Feature Toggles */}
          <div className="pt-2 border-t border-ocean-border/60 space-y-2">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
              3D Cube Overlays
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                onClick={() => setShowFlowParticles(!showFlowParticles)}
                className={`py-1 px-2 rounded-lg border text-[10px] font-mono transition ${
                  showFlowParticles
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'
                }`}
              >
                🌊 Particles: {showFlowParticles ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setShowStrataPlanes(!showStrataPlanes)}
                className={`py-1 px-2 rounded-lg border text-[10px] font-mono transition ${
                  showStrataPlanes
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'
                }`}
              >
                📊 Strata: {showStrataPlanes ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Controls: Variable Tabs + Interactive Depth Slider */}
      <div className="p-3 border-t border-ocean-border/80 bg-ocean-panel/90 flex flex-col gap-2.5">
        {/* Variable Switcher Tabs */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveVar('temperature')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeVar === 'temperature'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white bg-ocean-dark/60 border border-ocean-border/40'
              }`}
            >
              <Waves className="w-3.5 h-3.5 text-red-400" />
              <span>Temperature</span>
            </button>

            <button
              onClick={() => setActiveVar('salinity')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeVar === 'salinity'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white bg-ocean-dark/60 border border-ocean-border/40'
              }`}
            >
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Salinity</span>
            </button>

            <button
              onClick={() => setActiveVar('currents')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeVar === 'currents'
                  ? 'bg-lime-500/20 text-lime-300 border border-lime-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white bg-ocean-dark/60 border border-ocean-border/40'
              }`}
            >
              <Wind className="w-3.5 h-3.5 text-lime-400" />
              <span>Current Vectors</span>
            </button>

            <button
              onClick={() => setActiveVar('chlorophyll')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeVar === 'chlorophyll'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-white bg-ocean-dark/60 border border-ocean-border/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Chlorophyll-a</span>
            </button>
          </div>

          {/* Quick Depth Presets */}
          <div className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-slate-400">
            <span>Quick:</span>
            {[0, 50, 150, 500, 1000, 2000].map((d) => (
              <button
                key={d}
                onClick={() => setSliceDepth(d)}
                className={`px-1.5 py-0.5 rounded border transition ${
                  sliceDepth === d
                    ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold'
                    : 'bg-black/30 border-white/5 hover:border-white/20'
                }`}
              >
                {d === 0 ? '0m' : `${d}m`}
              </button>
            ))}
          </div>
        </div>

        {/* Depth Slicing Slider */}
        <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
          <span className="text-xs font-mono text-cyan-400 flex items-center gap-1 shrink-0">
            <ArrowDown className="w-3.5 h-3.5" />
            3D Vertical Laser Slice:
          </span>
          <input
            type="range"
            min="0"
            max="2000"
            step="10"
            value={sliceDepth}
            onChange={(e) => setSliceDepth(parseFloat(e.target.value))}
            className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <span className="text-xs font-mono text-white font-bold w-16 text-right">
            {sliceDepth === 0 ? '0m' : `-${sliceDepth}m`}
          </span>
        </div>
      </div>
    </div>
  );
};
