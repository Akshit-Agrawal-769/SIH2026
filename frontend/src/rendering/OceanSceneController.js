/**
 * OceanSceneController Deep Module
 * Encapsulates the Three.js WebGL2 scene graph, volumetric raymarching shader pipelines,
 * 3D Data3DTexture binding, depth-slicing planes, camera controls, and interactive raycasting.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VolumeVertexShader, VolumeFragmentShader } from './shaders/VolumeRaymarchingShader';

const COLORMAP_CODES = { turbo: 0, viridis: 1, thermal: 2, jet: 3 };

export class OceanSceneController {
  constructor(container, options = {}) {
    this.container = container;
    this.onHoverFloat = options.onHoverFloat || (() => {});
    this.onSelectFloat = options.onSelectFloat || (() => {});
    this.onOrbitChange = options.onOrbitChange || (() => {});

    this.argoFloats = [];
    this.selectedFloat = null;
    this.verticalExaggeration = 1.0;
    this.volumeMeta = null;

    this.animationId = null;
    this.isDisposed = false;

    this._initScene();
  }

  _initScene() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene & Background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050811);

    // 2. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(1.6, 1.4, 2.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 7.0;
    this.controls.minDistance = 0.6;
    this.controls.target.set(0, 0, 0);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    dirLight.position.set(2.5, 4.5, 3.5);
    this.scene.add(dirLight);

    // 4. Bounding Box
    this.boxGeo = new THREE.BoxGeometry(1.0, 0.6 * this.verticalExaggeration, 1.0);
    this.boxEdges = new THREE.EdgesGeometry(this.boxGeo);
    this.boxLine = new THREE.LineSegments(
      this.boxEdges,
      new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 })
    );
    this.scene.add(this.boxLine);

    // 5. Surface & Floor Bathymetric Grids
    this.surfaceGrid = new THREE.GridHelper(1.0, 10, 0x0284c7, 0x1e293b);
    this.surfaceGrid.position.y = 0.3 * this.verticalExaggeration;
    this.scene.add(this.surfaceGrid);

    this.floorGrid = new THREE.GridHelper(1.0, 10, 0x0f766e, 0x0f172a);
    this.floorGrid.position.y = -0.3 * this.verticalExaggeration;
    this.scene.add(this.floorGrid);

    // 6. Volumetric Raymarching Mesh & Shader Material
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

    // 7. 2D Slicing Plane Wireframe
    const slicePlaneGeo = new THREE.PlaneGeometry(1.0, 1.0);
    slicePlaneGeo.rotateX(-Math.PI / 2);
    const slicePlaneMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.slicePlane = new THREE.Mesh(slicePlaneGeo, slicePlaneMat);
    this.slicePlane.position.y = 0.3 * this.verticalExaggeration;
    this.slicePlane.visible = false;
    this.scene.add(this.slicePlane);

    // 8. Argo Float 3D Markers Group
    this.floatGroup = new THREE.Group();
    this.scene.add(this.floatGroup);

    // 9. Raycaster Setup & Event Listeners
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

    // 10. Start Animation Loop
    this._animate();
  }

  _animate() {
    if (this.isDisposed) return;
    this.animationId = requestAnimationFrame(() => this._animate());

    this.controls.update();

    // Calculate Spherical Camera Angles for HUD
    const spherical = new THREE.Spherical().setFromVector3(this.camera.position);
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
    const intersects = this.raycaster.intersectObjects(this.floatGroup.children, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.platform_number && obj.parent) {
        obj = obj.parent;
      }
      if (obj?.userData?.platform_number) {
        const target = this.argoFloats.find(f => f.platform_number === obj.userData.platform_number);
        this.onHoverFloat(target || null);
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
    const intersects = this.raycaster.intersectObjects(this.floatGroup.children, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.platform_number && obj.parent) {
        obj = obj.parent;
      }
      if (obj?.userData?.platform_number) {
        const target = this.argoFloats.find(f => f.platform_number === obj.userData.platform_number);
        if (target) {
          this.onSelectFloat(target);
        }
      }
    }
  }

  _handleResize() {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
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
      if (child.material) child.material.dispose();
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

      // Vertical Trajectory Descent Cable
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

      this.floatGroup.add(marker);
    });
  }

  setCameraPreset(action) {
    if (!this.camera || !this.controls) return;

    switch (action) {
      case 'top':
        this.camera.position.set(0, 3.2, 0.001);
        this.controls.target.set(0, 0, 0);
        break;
      case 'front':
        this.camera.position.set(0, 0.1, 2.8);
        this.controls.target.set(0, 0, 0);
        break;
      case 'side':
        this.camera.position.set(2.8, 0.1, 0);
        this.controls.target.set(0, 0, 0);
        break;
      case 'iso':
      case 'reset':
      default:
        this.camera.position.set(1.6, 1.4, 2.2);
        this.controls.target.set(0, 0, 0);
        break;
    }
    this.controls.update();
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

    if (this.volumeTexture) this.volumeTexture.dispose();
    if (this.volGeo) this.volGeo.dispose();
    if (this.volumeMaterial) this.volumeMaterial.dispose();
    if (this.boxGeo) this.boxGeo.dispose();
    if (this.boxEdges) this.boxEdges.dispose();
  }
}
