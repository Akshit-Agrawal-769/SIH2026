/**
 * CoastlineLayer
 * Renders authentic Natural Earth 10m coastline vectors across the Indian Ocean domain.
 * Thin, precise, crisp, restrained line visibility above ocean and land layers.
 * Accurately projects geographic coordinates (Lon, Lat) into normalized scene world space (X, Z).
 */

import * as THREE from 'three';
import { lonLatToWorld, DEFAULT_INDIAN_OCEAN_BOUNDS, DEFAULT_GEOMETRY_SCALE } from '../../utils/geography';

export class CoastlineLayer {
  constructor(options = {}) {
    this.yLevel = options.yLevel || 0.303;
    this.xScale = options.xScale || DEFAULT_GEOMETRY_SCALE.xScale;
    this.zScale = options.zScale || DEFAULT_GEOMETRY_SCALE.zScale;
    this.bounds = options.bounds || DEFAULT_INDIAN_OCEAN_BOUNDS;

    this.group = new THREE.Group();
    this.group.name = 'CoastlineLayer';

    this.lineMesh = null;
    this.geoJsonData = null;

    this._loadAndBuild();
  }

  async _loadAndBuild() {
    try {
      const response = await fetch('/geography/coastline.geojson');
      if (!response.ok) {
        throw new Error(`Failed to load coastline.geojson: ${response.status}`);
      }
      this.geoJsonData = await response.json();
      this._buildCoastlines();
    } catch (err) {
      console.warn('[CoastlineLayer] GeoJSON fetch warning:', err.message);
    }
  }

  _buildCoastlines() {
    // Clean up existing mesh
    if (this.lineMesh) {
      this.group.remove(this.lineMesh);
      if (this.lineMesh.geometry) this.lineMesh.geometry.dispose();
      if (this.lineMesh.material) this.lineMesh.material.dispose();
      this.lineMesh = null;
    }

    if (!this.geoJsonData?.features) return;

    const { minLon, maxLon, minLat, maxLat } = this.bounds;
    const linePoints = [];
    const scale = { xScale: this.xScale, zScale: this.zScale };

    const processLine = (coords) => {
      if (!coords || coords.length < 2) return;
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        // Clip segments outside domain bounds (+ padding)
        if (
          (p1[0] >= minLon - 5 && p1[0] <= maxLon + 5 && p1[1] >= minLat - 5 && p1[1] <= maxLat + 5) ||
          (p2[0] >= minLon - 5 && p2[0] <= maxLon + 5 && p2[1] >= minLat - 5 && p2[1] <= maxLat + 5)
        ) {
          const v1 = lonLatToWorld(p1[0], p1[1], this.yLevel, this.bounds, scale);
          const v2 = lonLatToWorld(p2[0], p2[1], this.yLevel, this.bounds, scale);
          linePoints.push(v1.x, v1.y, v1.z);
          linePoints.push(v2.x, v2.y, v2.z);
        }
      }
    };

    this.geoJsonData.features.forEach((feat) => {
      const geom = feat.geometry;
      if (!geom) return;

      if (geom.type === 'LineString') {
        processLine(geom.coordinates);
      } else if (geom.type === 'MultiLineString') {
        geom.coordinates.forEach(line => processLine(line));
      }
    });

    if (linePoints.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));

      // Phase 8: Thin, precise, crisp, restrained line styling
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
        linewidth: 1.0,
      });

      this.lineMesh = new THREE.LineSegments(lineGeo, lineMat);
      this.group.add(this.lineMesh);
    }
  }

  updateBounds(bounds, xScale, zScale, yLevel) {
    if (bounds) this.bounds = bounds;
    if (xScale !== undefined) this.xScale = xScale;
    if (zScale !== undefined) this.zScale = zScale;
    if (yLevel !== undefined) this.yLevel = yLevel;
    if (this.geoJsonData) {
      this._buildCoastlines();
    }
  }

  setYLevel(yLevel) {
    this.yLevel = yLevel;
    if (this.lineMesh) {
      this.lineMesh.position.y = yLevel - 0.303;
    }
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    if (this.lineMesh) {
      this.group.remove(this.lineMesh);
      if (this.lineMesh.geometry) this.lineMesh.geometry.dispose();
      if (this.lineMesh.material) this.lineMesh.material.dispose();
      this.lineMesh = null;
    }
  }
}