/**
 * ModelCoverageLayer
 * Projects the authoritative INCOIS Bio-ROMS numerical model simulation domain onto the 3D Spherical Earth.
 * Domain bounds: [30°E, 120°E] Longitude, [30°S, 30°N] Latitude.
 * - Spherical sector boundary outline with great-circle interpolation
 * - Spherical surface data mesh with dynamic scientific scalar field texture mapping
 * - NaN sentinel masking (land and missing values rendered transparent)
 */

import * as THREE from 'three';
import { latLonToGlobe, interpolateGreatCircle, EARTH_RADIUS, DEFAULT_INDIAN_OCEAN_BOUNDS } from '../../utils/geography';

const ColormapShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    uniform sampler2D u_dataTexture;
    uniform int u_hasData;
    uniform int u_colormap; // 0: Turbo, 1: Viridis, 2: Thermal, 3: Jet
    uniform float u_opacity;

    // Turbo Colormap Polynomial Approximation
    vec3 turboColormap(float x) {
      const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
      const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
      const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
      const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
      const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
      const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);

      x = clamp(x, 0.0, 1.0);
      vec4 v4 = vec4(1.0, x, x * x, x * x * x);
      vec2 v2 = v4.zw * v4.z;
      return vec3(
        dot(v4, kRedVec4) + dot(v2, kRedVec2),
        dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
        dot(v4, kBlueVec4) + dot(v2, kBlueVec2)
      );
    }

    vec3 viridisColormap(float x) {
      x = clamp(x, 0.0, 1.0);
      vec3 c0 = vec3(0.267, 0.004, 0.329);
      vec3 c1 = vec3(0.190, 0.407, 0.556);
      vec3 c2 = vec3(0.208, 0.718, 0.472);
      vec3 c3 = vec3(0.993, 0.906, 0.143);
      if (x < 0.333) return mix(c0, c1, x * 3.0);
      if (x < 0.666) return mix(c1, c2, (x - 0.333) * 3.0);
      return mix(c2, c3, (x - 0.666) * 3.0);
    }

    void main() {
      if (u_hasData == 0) {
        // Subtle translucent boundary tint when no data texture is active
        gl_FragColor = vec4(0.04, 0.25, 0.4, 0.12);
        return;
      }

      vec4 sampleVal = texture2D(u_dataTexture, vUv);
      float normVal = sampleVal.r;

      // Mask NaN / Land values (< 0 or invalid)
      if (normVal < 0.0 || normVal > 1.0 || sampleVal.a < 0.5) {
        discard;
      }

      vec3 color = turboColormap(normVal);
      if (u_colormap == 1) color = viridisColormap(normVal);

      gl_FragColor = vec4(color, u_opacity);
    }
  `,
};

export class ModelCoverageLayer {
  constructor(options = {}) {
    this.radius = options.radius || (EARTH_RADIUS * 1.002);
    this.bounds = options.bounds || DEFAULT_INDIAN_OCEAN_BOUNDS; // 30-120E, -30-30N

    this.group = new THREE.Group();
    this.group.name = 'ModelCoverageLayer';

    this.borderMesh = null;
    this.surfaceMesh = null;
    this.dataTexture = null;

    this._buildBoundary();
    this._buildSurfaceMesh();
  }

  _buildBoundary() {
    if (this.borderMesh) {
      this.group.remove(this.borderMesh);
      if (this.borderMesh.geometry) this.borderMesh.geometry.dispose();
      if (this.borderMesh.material) this.borderMesh.material.dispose();
      this.borderMesh = null;
    }

    const { minLon, maxLon, minLat, maxLat } = this.bounds;
    const borderPoints = [];
    const bRadius = this.radius * 1.001; // Sits above data surface

    // 4 boundary edges: South, East, North, West
    const edges = [
      [[minLon, minLat], [maxLon, minLat]], // South
      [[maxLon, minLat], [maxLon, maxLat]], // East
      [[maxLon, maxLat], [minLon, maxLat]], // North
      [[minLon, maxLat], [minLon, minLat]], // West
    ];

    edges.forEach(([p1, p2]) => {
      const waypoints = interpolateGreatCircle(p1[1], p1[0], p2[1], p2[0], 1.5);
      for (let i = 0; i < waypoints.length - 1; i++) {
        const w1 = latLonToGlobe(waypoints[i].lat, waypoints[i].lon, bRadius);
        const w2 = latLonToGlobe(waypoints[i + 1].lat, waypoints[i + 1].lon, bRadius);
        borderPoints.push(w1.x, w1.y, w1.z);
        borderPoints.push(w2.x, w2.y, w2.z);
      }
    });

    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPoints, 3));

    const borderMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4, // Cyan glowing model boundary
      transparent: true,
      opacity: 0.85,
      linewidth: 2.0,
    });

    this.borderMesh = new THREE.LineSegments(borderGeo, borderMat);
    this.borderMesh.name = 'ModelCoverageBoundary';
    this.group.add(this.borderMesh);
  }

  _buildSurfaceMesh() {
    if (this.surfaceMesh) {
      this.group.remove(this.surfaceMesh);
      if (this.surfaceMesh.geometry) this.surfaceMesh.geometry.dispose();
      if (this.surfaceMesh.material) this.surfaceMesh.material.dispose();
      this.surfaceMesh = null;
    }

    const { minLon, maxLon, minLat, maxLat } = this.bounds;
    const lonSteps = 90; // 1 step per degree lon
    const latSteps = 60; // 1 step per degree lat

    const vertices = [];
    const uvs = [];
    const indices = [];

    for (let j = 0; j <= latSteps; j++) {
      const lat = minLat + (j / latSteps) * (maxLat - minLat);
      const v = j / latSteps;

      for (let i = 0; i <= lonSteps; i++) {
        const lon = minLon + (i / lonSteps) * (maxLon - minLon);
        const u = i / lonSteps;

        const pos = latLonToGlobe(lat, lon, this.radius);
        vertices.push(pos.x, pos.y, pos.z);
        uvs.push(u, v);
      }
    }

    for (let j = 0; j < latSteps; j++) {
      for (let i = 0; i < lonSteps; i++) {
        const a = j * (lonSteps + 1) + i;
        const b = a + 1;
        const c = (j + 1) * (lonSteps + 1) + i;
        const d = c + 1;

        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const surfGeo = new THREE.BufferGeometry();
    surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    surfGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    surfGeo.setIndex(indices);
    surfGeo.computeVertexNormals();

    this.surfMaterial = new THREE.ShaderMaterial({
      vertexShader: ColormapShader.vertexShader,
      fragmentShader: ColormapShader.fragmentShader,
      uniforms: {
        u_dataTexture: { value: null },
        u_hasData: { value: 0 },
        u_colormap: { value: 0 },
        u_opacity: { value: 0.85 },
      },
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });

    this.surfaceMesh = new THREE.Mesh(surfGeo, this.surfMaterial);
    this.surfaceMesh.name = 'ModelSurfaceMesh';
    this.group.add(this.surfaceMesh);
  }

  /**
   * Updates the scientific surface scalar field on the spherical model sector.
   *
   * @param {Float32Array|Uint8Array} data - Normalized scalar values [0, 1] or Float32 values
   * @param {number} width - Lon dimension
   * @param {number} height - Lat dimension
   * @param {number} [colormapCode=0] - 0: Turbo, 1: Viridis
   */
  updateSurfaceData(data, width, height, colormapCode = 0) {
    if (!data || width <= 0 || height <= 0) {
      if (this.surfMaterial) {
        this.surfMaterial.uniforms.u_hasData.value = 0;
      }
      return;
    }

    if (this.dataTexture) {
      this.dataTexture.dispose();
    }

    // Create Luminance / Alpha DataTexture
    const textureData = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const val = data[i];
      if (isNaN(val) || val === null || val < 0.0) {
        textureData[i * 4 + 0] = 0;
        textureData[i * 4 + 1] = 0;
        textureData[i * 4 + 2] = 0;
        textureData[i * 4 + 3] = 0; // Transparent
      } else {
        const byteVal = Math.min(255, Math.max(0, Math.floor(val * 255)));
        textureData[i * 4 + 0] = byteVal;
        textureData[i * 4 + 1] = byteVal;
        textureData[i * 4 + 2] = byteVal;
        textureData[i * 4 + 3] = 255; // Valid
      }
    }

    this.dataTexture = new THREE.DataTexture(
      textureData,
      width,
      height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.dataTexture.minFilter = THREE.LinearFilter;
    this.dataTexture.magFilter = THREE.LinearFilter;
    this.dataTexture.needsUpdate = true;

    if (this.surfMaterial) {
      this.surfMaterial.uniforms.u_dataTexture.value = this.dataTexture;
      this.surfMaterial.uniforms.u_hasData.value = 1;
      this.surfMaterial.uniforms.u_colormap.value = colormapCode;
    }
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    if (this.borderMesh) {
      this.group.remove(this.borderMesh);
      if (this.borderMesh.geometry) this.borderMesh.geometry.dispose();
      if (this.borderMesh.material) this.borderMesh.material.dispose();
      this.borderMesh = null;
    }
    if (this.surfaceMesh) {
      this.group.remove(this.surfaceMesh);
      if (this.surfaceMesh.geometry) this.surfaceMesh.geometry.dispose();
      if (this.surfaceMesh.material) this.surfaceMesh.material.dispose();
      this.surfaceMesh = null;
    }
    if (this.dataTexture) {
      this.dataTexture.dispose();
      this.dataTexture = null;
    }
  }
}
