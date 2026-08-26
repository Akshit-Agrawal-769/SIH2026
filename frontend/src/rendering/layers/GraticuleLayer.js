/**
 * GraticuleLayer
 * Precision spherical Latitude & Longitude grid conforming to the 3D Earth Globe.
 * - Parallels every 10° (-80° to +80°)
 * - Meridians every 15° (-180° to +180°)
 * - Highlighted Equator (0°), Prime Meridian (0°), and Tropics (±23.44°)
 */

import * as THREE from 'three';
import { latLonToGlobe, EARTH_RADIUS } from '../../utils/geography';

export class GraticuleLayer {
  constructor(options = {}) {
    this.radius = options.radius || (EARTH_RADIUS * 1.0015);
    this.gridColor = options.gridColor || 0x1e293b;
    this.highlightColor = options.highlightColor || 0x0284c7;

    this.group = new THREE.Group();
    this.group.name = 'GraticuleLayer';

    this.gridMesh = null;
    this.highlightMesh = null;

    this._buildGraticule();
  }

  _buildGraticule() {
    this.dispose();

    const standardPoints = [];
    const highlightPoints = [];

    const numLonSteps = 120;
    const numLatSteps = 60;

    // 1. Parallels (Latitudes)
    for (let lat = -80; lat <= 80; lat += 10) {
      const isEquator = lat === 0;
      const targetArray = isEquator ? highlightPoints : standardPoints;

      for (let i = 0; i < numLonSteps; i++) {
        const lon1 = -180 + (i * 360) / numLonSteps;
        const lon2 = -180 + ((i + 1) * 360) / numLonSteps;
        const p1 = latLonToGlobe(lat, lon1, this.radius);
        const p2 = latLonToGlobe(lat, lon2, this.radius);
        targetArray.push(p1.x, p1.y, p1.z);
        targetArray.push(p2.x, p2.y, p2.z);
      }
    }

    // 1b. Tropics of Cancer (+23.44°) and Capricorn (-23.44°)
    [-23.44, 23.44].forEach((lat) => {
      for (let i = 0; i < numLonSteps; i++) {
        const lon1 = -180 + (i * 360) / numLonSteps;
        const lon2 = -180 + ((i + 1) * 360) / numLonSteps;
        const p1 = latLonToGlobe(lat, lon1, this.radius);
        const p2 = latLonToGlobe(lat, lon2, this.radius);
        highlightPoints.push(p1.x, p1.y, p1.z);
        highlightPoints.push(p2.x, p2.y, p2.z);
      }
    });

    // 2. Meridians (Longitudes)
    for (let lon = -180; lon < 180; lon += 15) {
      const isPrime = lon === 0 || lon === 180;
      const targetArray = isPrime ? highlightPoints : standardPoints;

      for (let i = 0; i < numLatSteps; i++) {
        const lat1 = -90 + (i * 180) / numLatSteps;
        const lat2 = -90 + ((i + 1) * 180) / numLatSteps;
        const p1 = latLonToGlobe(lat1, lon, this.radius);
        const p2 = latLonToGlobe(lat2, lon, this.radius);
        targetArray.push(p1.x, p1.y, p1.z);
        targetArray.push(p2.x, p2.y, p2.z);
      }
    }

    // Standard Grid Lines
    if (standardPoints.length > 0) {
      const stdGeo = new THREE.BufferGeometry();
      stdGeo.setAttribute('position', new THREE.Float32BufferAttribute(standardPoints, 3));
      const stdMat = new THREE.LineBasicMaterial({
        color: this.gridColor,
        transparent: true,
        opacity: 0.35,
      });
      this.gridMesh = new THREE.LineSegments(stdGeo, stdMat);
      this.gridMesh.name = 'StandardGraticule';
      this.group.add(this.gridMesh);
    }

    // Highlight Grid Lines (Equator, Prime Meridian, Tropics)
    if (highlightPoints.length > 0) {
      const hlGeo = new THREE.BufferGeometry();
      hlGeo.setAttribute('position', new THREE.Float32BufferAttribute(highlightPoints, 3));
      const hlMat = new THREE.LineBasicMaterial({
        color: this.highlightColor,
        transparent: true,
        opacity: 0.65,
      });
      this.highlightMesh = new THREE.LineSegments(hlGeo, hlMat);
      this.highlightMesh.name = 'HighlightedGraticule';
      this.group.add(this.highlightMesh);
    }
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    if (this.gridMesh) {
      this.group.remove(this.gridMesh);
      if (this.gridMesh.geometry) this.gridMesh.geometry.dispose();
      if (this.gridMesh.material) this.gridMesh.material.dispose();
      this.gridMesh = null;
    }
    if (this.highlightMesh) {
      this.group.remove(this.highlightMesh);
      if (this.highlightMesh.geometry) this.highlightMesh.geometry.dispose();
      if (this.highlightMesh.material) this.highlightMesh.material.dispose();
      this.highlightMesh = null;
    }
  }
}
