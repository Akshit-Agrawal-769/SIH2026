/**
 * OceanSceneController Deep Module
 * Encapsulates the Three.js WebGL2 scene graph:
 * - High-resolution 3D Earth Globe with atmospheric Fresnel scattering
 * - Authentic Natural Earth 10m land polygons & coastline vector layers
 * - Lat/Lon spherical graticule (Parallels, Meridians, Equator, Prime Meridian, Tropics)
 * - Subtle country borders layer
 * - Authoritative INCOIS Bio-ROMS model simulation domain footprint & dynamic surface scalar data field
 * - In-situ Argo profiling floats with acoustic beacon pulses on the spherical Earth
 * - Volumetric raymarching shader pipelines (Float32 Data3DTexture) for 3D Ocean mode
 * - Cinematic and tactical camera systems with smooth great-circle interpolations
 * - Authoritative spherical geographic coordinate transformations
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EarthGlobe } from './environment/EarthGlobe';
import { CoastlineLayer } from './layers/CoastlineLayer';
import { LandLayer } from './layers/LandLayer';
import { CountryBorderLayer } from './layers/CountryBorderLayer';
import { GraticuleLayer } from './layers/GraticuleLayer';
import { ModelCoverageLayer } from './layers/ModelCoverageLayer';
import { VolumeVertexShader, VolumeFragmentShader } from './shaders/VolumeRaymarchingShader';
import {
  latLonToGlobe,
  globeToLatLon,
  isInsideModelDomain,
  calculateNearestGridCell,
  EARTH_RADIUS,
  DEFAULT_INDIAN_OCEAN_BOUNDS,
  DEFAULT_GEOMETRY_SCALE,
  lonLatToWorld,
  worldToLonLat,
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

    this.viewMode = options.viewMode || 'globe'; // 'globe' | 'ocean3d'
    this.argoFloats = [];
    this.selectedFloat = null;
    this.verticalExaggeration = 1.0;
    this.volumeMeta = null;
    this.volumeBuffer = null;

    this.bounds = { ...DEFAULT_INDIAN_OCEAN_BOUNDS };
    this.xScale = DEFAULT_GEOMETRY_SCALE.xScale;
    this.zScale = DEFAULT_GEOMETRY_SCALE.zScale;

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

    // 1. Scene & Background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712); // Deep cosmos dark
    this.scene.fog = new THREE.FogExp2(0x030712, 0.04);

    // 2. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Initial camera position focused on the Indian Ocean (10°N, 75°E)
    const initialGlobePos = latLonToGlobe(10.0, 75.0, 2.4);
    this.camera.position.set(initialGlobePos.x, initialGlobePos.y + 0.3, initialGlobePos.z);
    this.camera.up.set(0, 1, 0); // North is visually UP

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
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 8.0;
    this.controls.minDistance = 1.12;
    this.controls.target.set(0, 0, 0);

    // 3. Scientific Lighting (Directional Sun & Ambient Ocean Light)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.75);
    this.scene.add(ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.7);
    this.dirLight.position.set(4.0, 3.5, 4.5);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    // Secondary fill light from opposite side for scientific visibility
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLight.position.set(-4.0, -2.0, -3.0);
    this.scene.add(fillLight);

    // 4. 3D Earth Globe Environment
    this.earthGlobe = new EarthGlobe({ radius: EARTH_RADIUS });
    this.scene.add(this.earthGlobe.group);

    // 5. Authentic Natural Earth 10m Land Polygons
    this.landLayer = new LandLayer({ radius: EARTH_RADIUS * 1.001 });
    this.scene.add(this.landLayer.group);

    // 6. Authentic Natural Earth 10m Coastlines Layer
    this.coastlineLayer = new CoastlineLayer({ radius: EARTH_RADIUS * 1.0025 });
    this.scene.add(this.coastlineLayer.group);

    // 7. Country Borders Layer
    this.countryBorderLayer = new CountryBorderLayer({ radius: EARTH_RADIUS * 1.0018 });
    this.scene.add(this.countryBorderLayer.group);

    // 8. Latitude / Longitude Spherical Graticule Layer
    this.graticuleLayer = new GraticuleLayer({ radius: EARTH_RADIUS * 1.0015 });
    this.scene.add(this.graticuleLayer.group);

    // 9. INCOIS Bio-ROMS Model Domain Footprint & Surface Layer
    this.modelCoverageLayer = new ModelCoverageLayer({ radius: EARTH_RADIUS * 1.002 });
    this.scene.add(this.modelCoverageLayer.group);

    // 10. Argo Float Profilers Group on Globe
    this.floatGroup = new THREE.Group();
    this.floatGroup.name = 'ArgoFloatGroup';
    this.scene.add(this.floatGroup);

    // 11. Target Location Highlighting Beacon Pin
    this.targetMarker = new THREE.Group();
    this.targetMarker.name = 'TargetBeaconMarker';

    const beaconPinGeo = new THREE.ConeGeometry(0.018, 0.055, 16);
    beaconPinGeo.rotateX(Math.PI / 2); // Point towards center
    const beaconPinMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const beaconPin = new THREE.Mesh(beaconPinGeo, beaconPinMat);
    beaconPin.position.z = 0.028;
    this.targetMarker.add(beaconPin);

    const beaconRingGeo = new THREE.RingGeometry(0.015, 0.035, 24);
    const beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
    beaconRing.name = 'beaconRing';
    this.targetMarker.add(beaconRing);
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);

    // 12. Volumetric Raymarching Shader Pipeline for 3D Ocean Mode
    this.volGeo = new THREE.BoxGeometry(this.xScale, 0.6 * this.verticalExaggeration, this.zScale);
    const dummyTex = new THREE.Data3DTexture(new Float32Array(64 * 64 * 32), 64, 64, 32);
    dummyTex.format = THREE.RedFormat;
    dummyTex.type = THREE.FloatType;
    dummyTex.needsUpdate = true;
    this.volumeTexture = dummyTex;

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
    this.volMesh.name = 'VolumeMesh';
    this.volMesh.visible = false; // Hidden in default Earth Globe mode
    this.scene.add(this.volMesh);

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

    // 1. Animate Acoustic Ping Rings on Argo Float Markers & Target Beacon
    if (this.floatGroup) {
      this.floatGroup.children.forEach((marker) => {
        const ring = marker.getObjectByName('pingRing');
        if (ring) {
          const pulse = (elapsedTime * 1.5) % 2.0;
          ring.scale.set(1.0 + pulse * 1.2, 1.0 + pulse * 1.2, 1.0);
          ring.material.opacity = Math.max(0, 0.85 - pulse * 0.45);
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

    // 2. Smooth Camera Lerp for Cinematic / Presets Transitions
    if (this.isCameraLerping && this.cameraTargetPos && this.controlsTargetPos) {
      this.camera.position.lerp(this.cameraTargetPos, 0.06);
      this.controls.target.lerp(this.controlsTargetPos, 0.06);
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

    // 1. Intersect Argo Floats
    const targets = [...this.floatGroup.children];
    const intersects = this.raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.platform_number && obj.parent) {
        obj = obj.parent;
      }

      if (obj?.userData?.platform_number) {
        const target = this.argoFloats.find((f) => f.platform_number === obj.userData.platform_number);
        this.onHoverFloat(target || null);
        this.container.style.cursor = 'pointer';
        return;
      }
    }

    // 2. Intersect 3D Earth Globe to sample spatial coordinates
    if (this.earthGlobe?.globeMesh) {
      const globeIntersects = this.raycaster.intersectObject(this.earthGlobe.globeMesh, false);
      if (globeIntersects.length > 0) {
        const pt = globeIntersects[0].point;
        const { lat, lon } = globeToLatLon(pt.x, pt.y, pt.z);
        const isInsideModel = isInsideModelDomain(lat, lon, this.bounds);
        const nearest = calculateNearestGridCell(lat, lon, 0.083333, this.bounds);

        this.onSampleProbe({
          lon,
          lat,
          depth: 0.0,
          isInsideModel,
          nearestLat: nearest.nearestLat,
          nearestLon: nearest.nearestLon,
          distanceKm: nearest.distanceKm,
          units: this.volumeMeta?.units || '°C',
          variable: this.volumeMeta?.variable || 'temp',
        });
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

    // 1. Check Argo Float selection
    const targets = [...this.floatGroup.children];
    const intersects = this.raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.platform_number && obj.parent) {
        obj = obj.parent;
      }

      if (obj?.userData?.platform_number) {
        const target = this.argoFloats.find((f) => f.platform_number === obj.userData.platform_number);
        if (target) this.onSelectFloat(target);
        return;
      }
    }

    // 2. Click-to-select geographic location on 3D Earth Globe
    if (this.earthGlobe?.globeMesh) {
      const globeIntersects = this.raycaster.intersectObject(this.earthGlobe.globeMesh, false);
      if (globeIntersects.length > 0) {
        const pt = globeIntersects[0].point;
        const { lat, lon } = globeToLatLon(pt.x, pt.y, pt.z);
        const isInsideModel = isInsideModelDomain(lat, lon, this.bounds);
        const nearest = calculateNearestGridCell(lat, lon, 0.083333, this.bounds);

        this.focusCoordinate(lat, lon);
        this.onSelectCoordinate({
          lat,
          lon,
          isInsideModel,
          nearestLat: nearest.nearestLat,
          nearestLon: nearest.nearestLon,
          distanceKm: nearest.distanceKm,
        });
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

  setViewMode(mode) {
    this.viewMode = mode;
    const isGlobe = mode === 'globe';

    if (this.earthGlobe) this.earthGlobe.setVisible(isGlobe);
    if (this.landLayer) this.landLayer.setVisible(isGlobe);
    if (this.coastlineLayer) this.coastlineLayer.setVisible(isGlobe);
    if (this.countryBorderLayer) this.countryBorderLayer.setVisible(isGlobe);
    if (this.graticuleLayer) this.graticuleLayer.setVisible(isGlobe);
    if (this.modelCoverageLayer) this.modelCoverageLayer.setVisible(isGlobe);

    if (this.volMesh) this.volMesh.visible = !isGlobe;
    this.updateArgoMarkers(this.argoFloats, this.selectedFloat, this.verticalExaggeration, this.volumeMeta);
  }

  updateVolumeData(volumeBuffer, volumeMeta) {
    if (!volumeBuffer || !volumeMeta) return;

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

    // 1. Update Volumetric 3D texture for Ocean 3D mode
    const newTexture = new THREE.Data3DTexture(volumeBuffer, dimX, dimY, dimZ);
    newTexture.format = THREE.RedFormat;
    newTexture.type = THREE.FloatType;
    newTexture.minFilter = THREE.LinearFilter;
    newTexture.magFilter = THREE.LinearFilter;
    newTexture.unpackAlignment = 1;
    newTexture.needsUpdate = true;

    if (this.volumeMaterial?.uniforms?.u_data?.value) {
      this.volumeMaterial.uniforms.u_data.value.dispose();
    }
    if (this.volumeMaterial) {
      this.volumeMaterial.uniforms.u_data.value = newTexture;
      this.volumeMaterial.uniforms.u_dim.value = new THREE.Vector3(dimX, dimY, dimZ);
    }

    // 2. Extract surface 2D slice for ModelCoverageLayer on the Globe
    const surfaceSlice = new Float32Array(dimX * dimY);
    for (let i = 0; i < dimX * dimY; i++) {
      surfaceSlice[i] = volumeBuffer[i]; // Top z-layer = surface
    }
    if (this.modelCoverageLayer) {
      this.modelCoverageLayer.updateSurfaceData(surfaceSlice, dimX, dimY, 0);
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
    verticalExaggeration,
  }) {
    if (this.volumeMaterial) {
      if (opacity !== undefined) this.volumeMaterial.uniforms.u_opacity.value = opacity;
      if (threshold !== undefined) this.volumeMaterial.uniforms.u_threshold.value = threshold;
      if (isoValue !== undefined) this.volumeMaterial.uniforms.u_isoValue.value = isoValue;
      if (renderMode !== undefined) this.volumeMaterial.uniforms.u_renderMode.value = renderMode === 'iso' ? 1 : 0;
      if (colormap !== undefined) {
        const cCode = COLORMAP_CODES[colormap] || 0;
        this.volumeMaterial.uniforms.u_colormap.value = cCode;
        if (this.modelCoverageLayer?.surfMaterial) {
          this.modelCoverageLayer.surfMaterial.uniforms.u_colormap.value = cCode;
        }
      }
      if (sliceDepthMeters !== undefined) this.volumeMaterial.uniforms.u_sliceZ.value = sliceDepthMeters / 2000.0;
      if (enableSlice !== undefined) this.volumeMaterial.uniforms.u_enableSlice.value = enableSlice ? 1 : 0;
    }
  }

  setLayerVisibility({
    earthGlobe,
    coastlines,
    land,
    countryBorders,
    graticule,
    modelCoverage,
    argoSensors,
    volumeRaymarch,
    atmosphere,
  }) {
    if (earthGlobe !== undefined && this.earthGlobe) this.earthGlobe.setVisible(earthGlobe);
    if (coastlines !== undefined && this.coastlineLayer) this.coastlineLayer.setVisible(coastlines);
    if (land !== undefined && this.landLayer) this.landLayer.setVisible(land);
    if (countryBorders !== undefined && this.countryBorderLayer) this.countryBorderLayer.setVisible(countryBorders);
    if (graticule !== undefined && this.graticuleLayer) this.graticuleLayer.setVisible(graticule);
    if (modelCoverage !== undefined && this.modelCoverageLayer) this.modelCoverageLayer.setVisible(modelCoverage);
    if (argoSensors !== undefined && this.floatGroup) this.floatGroup.visible = argoSensors;
    if (volumeRaymarch !== undefined && this.volMesh) this.volMesh.visible = volumeRaymarch;
    if (atmosphere !== undefined && this.earthGlobe) this.earthGlobe.setAtmosphereVisible(atmosphere);
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
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    const isGlobeMode = this.viewMode === 'globe';

    this.argoFloats.forEach((float) => {
      const isSelected = this.selectedFloat?.platform_number === float.platform_number;
      const marker = new THREE.Group();
      marker.userData = { platform_number: float.platform_number };

      if (isGlobeMode) {
        // Spherical Globe Placement
        const gPos = latLonToGlobe(float.latest_position.latitude, float.latest_position.longitude, EARTH_RADIUS * 1.008);
        const normal = new THREE.Vector3(gPos.x, gPos.y, gPos.z).normalize();

        // 1. Radial Depth Line downward into the ocean
        const innerPos = latLonToGlobe(float.latest_position.latitude, float.latest_position.longitude, EARTH_RADIUS * 0.985);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(gPos.x, gPos.y, gPos.z),
          new THREE.Vector3(innerPos.x, innerPos.y, innerPos.z),
        ]);
        const lineMat = new THREE.LineDashedMaterial({
          color: isSelected ? 0x38bdf8 : 0xf59e0b,
          dashSize: 0.005,
          gapSize: 0.003,
        });
        const depthLine = new THREE.Line(lineGeo, lineMat);
        depthLine.computeLineDistances();
        marker.add(depthLine);

        // 2. High-Visibility Spherical Profiler Buoy Pin
        const buoyGeo = new THREE.SphereGeometry(0.014, 16, 12);
        const buoyMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x38bdf8 : 0xf59e0b,
          roughness: 0.2,
          metalness: 0.8,
          emissive: isSelected ? 0x0284c7 : 0xd97706,
          emissiveIntensity: isSelected ? 0.9 : 0.5,
        });
        const buoy = new THREE.Mesh(buoyGeo, buoyMat);
        buoy.position.set(gPos.x, gPos.y, gPos.z);
        marker.add(buoy);

        // 3. Acoustic Transmission Pulsing Ring (Oriented Tangent to Sphere Normal)
        const ringGeo = new THREE.RingGeometry(0.015, 0.028, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0x38bdf8 : 0xfbbf24,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const pingRing = new THREE.Mesh(ringGeo, ringMat);
        pingRing.name = 'pingRing';
        pingRing.position.set(gPos.x, gPos.y, gPos.z);
        pingRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        marker.add(pingRing);
      } else {
        // Planar Ocean 3D Mode
        const surfaceY = 0.3 * this.verticalExaggeration;
        const w = lonLatToWorld(float.latest_position.longitude, float.latest_position.latitude, surfaceY, this.bounds, {
          xScale: this.xScale,
          zScale: this.zScale,
        });

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
      }

      this.floatGroup.add(marker);
    });
  }

  focusCoordinate(lat, lon) {
    if (!this.camera || !this.controls) return;

    if (this.viewMode === 'globe') {
      const gPos = latLonToGlobe(lat, lon, EARTH_RADIUS * 1.01);
      const normal = new THREE.Vector3(gPos.x, gPos.y, gPos.z).normalize();

      if (this.targetMarker) {
        this.targetMarker.position.set(gPos.x, gPos.y, gPos.z);
        this.targetMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        this.targetMarker.visible = true;
      }

      // Smooth camera lerp targeting coordinate at distance ~ 2.0
      const camPos = normal.clone().multiplyScalar(2.1);
      this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
      this.cameraTargetPos = camPos;
      this.isCameraLerping = true;
    } else {
      const surfaceY = 0.3 * this.verticalExaggeration;
      const w = lonLatToWorld(lon, lat, surfaceY, this.bounds, { xScale: this.xScale, zScale: this.zScale });

      if (this.targetMarker) {
        this.targetMarker.position.set(w.x, surfaceY, w.z);
        this.targetMarker.visible = true;
      }

      this.controlsTargetPos = new THREE.Vector3(w.x, surfaceY, w.z);
      this.cameraTargetPos = new THREE.Vector3(w.x, surfaceY + 0.85, w.z + 0.85);
      this.isCameraLerping = true;
    }
  }

  setCameraPreset(action) {
    if (!this.camera || !this.controls) return;

    this.isCameraLerping = true;

    switch (action) {
      case 'fit_earth':
      case 'fit':
        // Fit entire Earth sphere in viewport
        this.cameraTargetPos = new THREE.Vector3(0, 0.4, 3.4);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'fit_indian_ocean':
      case 'indian_ocean':
      case 'geospatial':
        // Center camera focused on the Indian Ocean basin (10°N, 75°E)
        const ioPos = latLonToGlobe(10.0, 75.0, 2.2);
        this.cameraTargetPos = new THREE.Vector3(ioPos.x, ioPos.y + 0.25, ioPos.z);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'arabian_sea':
        const asPos = latLonToGlobe(14.0, 68.0, 1.85);
        this.cameraTargetPos = new THREE.Vector3(asPos.x, asPos.y, asPos.z);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'bay_of_bengal':
        const bobPos = latLonToGlobe(14.0, 88.0, 1.85);
        this.cameraTargetPos = new THREE.Vector3(bobPos.x, bobPos.y, bobPos.z);
        this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        break;

      case 'reset':
      default:
        const defPos = latLonToGlobe(10.0, 75.0, 2.4);
        this.cameraTargetPos = new THREE.Vector3(defPos.x, defPos.y + 0.3, defPos.z);
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

    if (this.earthGlobe) this.earthGlobe.dispose();
    if (this.landLayer) this.landLayer.dispose();
    if (this.coastlineLayer) this.coastlineLayer.dispose();
    if (this.countryBorderLayer) this.countryBorderLayer.dispose();
    if (this.graticuleLayer) this.graticuleLayer.dispose();
    if (this.modelCoverageLayer) this.modelCoverageLayer.dispose();

    if (this.volumeTexture) this.volumeTexture.dispose();
    if (this.volGeo) this.volGeo.dispose();
    if (this.volumeMaterial) this.volumeMaterial.dispose();
  }
}
