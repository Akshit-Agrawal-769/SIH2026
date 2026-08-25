import * as THREE from 'three';
import { CurrentParticleVertexShader, CurrentParticleFragmentShader } from '../shaders/CurrentParticleShader';

export class CurrentVectorField {
  constructor(options = {}) {
    this.count = options.count || 2400;
    this.yLevel = options.yLevel !== undefined ? options.yLevel : 0.305; // slightly above water surface

    // Instanced Line / Point Geometry
    const lineGeo = new THREE.BufferGeometry();
    const lineVertices = new Float32Array([
      0, 0, -0.015,
      0, 0, 0.015,
    ]);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));

    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = lineGeo.index;
    this.geometry.attributes.position = lineGeo.attributes.position;

    const offsets = new Float32Array(this.count * 3);
    const velocities = new Float32Array(this.count * 2);
    const phases = new Float32Array(this.count);

    const gridSize = Math.floor(Math.sqrt(this.count));
    let idx = 0;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = (i / gridSize - 0.5) * 1.0 + (Math.random() - 0.5) * (1.0 / gridSize);
        const z = (j / gridSize - 0.5) * 1.0 + (Math.random() - 0.5) * (1.0 / gridSize);

        offsets[idx * 3] = x;
        offsets[idx * 3 + 1] = 0;
        offsets[idx * 3 + 2] = z;

        // Realistic Indian Ocean Circulation (Zonal jets & Arabian Sea / Bay of Bengal gyres)
        const gyre1X = -0.15;
        const gyre1Z = -0.1;
        const dx1 = x - gyre1X;
        const dz1 = z - gyre1Z;
        const r1 = Math.sqrt(dx1 * dx1 + dz1 * dz1) + 0.05;

        // Clockwise & Zonal current components
        const u = (-dz1 / r1) * 0.45 + (0.35 * Math.sin(z * 4.0)) + 0.2;
        const v = (dx1 / r1) * 0.45 + (0.15 * Math.cos(x * 4.0));

        velocities[idx * 2] = u;
        velocities[idx * 2 + 1] = v;

        phases[idx] = Math.random();
        idx++;
      }
    }

    this.geometry.setAttribute('a_offset', new THREE.InstancedBufferAttribute(offsets, 3));
    this.geometry.setAttribute('a_velocity', new THREE.InstancedBufferAttribute(velocities, 2));
    this.geometry.setAttribute('a_phase', new THREE.InstancedBufferAttribute(phases, 1));

    this.uniforms = {
      u_time: { value: 0.0 },
      u_speed: { value: 1.0 },
      u_yLevel: { value: this.yLevel },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: CurrentParticleVertexShader,
      fragmentShader: CurrentParticleFragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.LineSegments(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  update(elapsedTime) {
    if (this.uniforms?.u_time) {
      this.uniforms.u_time.value = elapsedTime;
    }
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  setYLevel(y) {
    if (this.uniforms?.u_yLevel) {
      this.uniforms.u_yLevel.value = y;
    }
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}
