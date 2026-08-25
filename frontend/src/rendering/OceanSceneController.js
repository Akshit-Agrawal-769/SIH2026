/**
 * OceanSceneController Deep Module
 * Encapsulates the Three.js WebGL2 scene graph:
 * - Volumetric raymarching shader pipelines (Float32 Data3DTexture)
 * - Realistic Gerstner ocean water surface with specular lighting
 * - Atmospheric sky dome and sun illumination
 * - Procedural bathymetric relief floor and contour grids
 * - Autonomous floating marine intelligence station & mooring infrastructure
 * - GPU particle current flow streamlines (u, v vectors)
 * - In-situ Argo profiling floats with acoustic beacon pulses
 * - Cinematic and tactical camera systems with smooth interpolations
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VolumeVertexShader, VolumeFragmentShader } from './shaders/VolumeRaymarchingShader';
import { RealisticWaterSurface } from './environment/RealisticWaterSurface';
import { AtmosphericSkyDome } from './environment/AtmosphericSkyDome';
import { BathymetricFloor } from './environment/BathymetricFloor';
import { MarinePlatform } from './infrastructure/MarinePlatform';
import { CurrentVectorField } from './layers/CurrentVectorField';

const COLORMAP_CODES = { turbo: 0, viridis: 1, thermal: 2, jet: 3 };

export class OceanSceneController {
  constructor(container, options = {}) {
    this.container = container;
    this.onHoverFloat = options.onHoverFloat || (() => {});
    this.onSelectFloat = options.onSelectFloat || (() => {});
    this.onOrbitChange = options.onOrbitChange || (() => {});
    this.onSelectPlatform = options.onSelectPlatform || (() => {});

    this.argoFloats = [];
    this.selectedFloat = null;
    this.verticalExaggeration = 1.0;
    this.volumeMeta = null;

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
    this.scene.fog = new THREE.FogExp2(0x040915, 0.08);

    // 2. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Default cinematic perspective looking across the ocean swell
    this.camera.position.set(1.5, 0.95, 1.85);

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
    this.controls.maxDistance = 6.5;
    this.controls.minDistance = 0.4;
    this.controls.target.set(0, 0, 0);

    // 3. Lighting (Atmospheric Sun & Ocean Ambient)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.75);
    this.scene.add(ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xbae6fd, 1.6);
    this.dirLight.position.set(2.5, 4.5, 3.5);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    // 4. Atmospheric Sky Dome
    this.skyDome = new AtmosphericSkyDome();
    this.scene.add(this.skyDome.mesh);

    // 5. Realistic Ocean Water Surface (Gerstner Waves)
    this.waterSurface = new RealisticWaterSurface({
      size: 2.2,
      segments: 96,
      yPosition: 0.3 * this.verticalExaggeration,
    });
    this.scene.add(this.waterSurface.mesh);

    // 6. Bathymetric Sea Floor Relief
    this.bathymetricFloor = new BathymetricFloor({
      size: 2.2,
      segments: 64,
      yPosition: -0.3 * this.verticalExaggeration,
    });
    this.scene.add(this.bathymetricFloor.group);

    // 7. Floating Oceanographic Intelligence Platform
    this.marinePlatform = new MarinePlatform({
      position: new THREE.Vector3(0.18, 0.3 * this.verticalExaggeration, 0.12),
    });
    this.scene.add(this.marinePlatform.group);

    // 8. GPU Ocean Surface Current Velocity Streamlines (u, v)
    this.currentVectors = new CurrentVectorField({
      count: 2200,
      yLevel: 0.302 * this.verticalExaggeration,
    });
    this.scene.add(this.currentVectors.mesh);

    // 9. Bounding Frame & Reference Grids
    this.boxGeo = new THREE.BoxGeometry(1.0, 0.6 * this.verticalExaggeration, 1.0);
    this.boxEdges = new THREE.EdgesGeometry(this.boxGeo);
    this.boxLine = new THREE.LineSegments(
      this.boxEdges,
      new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 1 })
    );
    this.scene.add(this.boxLine);

    this.surfaceGrid = new THREE.GridHelper(1.0, 10, 0x0284c7, 0x1e293b);
    this.surfaceGrid.position.y = 0.3 * this.verticalExaggeration;
    this.scene.add(this.surfaceGrid);

    this.floorGrid = new THREE.GridHelper(1.0, 10, 0x0f766e, 0x0f172a);
    this.floorGrid.position.y = -0.3 * this.verticalExaggeration;
    this.scene.add(this.floorGrid);

    // 10. 3D Volumetric Raymarching Data Texture & Mesh
    this.volGeo = new THREE.BoxGeometry(1.0, 0.6 * this.verticalExaggeration, 1.0);
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

    // 11. 2D Slicing Plane
    const slicePlaneGeo = new THREE.PlaneGeometry(1.0, 1.0);
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

    // 12. In-Situ Argo Profiler 3D Markers
    this.floatGroup = new THREE.Group();
    this.scene.add(this.floatGroup);

    // 13. Raycaster & Pointer Handlers
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

    // 14. Start Main Render Loop
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

    // 2. Animate Acoustic Ping Rings on Argo Float Markers
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
      } else if (obj?.userData?.type === 'platform') {
        this.onSelectPlatform(obj.userData);
      }
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

  updateVolumeData(volumeBuffer, volumeMeta) {
    if (!volumeBuffer || !volumeMeta || !this.volumeMaterial) return;

    this.volumeMeta = volumeMeta;
    const { dimX, dimY, dimZ } = volumeMeta;

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

  setLayerVisibility({ oceanSurface, currentVectors, bathymetricFloor, marinePlatform, argoSensors, volumeRaymarch }) {
    if (oceanSurface !== undefined && this.waterSurface) this.waterSurface.setVisible(oceanSurface);
    if (currentVectors !== undefined && this.currentVectors) this.currentVectors.setVisible(currentVectors);
    if (bathymetricFloor !== undefined && this.bathymetricFloor) this.bathymetricFloor.setVisible(bathymetricFloor);
    if (marinePlatform !== undefined && this.marinePlatform) this.marinePlatform.setVisible(marinePlatform);
    if (argoSensors !== undefined && this.floatGroup) this.floatGroup.visible = argoSensors;
    if (volumeRaymarch !== undefined && this.volMesh) this.volMesh.visible = volumeRaymarch;
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

    const minLon = this.volumeMeta?.minLon ?? 58.0;
    const maxLon = this.volumeMeta?.maxLon ?? 96.0;
    const minLat = this.volumeMeta?.minLat ?? 4.0;
    const maxLat = this.volumeMeta?.maxLat ?? 26.0;

    this.argoFloats.forEach((float) => {
      const isSelected = this.selectedFloat?.platform_number === float.platform_number;
      const lonSpan = maxLon > minLon ? (maxLon - minLon) : 1.0;
      const latSpan = maxLat > minLat ? (maxLat - minLat) : 1.0;
      const normX = ((float.latest_position.longitude - minLon) / lonSpan) - 0.5;
      const normZ = ((float.latest_position.latitude - minLat) / latSpan) - 0.5;
      const surfaceY = 0.3 * this.verticalExaggeration;

      const marker = new THREE.Group();
      marker.userData = { platform_number: float.platform_number };

      // 1. Vertical Profile Descent Trajectory Cable
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(normX, surfaceY, normZ),
        new THREE.Vector3(normX, -0.3 * this.verticalExaggeration, normZ),
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
      buoy.position.set(normX, surfaceY + 0.02, normZ);
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
      pingRing.position.set(normX, surfaceY + 0.002, normZ);
      marker.add(pingRing);

      this.floatGroup.add(marker);
    });
  }

  setCameraPreset(action) {
    if (!this.camera || !this.controls) return;

    this.isCameraLerping = true;

    switch (action) {
      case 'cinematic':
        // Dramatic low horizon angle across the ocean swell
        this.cameraTargetPos = new THREE.Vector3(1.4, 0.55, 1.6);
        this.controlsTargetPos = new THREE.Vector3(0, 0.15, 0);
        break;

      case 'platform':
        // Close inspection view focused on the marine intelligence station
        this.cameraTargetPos = new THREE.Vector3(0.35, 0.42, 0.28);
        this.controlsTargetPos = new THREE.Vector3(0.18, 0.3 * this.verticalExaggeration, 0.12);
        break;

      case 'subsurface':
        // Underwater observation looking up through thermocline
        this.cameraTargetPos = new THREE.Vector3(0.9, -0.18, 1.2);
        this.controlsTargetPos = new THREE.Vector3(0, -0.05, 0);
        break;

      case 'top':
      case 'geospatial':
        // Tactical top-down plan view (North-Up)
        this.cameraTargetPos = new THREE.Vector3(0, 3.1, 0.001);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'front':
        // Front elevation profile
        this.cameraTargetPos = new THREE.Vector3(0, 0.1, 2.7);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'side':
        // Side zonal elevation
        this.cameraTargetPos = new THREE.Vector3(2.7, 0.1, 0);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'iso':
      case 'operational':
      case 'reset':
      default:
        this.cameraTargetPos = new THREE.Vector3(1.6, 1.4, 2.2);
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

    if (this.volumeTexture) this.volumeTexture.dispose();
    if (this.volGeo) this.volGeo.dispose();
    if (this.volumeMaterial) this.volumeMaterial.dispose();
    if (this.boxGeo) this.boxGeo.dispose();
    if (this.boxEdges) this.boxEdges.dispose();
  }
}
