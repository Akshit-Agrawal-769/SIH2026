import * as THREE from 'three';

export class BathymetricFloor {
  constructor(options = {}) {
    this.size = options.size || 2.4;
    this.segments = options.segments || 64;
    this.yPosition = options.yPosition !== undefined ? options.yPosition : -0.3; // matches ocean seabed depth level

    this.group = new THREE.Group();
    this.group.position.y = this.yPosition;

    // 1. Procedural Bathymetry Plane Geometry
    this.geometry = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    this.geometry.rotateX(-Math.PI / 2);

    // Apply procedural underwater ridges, trenches, and continental shelf elevation
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Natural bathymetric undulation
      const depthOffset = Math.sin(x * 3.5) * Math.cos(z * 3.0) * 0.04 - (Math.sin(x * 7.0 + z * 5.0) * 0.015);
      pos.setY(i, depthOffset);
    }
    this.geometry.computeVertexNormals();

    // 2. Bathymetric Material with depth contouring
    this.material = new THREE.MeshStandardMaterial({
      color: 0x071e2c,
      roughness: 0.85,
      metalness: 0.15,
      wireframe: false,
      flatShading: true,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // 3. Bathymetric Wireframe Grid Overlay
    this.wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x0e7490,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    this.wireframeMesh = new THREE.Mesh(this.geometry, this.wireframeMat);
    this.group.add(this.wireframeMesh);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.wireframeMat) this.wireframeMat.dispose();
  }
}
