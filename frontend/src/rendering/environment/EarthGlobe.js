/**
 * EarthGlobe
 * High-resolution 3D Earth Sphere and Atmospheric Rim Glow.
 * Real geographic radius baseline (R = 1.0).
 * High polygon fidelity (128x64 segments).
 * Restrained, scientific, deep-ocean physical material and view-angle dependent atmospheric scattering.
 */

import * as THREE from 'three';
import { EARTH_RADIUS } from '../../utils/geography';

const AtmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AtmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform vec3 u_atmosphereColor;
  uniform float u_glowIntensity;
  uniform float u_falloffPower;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float cosTheta = dot(vNormal, viewDir);
    // Fresnel rim factor: peaks at grazing angles (horizon)
    float fresnel = 1.0 - max(0.0, cosTheta);
    float glow = pow(fresnel, u_falloffPower) * u_glowIntensity;

    gl_FragColor = vec4(u_atmosphereColor, glow);
  }
`;

export class EarthGlobe {
  constructor(options = {}) {
    this.radius = options.radius || EARTH_RADIUS; // 1.0
    this.group = new THREE.Group();
    this.group.name = 'EarthGlobe';

    this._buildGlobe();
    this._buildAtmosphere();
  }

  _buildGlobe() {
    // 1. High-Resolution Earth Sphere Geometry (128x64 segments)
    const sphereGeo = new THREE.SphereGeometry(this.radius, 128, 64);

    // 2. Scientific Deep Ocean Material with subtle specular sheen
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x061124,       // Deep oceanic abyss
      roughness: 0.35,       // Water surface glossiness
      metalness: 0.1,
      bumpScale: 0.005,
    });

    this.globeMesh = new THREE.Mesh(sphereGeo, oceanMat);
    this.globeMesh.name = 'EarthOceanSphere';
    this.globeMesh.receiveShadow = true;
    this.globeMesh.castShadow = true;
    this.group.add(this.globeMesh);
  }

  _buildAtmosphere() {
    // Atmosphere shell slightly above the surface (radius * 1.025)
    const atmosGeo = new THREE.SphereGeometry(this.radius * 1.025, 64, 32);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: AtmosphereVertexShader,
      fragmentShader: AtmosphereFragmentShader,
      uniforms: {
        u_atmosphereColor: { value: new THREE.Color(0x38bdf8) }, // Crisp cyan atmospheric rim
        u_glowIntensity: { value: 0.85 },
        u_falloffPower: { value: 3.5 },
      },
      side: THREE.BackSide, // Visible around the planetary horizon
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.atmosphereMesh.name = 'AtmosphericGlow';
    this.group.add(this.atmosphereMesh);
  }

  setAtmosphereVisible(visible) {
    if (this.atmosphereMesh) {
      this.atmosphereMesh.visible = !!visible;
    }
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    if (this.globeMesh) {
      this.group.remove(this.globeMesh);
      if (this.globeMesh.geometry) this.globeMesh.geometry.dispose();
      if (this.globeMesh.material) this.globeMesh.material.dispose();
      this.globeMesh = null;
    }
    if (this.atmosphereMesh) {
      this.group.remove(this.atmosphereMesh);
      if (this.atmosphereMesh.geometry) this.atmosphereMesh.geometry.dispose();
      if (this.atmosphereMesh.material) this.atmosphereMesh.material.dispose();
      this.atmosphereMesh = null;
    }
  }
}
