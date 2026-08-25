/**
 * LandLayer
 * Renders authentic Natural Earth 10m land polygon geometry across the Indian Ocean domain.
 * Subtle, dark, low visual dominance beneath coastlines and Argo observations.
 * Accurately projects geographic coordinates (Lon, Lat) into normalized scene world space (X, Z).
 */

import * as THREE from 'three';
import { lonLatToWorld, DEFAULT_INDIAN_OCEAN_BOUNDS, DEFAULT_GEOMETRY_SCALE } from '../../utils/geography';

export class LandLayer {
  constructor(options = {}) {
    this.yLevel = options.yLevel || 0.301;
    this.xScale = options.xScale || DEFAULT_GEOMETRY_SCALE.xScale;
    this.zScale = options.zScale || DEFAULT_GEOMETRY_SCALE.zScale;
    this.bounds = options.bounds || DEFAULT_INDIAN_OCEAN_BOUNDS;

    this.group = new THREE.Group();
    this.group.name = 'LandLayer';

    this.mesh = null;
    this.geoJsonData = null;

    this._loadAndBuild();
  }

  async _loadAndBuild() {
    try {
      const response = await fetch('/geography/land.geojson');
      if (!response.ok) {
        throw new Error(`Failed to load land.geojson: ${response.status}`);
      }
      this.geoJsonData = await response.json();
      this._buildLandGeometry();
    } catch (err) {
      console.warn('[LandLayer] GeoJSON fetch warning:', err.message);
    }
  }

  _buildLandGeometry() {
    // Clean up existing mesh
    if (this.mesh) {
      this.group.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
      this.mesh = null;
    }

    if (!this.geoJsonData?.features) return;

    const { minLon, maxLon, minLat, maxLat } = this.bounds;
    const vertices = [];
    const indices = [];
    let vertexOffset = 0;

    const scale = { xScale: this.xScale, zScale: this.zScale };

    const processPolygon = (rings) => {
      if (!rings || rings.length === 0) return;
      const outerRing = rings[0];
      if (outerRing.length < 3) return;

      // Check if ring is within domain bounds (with padding)
      const xs = outerRing.map(p => p[0]);
      const ys = outerRing.map(p => p[1]);
      if (
        Math.max(...xs) < minLon - 5 ||
        Math.min(...xs) > maxLon + 5 ||
        Math.max(...ys) < minLat - 5 ||
        Math.min(...ys) > maxLat + 5
      ) {
        return;
      }

      // Convert outer ring to 2D Vector2 for triangulation
      const contour = outerRing.map(p => new THREE.Vector2(p[0], p[1]));

      // Triangulate outer ring
      let triangles;
      try {
        triangles = THREE.ShapeUtils.triangulateShape(contour, []);
      } catch {
        return;
      }

      if (!triangles || triangles.length === 0) return;

      // Project vertices to 3D world space
      const baseIndex = vertexOffset;
      for (let i = 0; i < outerRing.length; i++) {
        const pt = outerRing[i];
        const w = lonLatToWorld(pt[0], pt[1], this.yLevel, this.bounds, scale);
        vertices.push(w.x, w.y, w.z);
        vertexOffset++;
      }

      // Add triangle face indices
      for (let t = 0; t < triangles.length; t++) {
        const tri = triangles[t];
        indices.push(baseIndex + tri[0], baseIndex + tri[1], baseIndex + tri[2]);
      }
    };

    this.geoJsonData.features.forEach((feat) => {
      const geom = feat.geometry;
      if (!geom) return;

      if (geom.type === 'Polygon') {
        processPolygon(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => processPolygon(poly));
      }
    });

    if (vertices.length > 0 && indices.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      // Subtle, dark, low-dominance land material (Phase 8)
      const material = new THREE.MeshStandardMaterial({
        color: 0x07111e,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.receiveShadow = true;
      this.group.add(this.mesh);
    }
  }

  updateBounds(bounds, xScale, zScale, yLevel) {
    if (bounds) this.bounds = bounds;
    if (xScale !== undefined) this.xScale = xScale;
    if (zScale !== undefined) this.zScale = zScale;
    if (yLevel !== undefined) this.yLevel = yLevel;
    if (this.geoJsonData) {
      this._buildLandGeometry();
    }
  }

  setYLevel(yLevel) {
    this.yLevel = yLevel;
    if (this.mesh) {
      this.mesh.position.y = yLevel - 0.301;
    }
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
