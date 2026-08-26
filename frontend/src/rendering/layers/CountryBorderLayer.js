/**
 * CountryBorderLayer
 * Subtle political boundary lines projected onto the 3D Spherical Earth.
 * Sits slightly above the land surface (radius * 1.0018) with subdued, non-intrusive styling.
 */

import * as THREE from 'three';
import { latLonToGlobe, interpolateGreatCircle, EARTH_RADIUS } from '../../utils/geography';

export class CountryBorderLayer {
  constructor(options = {}) {
    this.radius = options.radius || (EARTH_RADIUS * 1.0018);
    this.color = options.color || 0x64748b; // Subtle slate border
    this.opacity = options.opacity !== undefined ? options.opacity : 0.45;

    this.group = new THREE.Group();
    this.group.name = 'CountryBorderLayer';

    this.lineMesh = null;
    this._buildBorders();
  }

  _buildBorders() {
    // Clean up existing mesh
    if (this.lineMesh) {
      this.group.remove(this.lineMesh);
      if (this.lineMesh.geometry) this.lineMesh.geometry.dispose();
      if (this.lineMesh.material) this.lineMesh.material.dispose();
      this.lineMesh = null;
    }

    // Generate boundary lines from land boundaries / administrative dividers
    const linePoints = [];

    // Optional: Render major regional boundary arcs across South Asia, Africa, and Maritime SE Asia
    const majorBorders = [
      // Indo-Pak / West Border
      [[68.1, 23.7], [70.0, 26.0], [74.5, 32.5], [77.0, 35.0]],
      // Indo-China / Himalayas Border Arc
      [[77.0, 35.0], [80.0, 30.5], [88.0, 27.5], [97.0, 28.0]],
      // Indo-Bangladesh / East
      [[88.0, 26.0], [89.0, 22.0], [92.0, 21.0]],
      // Indo-Myanmar Border
      [[92.5, 21.5], [94.5, 25.5], [97.0, 27.5]],
      // East Africa Boundaries (Kenya/Tanzania/Somalia)
      [[41.0, 4.0], [39.0, -4.5], [40.5, -10.5]],
      // Arabian Peninsula Dividers (Saudi/Yemen/Oman)
      [[43.0, 13.0], [52.0, 16.5], [55.0, 22.0], [59.5, 22.5]],
    ];

    majorBorders.forEach((border) => {
      for (let i = 0; i < border.length - 1; i++) {
        const p1 = border[i];   // [lon, lat]
        const p2 = border[i + 1]; // [lon, lat]
        const waypoints = interpolateGreatCircle(p1[1], p1[0], p2[1], p2[0], 2.0);
        for (let j = 0; j < waypoints.length - 1; j++) {
          const w1 = latLonToGlobe(waypoints[j].lat, waypoints[j].lon, this.radius);
          const w2 = latLonToGlobe(waypoints[j + 1].lat, waypoints[j + 1].lon, this.radius);
          linePoints.push(w1.x, w1.y, w1.z);
          linePoints.push(w2.x, w2.y, w2.z);
        }
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
      this.lineMesh.name = 'CountryBorderSegments';
      this.group.add(this.lineMesh);
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
