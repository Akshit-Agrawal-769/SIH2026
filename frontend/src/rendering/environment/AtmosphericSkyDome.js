import * as THREE from 'three';

export class AtmosphericSkyDome {
  constructor() {
    // Inverted hemisphere / sphere for atmospheric sky dome
    this.geometry = new THREE.SphereGeometry(30, 32, 24);

    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 u_topColor;
      uniform vec3 u_bottomColor;
      uniform vec3 u_sunPosition;
      uniform float u_offset;
      uniform float u_exponent;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, u_offset, 0.0)).y;
        vec3 sky = mix(u_bottomColor, u_topColor, max(pow(max(h, 0.0), u_exponent), 0.0));

        // Subtle Sun Flare on Horizon
        vec3 dirToSun = normalize(u_sunPosition);
        vec3 dirToVertex = normalize(vWorldPosition);
        float sunDot = max(dot(dirToVertex, dirToSun), 0.0);
        float sunGlow = pow(sunDot, 64.0) * 0.45;
        sky += vec3(0.7, 0.85, 1.0) * sunGlow;

        gl_FragColor = vec4(sky, 1.0);
      }
    `;

    this.uniforms = {
      u_topColor: { value: new THREE.Color(0x040915) },      // Deep Atmospheric Zenith
      u_bottomColor: { value: new THREE.Color(0x0d2038) },   // Ocean Horizon Haze
      u_sunPosition: { value: new THREE.Vector3(25.0, 35.0, 30.0) },
      u_offset: { value: 1.5 },
      u_exponent: { value: 0.7 },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}
