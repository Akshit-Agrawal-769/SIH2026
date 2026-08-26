/**
 * CoastlineLayer
 * Renders authentic Natural Earth 10m coastline vectors projected directly onto the 3D Spherical Earth.
 * Thin, precise, crisp, restrained line visibility above ocean and land layers.
 * Uses great-circle interpolation to ensure lines follow Earth's spherical curvature without interior clipping.
 */

import * as THREE from 'three';
import { latLonToGlobe, interpolateGreatCircle, EARTH_RADIUS } from '../../utils/geography';

export class CoastlineLayer {
  constructor(options = {}) {
    this.radius = options.radius || (EARTH_RADIUS * 1.0025); // 1.0025 sits slightly above globe
    this.color = options.color || 0x38bdf8;
    this.opacity = options.opacity !== undefined ? options.opacity : 0.85;

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

    const linePoints = [];

    const processLine = (coords) => {
      if (!coords || coords.length < 2) return;
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];   // [lon, lat]
        const p2 = coords[i + 1]; // [lon, lat]

        // Handle date-line wrap or invalid anomalies
        if (Math.abs(p1[0] - p2[0]) > 180.0) continue;

        // Spherical great-circle interpolation for long segments
        const waypoints = interpolateGreatCircle(p1[1], p1[0], p2[1], p2[0], 2.0);
        for (let j = 0; j < waypoints.length - 1; j++) {
          const w1 = latLonToGlobe(waypoints[j].lat, waypoints[j].lon, this.radius);
          const w2 = latLonToGlobe(waypoints[j + 1].lat, waypoints[j + 1].lon, this.radius);
          linePoints.push(w1.x, w1.y, w1.z);
          linePoints.push(w2.x, w2.y, w2.z);
        }
      }
    };

    this.geoJsonData.features.forEach((feat) => {
      const geom = feat.geometry;
      if (!geom) return;

      if (geom.type === 'LineString') {
        processLine(geom.coordinates);
      } else if (geom.type === 'MultiLineString') {
        geom.coordinates.forEach((line) => processLine(line));
      }
    });

    if (linePoints.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));

      const lineMat = new THREE.LineBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: this.opacity,
        linewidth: 1.0,
      });

      this.lineMesh = new THREE.LineSegments(lineGeo, lineMat);
      this.lineMesh.name = 'CoastlineSegments';
      this.group.add(this.lineMesh);
    }
  }

  setRadius(radius) {
    this.radius = radius;
    if (this.geoJsonData) {
      this._buildCoastlines();
    }
  }

  setColor(color) {
    this.color = color;
    if (this.lineMesh?.material) {
      this.lineMesh.material.color.set(color);
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