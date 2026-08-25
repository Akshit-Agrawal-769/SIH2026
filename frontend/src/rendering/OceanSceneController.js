/**
 * OceanSceneController Deep Module
 * Encapsulates the Three.js WebGL2 scene graph:
 * - Volumetric raymarching shader pipelines (Float32 Data3DTexture)
 * - Realistic Gerstner ocean water surface with specular lighting
 * - Atmospheric sky dome and sun illumination
 * - Procedural bathymetric relief floor and contour grids
 * - Autonomous floating marine intelligence station & mooring infrastructure
 * - GPU particle current flow streamlines (u, v vectors)
 * - Natural Earth 10m land polygons & coastline vector layers
 * - In-situ Argo profiling floats with acoustic beacon pulses
 * - Cinematic and tactical camera systems with smooth interpolations
 * - Unified geographic coordinate transformations
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VolumeVertexShader, VolumeFragmentShader } from './shaders/VolumeRaymarchingShader';
import { RealisticWaterSurface } from './environment/RealisticWaterSurface';
import { AtmosphericSkyDome } from './environment/AtmosphericSkyDome';
import { BathymetricFloor } from './environment/BathymetricFloor';
import { MarinePlatform } from './infrastructure/MarinePlatform';
import { CurrentVectorField } from './layers/CurrentVectorField';
import { CoastlineLayer } from './layers/CoastlineLayer';
import { LandLayer } from './layers/LandLayer';
import {
  lonLatToWorld,
  worldToLonLat,
  DEFAULT_INDIAN_OCEAN_BOUNDS,
  DEFAULT_GEOMETRY_SCALE,
} from '../utils/geography';

const COLORMAP_CODES = { turbo: 0, viridis: 1, thermal: 2, jet: 3 };

export class OceanSceneController {
  constructor(container, options = {}) {
    this.container = container;
    this.onHoverFloat = options.onHoverFloat || (() => {});
    this.onSelectFloat = options.onSelectFloat || (() => {});
    this.onOrbitChange = options.onOrbitChange || (() => {});
    this.onSelectPlatform = options.onSelectPlatform || (() => {});
    this.onSampleProbe = options.onSampleProbe || (() => {});
    this.onSelectCoordinate = options.onSelectCoordinate || (() => {});

    this.argoFloats = [];
    this.selectedFloat = null;
    this.verticalExaggeration = 1.0;
    this.volumeMeta = null;
    this.volumeBuffer = null;

    // ~3:2 Natural Indian Ocean Geographic Proportions (90 deg Lon / 60 deg Lat = 1.5)
    this.xScale = DEFAULT_GEOMETRY_SCALE.xScale; // 1.8
    this.zScale = DEFAULT_GEOMETRY_SCALE.zScale; // 1.2
    this.bounds = { ...DEFAULT_INDIAN_OCEAN_BOUNDS };

    this.clock = new THREE.Clock();
    this.animationId = null;
    this.isDisposed = false;

    // Camera target interpolation state
    this.cameraTargetPos = null;
    this.controlsTargetPos = null;
    this.isCameraLerping = false;

    this._initScene();
  }

  _initScene() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040814);
    this.scene.fog = new THREE.FogExp2(0x040915, 0.06);

    // 2. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Default perspective framing the full Indian Ocean domain in ~3:2 aspect ratio
    this.camera.position.set(0, 3.2, 1.8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 7.5;
    this.controls.minDistance = 0.3;
    this.controls.target.set(0, 0, 0);

    // 3. Lighting (Atmospheric Sun & Ocean Ambient)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
    this.scene.add(ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xbae6fd, 1.6);
    this.dirLight.position.set(3.0, 5.0, 4.0);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    // 4. Atmospheric Sky Dome
    this.skyDome = new AtmosphericSkyDome();
    this.scene.add(this.skyDome.mesh);

    // 5. Realistic Ocean Water Surface (Gerstner Waves in ~3:2 Aspect Ratio)
    this.waterSurface = new RealisticWaterSurface({
      size: 2.4,
      segments: 96,
      yPosition: 0.3 * this.verticalExaggeration,
    });
    this.waterSurface.mesh.scale.set(this.xScale / 2.0, 1.0, this.zScale / 2.0);
    this.scene.add(this.waterSurface.mesh);

    // 6. Bathymetric Sea Floor Relief
    this.bathymetricFloor = new BathymetricFloor({
      size: 2.4,
      segments: 64,
      yPosition: -0.3 * this.verticalExaggeration,
    });
    this.bathymetricFloor.group.scale.set(this.xScale / 2.0, 1.0, this.zScale / 2.0);
    this.scene.add(this.bathymetricFloor.group);

    // 7. Layer Hierarchy (Phase 8): LAND -> COASTLINE -> OCEAN
    // 7a. Authentic Natural Earth 10m Land Polygons (Subtle, dark, low visual dominance)
    this.landLayer = new LandLayer({
      yLevel: 0.301 * this.verticalExaggeration,
      xScale: this.xScale,
      zScale: this.zScale,
      bounds: this.bounds,
    });
    this.scene.add(this.landLayer.group);

    // 7b. Authentic Natural Earth 10m Coastlines Layer (Thin, precise, crisp line)
    this.coastlineLayer = new CoastlineLayer({
      yLevel: 0.303 * this.verticalExaggeration,
      xScale: this.xScale,
      zScale: this.zScale,
      bounds: this.bounds,
    });
    this.scene.add(this.coastlineLayer.group);

    // 8. Floating Oceanographic Intelligence Platform
    this.marinePlatform = new MarinePlatform({
      position: new THREE.Vector3(0.18, 0.3 * this.verticalExaggeration, 0.12),
    });
    this.scene.add(this.marinePlatform.group);

    // 9. GPU Ocean Surface Current Velocity Streamlines (u, v)
    this.currentVectors = new CurrentVectorField({
      count: 2400,
      yLevel: 0.302 * this.verticalExaggeration,
    });
    this.currentVectors.mesh.scale.set(this.xScale / 2.0, 1.0, this.zScale / 2.0);
    this.scene.add(this.currentVectors.mesh);

    // 10. Bounding Frame & Reference Grids
    this.boxGeo = new THREE.BoxGeometry(this.xScale, 0.6 * this.verticalExaggeration, this.zScale);
    this.boxEdges = new THREE.EdgesGeometry(this.boxGeo);
    this.boxLine = new THREE.LineSegments(
      this.boxEdges,
      new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 1 })
    );
    this.scene.add(this.boxLine);

    this.surfaceGrid = new THREE.GridHelper(this.xScale, 18, 0x0284c7, 0x1e293b);
    this.surfaceGrid.scale.set(1.0, 1.0, this.zScale / this.xScale);
    this.surfaceGrid.position.y = 0.3 * this.verticalExaggeration;
    this.scene.add(this.surfaceGrid);

    this.floorGrid = new THREE.GridHelper(this.xScale, 18, 0x0f766e, 0x0f172a);
    this.floorGrid.scale.set(1.0, 1.0, this.zScale / this.xScale);
    this.floorGrid.position.y = -0.3 * this.verticalExaggeration;
    this.scene.add(this.floorGrid);

    // 11. 3D Volumetric Raymarching Data Texture & Mesh
    this.volGeo = new THREE.BoxGeometry(this.xScale, 0.6 * this.verticalExaggeration, this.zScale);
    this.initialData = new Float32Array(64 * 64 * 32);
    this.volumeTexture = new THREE.Data3DTexture(this.initialData, 64, 64, 32);
    this.volumeTexture.format = THREE.RedFormat;
    this.volumeTexture.type = THREE.FloatType;
    this.volumeTexture.minFilter = THREE.LinearFilter;
    this.volumeTexture.magFilter = THREE.LinearFilter;
    this.volumeTexture.unpackAlignment = 1;
    this.volumeTexture.needsUpdate = true;

    this.volumeMaterial = new THREE.ShaderMaterial({
      vertexShader: VolumeVertexShader,
      fragmentShader: VolumeFragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_data: { value: this.volumeTexture },
        u_dim: { value: new THREE.Vector3(64, 64, 32) },
        u_opacity: { value: 0.6 },
        u_threshold: { value: 0.0 },
        u_isoValue: { value: 0.5 },
        u_renderMode: { value: 0 },
        u_colormap: { value: 0 },
        u_stepSize: { value: 0.008 },
        u_sliceZ: { value: 0.0 },
        u_enableSlice: { value: 0 },
      },
    });

    this.volMesh = new THREE.Mesh(this.volGeo, this.volumeMaterial);
    this.scene.add(this.volMesh);

    // 12. 2D Slicing Plane
    const slicePlaneGeo = new THREE.PlaneGeometry(this.xScale, this.zScale);
    slicePlaneGeo.rotateX(-Math.PI / 2);
    const slicePlaneMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    this.slicePlane = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
    this.slicePlane.position.y = 0.3 * this.verticalExaggeration;
    this.slicePlane.visible = false;
    this.scene.add(this.slicePlane);

    // 13. Argo Float Profilers Group
    this.floatGroup = new THREE.Group();
    this.floatGroup.name = 'FloatGroup';
    this.scene.add(this.floatGroup);

    // 14. Target Location Highlighting Beacon
    this.targetMarker = new THREE.Group();
    const beaconPinGeo = new THREE.ConeGeometry(0.025, 0.07, 16);
    beaconPinGeo.rotateX(Math.PI);
    const beaconPinMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const beaconPin = new THREE.Mesh(beaconPinGeo, beaconPinMat);
    beaconPin.position.y = 0.04;
    this.targetMarker.add(beaconPin);

    const beaconRingGeo = new THREE.RingGeometry(0.02, 0.045, 24);
    beaconRingGeo.rotateX(-Math.PI / 2);
    const beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
    beaconRing.name = 'beaconRing';
    this.targetMarker.add(beaconRing);
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);

    // 15. Raycaster & Pointer Handlers
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handleResize = this._handleResize.bind(this);

    this.renderer.domElement.addEventListener('pointermove', this._handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this._handlePointerDown);
    window.addEventListener('resize', this._handleResize);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this._handleResize());
      this.resizeObserver.observe(this.container);
    }

    // 16. Start Main Render Loop
    this._animate();
  }

  _animate() {
    if (this.isDisposed) return;
    this.animationId = requestAnimationFrame(() => this._animate());

    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update Environmental Wave Shaders & Flow Particles
    if (this.waterSurface) this.waterSurface.update(elapsedTime);
    if (this.currentVectors) this.currentVectors.update(elapsedTime);
    if (this.marinePlatform) this.marinePlatform.update(elapsedTime);

    // 2. Animate Acoustic Ping Rings on Argo Float Markers & Target Beacon
    if (this.floatGroup) {
      this.floatGroup.children.forEach((marker) => {
        const ring = marker.getObjectByName('pingRing');
        if (ring) {
          const pulse = (elapsedTime * 1.5) % 2.0;
          ring.scale.set(1.0 + pulse * 1.2, 1.0 + pulse * 1.2, 1.0);
          ring.material.opacity = Math.max(0, 0.8 - pulse * 0.4);
        }
      });
    }

    if (this.targetMarker?.visible) {
      const bRing = this.targetMarker.getObjectByName('beaconRing');
      if (bRing) {
        const bPulse = (elapsedTime * 2.0) % 2.0;
        bRing.scale.set(1.0 + bPulse * 1.5, 1.0 + bPulse * 1.5, 1.0);
        bRing.material.opacity = Math.max(0, 0.9 - bPulse * 0.45);
      }
    }

    // 3. Smooth Camera Lerp for Cinematic Transitions
    if (this.isCameraLerping && this.cameraTargetPos && this.controlsTargetPos) {
      this.camera.position.lerp(this.cameraTargetPos, 0.05);
      this.controls.target.lerp(this.controlsTargetPos, 0.05);
      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.02) {
        this.camera.position.copy(this.cameraTargetPos);
        this.controls.target.copy(this.controlsTargetPos);
        this.isCameraLerping = false;
      }
    }

    this.controls.update();

    // Calculate Spherical Camera Angles for HUD Readout
    const spherical = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    this.onOrbitChange({
      azimuth: Math.round(THREE.MathUtils.radToDeg(spherical.theta)),
      elevation: Math.round(THREE.MathUtils.radToDeg(Math.PI / 2 - spherical.phi)),
      zoom: Math.round(spherical.radius * 10) / 10,
    });

    this.renderer.render(this.scene, this.camera);
  }

  _handlePointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Intersect Argo Floats and Marine Platform
    const targets = [...this.floatGroup.children];
    if (this.marinePlatform?.group) targets.push(this.marinePlatform.group);

    const intersects = this.raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.platform_number && !obj.userData?.type && obj.parent) {
        obj = obj.parent;
      }

      if (obj?.userData?.platform_number) {
        const target = this.argoFloats.find(f => f.platform_number === obj.userData.platform_number);
        this.onHoverFloat(target || null);
        this.container.style.cursor = 'pointer';
        return;
      }

      if (obj?.userData?.type === 'platform') {
        this.container.style.cursor = 'pointer';
        return;
      }
    }

    // Raycast surface mesh to sample spatial coordinates and physical scalar field
    const probeTargets = [];
    if (this.volMesh) probeTargets.push(this.volMesh);
    if (this.waterSurface?.mesh) probeTargets.push(this.waterSurface.mesh);
    const probeIntersects = this.raycaster.intersectObjects(probeTargets, false);
    if (probeIntersects.length > 0 && this.volumeMeta) {
      const pt = probeIntersects[0].point;
      const maxDepth = this.volumeMeta.maxDepth ?? 2000;

      // Use unified worldToLonLat transform
      const { lon, lat } = worldToLonLat(
        pt.x,
        pt.z,
        this.bounds,
        { xScale: this.xScale, zScale: this.zScale }
      );

      const normY = THREE.MathUtils.clamp((0.3 * this.verticalExaggeration - pt.y) / (0.6 * this.verticalExaggeration), 0.0, 1.0);
      const depth = normY * maxDepth;

      let scalarVal = null;
      if (this.volumeBuffer) {
        const { dimX, dimY, dimZ, minVal, maxVal } = this.volumeMeta;
        const normX = THREE.MathUtils.clamp((pt.x / this.xScale) + 0.5, 0.0, 1.0);
        const normZ = THREE.MathUtils.clamp((pt.z / this.zScale) + 0.5, 0.0, 1.0);
        const ix = Math.min(dimX - 1, Math.max(0, Math.floor(normX * dimX)));
        const iy = Math.min(dimY - 1, Math.max(0, Math.floor(normZ * dimY)));
        const iz = Math.min(dimZ - 1, Math.max(0, Math.floor(normY * dimZ)));
        const idx = iz * (dimX * dimY) + iy * dimX + ix;
        const raw = this.volumeBuffer[idx];
        if (raw !== undefined && !isNaN(raw) && raw !== -1.0) {
          scalarVal = minVal + raw * (maxVal - minVal);
        }
      }

      this.onSampleProbe({
        lon,
        lat,
        depth,
        scalarVal,
        units: this.volumeMeta.units,
        variable: this.volumeMeta.variable,
      });
    }

    this.onHoverFloat(null);
    this.container.style.cursor = 'grab';
  }

  _handlePointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const targets = [...this.floatGroup.children];
    if (this.marinePlatform?.group) targets.push(this.marinePlatform.group);

    const intersects = this.raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.platform_number && !obj.userData?.type && obj.parent) {
        obj = obj.parent;
      }

      if (obj?.userData?.platform_number) {
        const target = this.argoFloats.find(f => f.platform_number === obj.userData.platform_number);
        if (target) this.onSelectFloat(target);
        return;
      } else if (obj?.userData?.type === 'platform') {
        this.onSelectPlatform(obj.userData);
        return;
      }
    }

    // Click-to-select geographic location on ocean surface (Phase 12)
    const oceanTargets = [];
    if (this.volMesh) oceanTargets.push(this.volMesh);
    if (this.waterSurface?.mesh) oceanTargets.push(this.waterSurface.mesh);
    const oceanIntersects = this.raycaster.intersectObjects(oceanTargets, false);
    if (oceanIntersects.length > 0) {
      const pt = oceanIntersects[0].point;
      const { lon, lat } = worldToLonLat(
        pt.x,
        pt.z,
        this.bounds,
        { xScale: this.xScale, zScale: this.zScale }
      );
      this.focusCoordinate(lat, lon);
      this.onSelectCoordinate({ lat, lon });
    }
  }

  _handleResize() {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setSeaState(seaState) {
    if (this.waterSurface) {
      this.waterSurface.setSeaState(seaState);
    }
  }

  updateVolumeData(volumeBuffer, volumeMeta) {
    if (!volumeBuffer || !volumeMeta || !this.volumeMaterial) return;

    this.volumeBuffer = volumeBuffer;
    this.volumeMeta = volumeMeta;
    const { dimX, dimY, dimZ } = volumeMeta;

    if (volumeMeta.minLon !== undefined && volumeMeta.maxLon !== undefined) {
      this.bounds = {
        minLon: volumeMeta.minLon,
        maxLon: volumeMeta.maxLon,
        minLat: volumeMeta.minLat,
        maxLat: volumeMeta.maxLat,
      };
    }

    const newTexture = new THREE.Data3DTexture(volumeBuffer, dimX, dimY, dimZ);
    newTexture.format = THREE.RedFormat;
    newTexture.type = THREE.FloatType;
    newTexture.minFilter = THREE.LinearFilter;
    newTexture.magFilter = THREE.LinearFilter;
    newTexture.unpackAlignment = 1;
    newTexture.needsUpdate = true;

    if (this.volumeMaterial.uniforms.u_data.value) {
      this.volumeMaterial.uniforms.u_data.value.dispose();
    }

    this.volumeMaterial.uniforms.u_data.value = newTexture;
    this.volumeMaterial.uniforms.u_dim.value = new THREE.Vector3(dimX, dimY, dimZ);

    if (this.landLayer) {
      this.landLayer.updateBounds(
        this.bounds,
        this.xScale,
        this.zScale,
        0.301 * this.verticalExaggeration
      );
    }

    if (this.coastlineLayer) {
      this.coastlineLayer.updateBounds(
        this.bounds,
        this.xScale,
        this.zScale,
        0.303 * this.verticalExaggeration
      );
    }
  }

  updateUniforms({
    opacity,
    threshold,
    isoValue,
    renderMode,
    colormap,
    sliceDepthMeters,
    enableSlice,
    verticalExaggeration
  }) {
    if (!this.volumeMaterial) return;

    if (verticalExaggeration !== undefined && verticalExaggeration !== this.verticalExaggeration) {
      this.verticalExaggeration = verticalExaggeration;
      this.surfaceGrid.position.y = 0.3 * this.verticalExaggeration;
      this.floorGrid.position.y = -0.3 * this.verticalExaggeration;
      if (this.waterSurface?.mesh) this.waterSurface.mesh.position.y = 0.3 * this.verticalExaggeration;
      if (this.bathymetricFloor?.group) this.bathymetricFloor.group.position.y = -0.3 * this.verticalExaggeration;
      if (this.currentVectors) this.currentVectors.setYLevel(0.302 * this.verticalExaggeration);
      if (this.landLayer) this.landLayer.setYLevel(0.301 * this.verticalExaggeration);
      if (this.coastlineLayer) this.coastlineLayer.setYLevel(0.303 * this.verticalExaggeration);
      if (this.marinePlatform?.group) this.marinePlatform.group.position.y = 0.3 * this.verticalExaggeration;
      this.updateArgoMarkers(this.argoFloats, this.selectedFloat, this.verticalExaggeration, this.volumeMeta);
    }

    if (opacity !== undefined) this.volumeMaterial.uniforms.u_opacity.value = opacity;
    if (threshold !== undefined) this.volumeMaterial.uniforms.u_threshold.value = threshold;
    if (isoValue !== undefined) this.volumeMaterial.uniforms.u_isoValue.value = isoValue;
    if (renderMode !== undefined) this.volumeMaterial.uniforms.u_renderMode.value = renderMode === 'iso' ? 1 : 0;
    if (colormap !== undefined) this.volumeMaterial.uniforms.u_colormap.value = COLORMAP_CODES[colormap] || 0;
    if (sliceDepthMeters !== undefined) this.volumeMaterial.uniforms.u_sliceZ.value = sliceDepthMeters / 2000.0;
    if (enableSlice !== undefined) this.volumeMaterial.uniforms.u_enableSlice.value = enableSlice ? 1 : 0;

    if (this.slicePlane) {
      this.slicePlane.visible = !!enableSlice;
      const sliceZ = (sliceDepthMeters !== undefined ? sliceDepthMeters : 0) / 2000.0;
      this.slicePlane.position.y = (0.3 - sliceZ * 0.6) * this.verticalExaggeration;
    }
  }

  setLayerVisibility({ oceanSurface, currentVectors, bathymetricFloor, marinePlatform, argoSensors, volumeRaymarch, coastlines, land }) {
    if (oceanSurface !== undefined && this.waterSurface) this.waterSurface.setVisible(oceanSurface);
    if (currentVectors !== undefined && this.currentVectors) this.currentVectors.setVisible(currentVectors);
    if (bathymetricFloor !== undefined && this.bathymetricFloor) this.bathymetricFloor.setVisible(bathymetricFloor);
    if (marinePlatform !== undefined && this.marinePlatform) this.marinePlatform.setVisible(marinePlatform);
    if (argoSensors !== undefined && this.floatGroup) this.floatGroup.visible = argoSensors;
    if (volumeRaymarch !== undefined && this.volMesh) this.volMesh.visible = volumeRaymarch;
    if (coastlines !== undefined && this.coastlineLayer) this.coastlineLayer.setVisible(coastlines);
    if (land !== undefined && this.landLayer) this.landLayer.setVisible(land);
  }

  updateGridAndBox({ showGrid, showBoundingBox }) {
    if (this.surfaceGrid) this.surfaceGrid.visible = !!showGrid;
    if (this.floorGrid) this.floorGrid.visible = !!showGrid;
    if (this.boxLine) this.boxLine.visible = !!showBoundingBox;
  }

  updateArgoMarkers(argoFloats, selectedFloat, verticalExaggeration, volumeMeta) {
    this.argoFloats = argoFloats || [];
    this.selectedFloat = selectedFloat;
    if (verticalExaggeration !== undefined) this.verticalExaggeration = verticalExaggeration;
    if (volumeMeta !== undefined) this.volumeMeta = volumeMeta;

    if (!this.floatGroup) return;

    while (this.floatGroup.children.length > 0) {
      const child = this.floatGroup.children[0];
      this.floatGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    const scale = { xScale: this.xScale, zScale: this.zScale };
    const surfaceY = 0.3 * this.verticalExaggeration;

    this.argoFloats.forEach((float) => {
      const isSelected = this.selectedFloat?.platform_number === float.platform_number;

      // Use unified lonLatToWorld coordinate transform
      const w = lonLatToWorld(
        float.latest_position.longitude,
        float.latest_position.latitude,
        surfaceY,
        this.bounds,
        scale
      );

      const marker = new THREE.Group();
      marker.userData = { platform_number: float.platform_number };

      // 1. Vertical Profile Descent Trajectory Cable
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(w.x, surfaceY, w.z),
        new THREE.Vector3(w.x, -0.3 * this.verticalExaggeration, w.z),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: isSelected ? 0x38bdf8 : 0xf59e0b,
        dashSize: 0.02,
        gapSize: 0.01,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      marker.add(line);

      // 2. High-Visibility Marine Profiler Buoy
      const buoyGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.042, 16);
      const buoyMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x38bdf8 : 0xf59e0b,
        roughness: 0.2,
        metalness: 0.8,
        emissive: isSelected ? 0x0284c7 : 0xd97706,
        emissiveIntensity: isSelected ? 0.9 : 0.4,
      });
      const buoy = new THREE.Mesh(buoyGeo, buoyMat);
      buoy.position.set(w.x, surfaceY + 0.02, w.z);
      marker.add(buoy);

      // 3. Acoustic Transmission Pulsing Ring
      const ringGeo = new THREE.RingGeometry(0.018, 0.032, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x38bdf8 : 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const pingRing = new THREE.Mesh(ringGeo, ringMat);
      pingRing.name = 'pingRing';
      pingRing.position.set(w.x, surfaceY + 0.002, w.z);
      marker.add(pingRing);

      this.floatGroup.add(marker);
    });
  }

  focusCoordinate(lat, lon) {
    if (!this.camera || !this.controls) return;
    const surfaceY = 0.3 * this.verticalExaggeration;
    const scale = { xScale: this.xScale, zScale: this.zScale };

    // Use unified lonLatToWorld coordinate transform
    const w = lonLatToWorld(lon, lat, surfaceY, this.bounds, scale);

    if (this.targetMarker) {
      this.targetMarker.position.set(w.x, surfaceY, w.z);
      this.targetMarker.visible = true;
    }

    this.controlsTargetPos = new THREE.Vector3(w.x, surfaceY, w.z);
    this.cameraTargetPos = new THREE.Vector3(w.x, surfaceY + 0.85, w.z + 0.85);
    this.isCameraLerping = true;
  }

  setCameraPreset(action) {
    if (!this.camera || !this.controls) return;

    this.isCameraLerping = true;

    switch (action) {
      case 'fit':
      case 'indian_ocean':
      case 'geospatial':
      case 'top':
        // Top-down tactical Indian Ocean full domain view in ~3:2 framing (Phase 14)
        this.cameraTargetPos = new THREE.Vector3(0, 3.4, 0.001);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'cinematic':
        // Cinematic low-horizon perspective
        this.cameraTargetPos = new THREE.Vector3(1.8, 0.85, 1.8);
        this.controlsTargetPos = new THREE.Vector3(0, 0.1, 0);
        break;

      case 'platform':
        // Close inspection view focused on marine intelligence station
        this.cameraTargetPos = new THREE.Vector3(0.35, 0.42, 0.28);
        this.controlsTargetPos = new THREE.Vector3(0.18, 0.3 * this.verticalExaggeration, 0.12);
        break;

      case 'subsurface':
        // Underwater observation looking through thermocline
        this.cameraTargetPos = new THREE.Vector3(1.1, -0.18, 1.4);
        this.controlsTargetPos = new THREE.Vector3(0, -0.05, 0);
        break;

      case 'front':
        this.cameraTargetPos = new THREE.Vector3(0, 0.1, 3.0);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'side':
        this.cameraTargetPos = new THREE.Vector3(3.2, 0.1, 0);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'iso':
      case 'operational':
      case 'reset':
      default:
        // Default isometric 3D perspective framing the whole Indian Ocean
        this.cameraTargetPos = new THREE.Vector3(1.8, 1.6, 2.3);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    window.removeEventListener('resize', this._handleResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('pointermove', this._handlePointerMove);
      this.renderer.domElement.removeEventListener('pointerdown', this._handlePointerDown);
      this.renderer.dispose();
    }

    if (this.skyDome) this.skyDome.dispose();
    if (this.waterSurface) this.waterSurface.dispose();
    if (this.bathymetricFloor) this.bathymetricFloor.dispose();
    if (this.marinePlatform) this.marinePlatform.dispose();
    if (this.currentVectors) this.currentVectors.dispose();
    if (this.landLayer) this.landLayer.dispose();
    if (this.coastlineLayer) this.coastlineLayer.dispose();

    if (this.volumeTexture) this.volumeTexture.dispose();
    if (this.volGeo) this.volGeo.dispose();
    if (this.volumeMaterial) this.volumeMaterial.dispose();
    if (this.boxGeo) this.boxGeo.dispose();
    if (this.boxEdges) this.boxEdges.dispose();
  }
}
