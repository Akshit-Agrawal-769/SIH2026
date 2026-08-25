import * as THREE from 'three';
import { WaterVertexShader, WaterFragmentShader } from '../shaders/RealisticWaterShader';

export class RealisticWaterSurface {
  constructor(options = {}) {
    this.size = options.size || 2.4;
    this.segments = options.segments || 96;
    this.yPosition = options.yPosition !== undefined ? options.yPosition : 0.3; // matches ocean surface level

    this.geometry = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    this.geometry.rotateX(-Math.PI / 2);

    this.uniforms = {
      u_time: { value: 0.0 },
      u_waveHeight: { value: 0.045 }, // Wave height amplitude
      u_waveSpeed: { value: 0.65 },
      u_waterDeepColor: { value: new THREE.Color(0x02172d) },     // Deep Navy Cyan
      u_waterShallowColor: { value: new THREE.Color(0x0284c7) },  // Surface Sky Blue
      u_sunDirection: { value: new THREE.Vector3(2.5, 4.5, 3.5).normalize() },
      u_sunColor: { value: new THREE.Color(0xbae6fd) },
      u_roughness: { value: 0.15 },
      u_opacity: { value: 0.88 },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: WaterVertexShader,
      fragmentShader: WaterFragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.y = this.yPosition;
    this.mesh.receiveShadow = true;
  }

  update(elapsedTime) {
    if (this.uniforms?.u_time) {
      this.uniforms.u_time.value = elapsedTime;
    }
  }

  setWaveHeight(height) {
    if (this.uniforms?.u_waveHeight) {
      this.uniforms.u_waveHeight.value = height;
    }
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}
