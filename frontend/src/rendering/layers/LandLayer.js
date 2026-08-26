/**
 * LandLayer
 * Renders authentic Natural Earth 10m land polygon geometry conforming to the 3D Spherical Earth.
 * Subtle, dark, low visual dominance beneath coastlines and Argo observations.
 * Projects geographic coordinates (Lon, Lat) into spherical 3D surface space with radial normals.
 */

import * as THREE from 'three';
import { latLonToGlobe, EARTH_RADIUS } from '../../utils/geography';

export class LandLayer {
  constructor(options = {}) {
    this.radius = options.radius || (EARTH_RADIUS * 1.001); // 1.001 sits between ocean sphere and coastlines
    this.color = options.color || 0x081726; // Dark oceanic continental landmass
    this.opacity = options.opacity !== undefined ? options.opacity : 0.92;

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

    const vertices = [];
    const indices = [];
    let vertexOffset = 0;

    const processPolygon = (rings) => {
      if (!rings || rings.length === 0) return;
      const outerRing = rings[0];
      if (outerRing.length < 3) return;

      // Filter extreme antimeridian wraps that would cause triangulation artifacts
      let hasWrap = false;
      for (let i = 0; i < outerRing.length - 1; i++) {
        if (Math.abs(outerRing[i][0] - outerRing[i + 1][0]) > 180.0) {
          hasWrap = true;
          break;
        }
      }
      if (hasWrap) return;

      // Convert outer ring to 2D Vector2 for ear-clipping triangulation
      const contour = outerRing.map((p) => new THREE.Vector2(p[0], p[1]));

      let triangles;
      try {
        triangles = THREE.ShapeUtils.triangulateShape(contour, []);
      } catch {
        return;
      }

      if (!triangles || triangles.length === 0) return;

      // Project 2D Lon/Lat vertices to 3D Spherical coordinates
      const baseIndex = vertexOffset;
      for (let i = 0; i < outerRing.length; i++) {
        const pt = outerRing[i]; // [lon, lat]
        const w = latLonToGlobe(pt[1], pt[0], this.radius);
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
        geom.coordinates.forEach((poly) => processPolygon(poly));
      }
    });

    if (vertices.length > 0 && indices.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      // Subtle, dark, low-dominance land material
      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.95,
        metalness: 0.05,
        transparent: true,
        opacity: this.opacity,
        side: THREE.FrontSide,
        depthWrite: true,
      });

      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.name = 'LandPolygons';
      this.mesh.receiveShadow = true;
      this.group.add(this.mesh);
    }
  }

  setRadius(radius) {
    this.radius = radius;
    if (this.geoJsonData) {
      this._buildLandGeometry();
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
