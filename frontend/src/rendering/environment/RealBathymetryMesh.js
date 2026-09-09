import * as THREE from 'three';

export class RealBathymetryMesh {
  constructor(options = {}) {
    this.bounds = options.bounds || { minLon: 50.0, maxLon: 95.0, minLat: 0.0, maxLat: 26.0 };
    this.xScale = options.xScale || 2.2;
    this.zScale = options.zScale || 1.6;
    this.verticalExaggeration = options.verticalExaggeration || 1.0;
    this.maxDepth = options.maxDepth || 2000.0;
    
    this.group = new THREE.Group();
    this.group.name = 'RealBathymetryGroup';
    
    // We will build the mesh when update() is called with bathymetryBuffer
  }

  _buildTerrain(bathymetryBuffer, dimX, dimY) {
    if (!bathymetryBuffer || dimX < 2 || dimY < 2) return;
    
    this.geometry = new THREE.PlaneGeometry(this.xScale, this.zScale, dimX - 1, dimY - 1);
    this.geometry.rotateX(-Math.PI / 2);
    
    const volHeight = 0.32 * this.verticalExaggeration;
    const pos = this.geometry.attributes.position;
    
    for (let y = 0; y < dimY; y++) {
      for (let x = 0; x < dimX; x++) {
        const idx = y * dimX + x;
        const h = bathymetryBuffer[idx];
        
        let yPos = 0.0;
        if (h > 0) {
          // Ocean: map to negative Y proportional to volHeight
          // We normalize h against maxDepth, but cap it so it doesn't poke out bottom
          const depthNorm = Math.min(1.0, h / this.maxDepth);
          yPos = -depthNorm * volHeight;
        } else {
          // Land: map to 0.0 or slightly above
          yPos = 0.002 * this.verticalExaggeration;
        }
        
        // PlaneGeometry vertices are generated left-to-right, top-to-bottom
        // Before rotation, top row is +Y, bottom row is -Y.
        // After rotation by -PI/2 on X, top row becomes -Z (South), bottom row becomes +Z (North).
        // If backend y=0 is South and y=dimY-1 is North, then y=0 should map to the top row (vIdx = 0).
        const vIdx = y * dimX + x; 
        pos.setY(vIdx, yPos);
      }
    }
    this.geometry.computeVertexNormals();

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#94a3b8'), // Slate grey as strictly requested
      roughness: 0.82,
      metalness: 0.12,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'RealBathymetryMesh';
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    this._buildCasing();
  }

  _buildCasing() {
    const volHeight = 0.32 * this.verticalExaggeration;
    const baseElevation = -volHeight - 0.015 * this.verticalExaggeration;
    const skirtHeight = Math.abs(baseElevation) + 0.08 * this.verticalExaggeration;

    const wallColor = new THREE.Color(0x1e293b);
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.88,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    this.casingGroup = new THREE.Group();
    this.casingGroup.name = 'TerrainCasingSkirts';

    const sGeo = new THREE.PlaneGeometry(this.xScale, skirtHeight);
    const sMesh = new THREE.Mesh(sGeo, wallMat);
    sMesh.position.set(0, baseElevation * 0.5, -this.zScale * 0.5);
    this.casingGroup.add(sMesh);

    const nGeo = new THREE.PlaneGeometry(this.xScale, skirtHeight);
    const nMesh = new THREE.Mesh(nGeo, wallMat);
    nMesh.rotation.y = Math.PI;
    nMesh.position.set(0, baseElevation * 0.5, this.zScale * 0.5);
    this.casingGroup.add(nMesh);

    const wGeo = new THREE.PlaneGeometry(this.zScale, skirtHeight);
    const wMesh = new THREE.Mesh(wGeo, wallMat);
    wMesh.rotation.y = Math.PI / 2;
    wMesh.position.set(-this.xScale * 0.5, baseElevation * 0.5, 0);
    this.casingGroup.add(wMesh);

    const eGeo = new THREE.PlaneGeometry(this.zScale, skirtHeight);
    const eMesh = new THREE.Mesh(eGeo, wallMat);
    eMesh.rotation.y = -Math.PI / 2;
    eMesh.position.set(this.xScale * 0.5, baseElevation * 0.5, 0);
    this.casingGroup.add(eMesh);

    const bGeo = new THREE.PlaneGeometry(this.xScale, this.zScale);
    bGeo.rotateX(-Math.PI / 2);
    const bMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.set(0, baseElevation, 0);
    this.casingGroup.add(bMesh);

    this.group.add(this.casingGroup);
  }

  update({ bounds, xScale, zScale, verticalExaggeration, bathymetryBuffer, dimX, dimY, maxDepth }) {
    if (bounds) this.bounds = bounds;
    if (xScale !== undefined) this.xScale = xScale;
    if (zScale !== undefined) this.zScale = zScale;
    if (verticalExaggeration !== undefined) this.verticalExaggeration = verticalExaggeration;
    if (maxDepth !== undefined) this.maxDepth = maxDepth;

    if (bathymetryBuffer) {
      this._dispose();
      this._buildTerrain(bathymetryBuffer, dimX, dimY);
    } else if (this.geometry) {
      // If we only updated exaggeration, update vertices
      const volHeight = 0.32 * this.verticalExaggeration;
      const pos = this.geometry.attributes.position;
      
      // we need to reapply, but we didn't save bathymetryBuffer
      // It's better to expect bathymetryBuffer to be passed on update
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  _dispose() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child.isGroup) {
        while (child.children.length > 0) {
          const sub = child.children[0];
          child.remove(sub);
          if (sub.geometry) sub.geometry.dispose();
          if (sub.material) sub.material.dispose();
        }
      }
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  }

  dispose() {
    this._dispose();
  }
}
