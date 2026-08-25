/**
 * CoastlineLayer
 * Renders authentic Natural Earth 50m coastline vectors across the Indian Ocean domain.
 * Accurately projects geographic coordinates (Lon, Lat) into normalized scene world space (X, Z).
 */

import * as THREE from 'three';
import coastlineData from '../../data/indian_ocean_coastline_50m.json';

export class CoastlineLayer {
  constructor(options = {}) {
    this.yLevel = options.yLevel || 0.302;
    this.xScale = options.xScale || 1.8;
    this.zScale = options.zScale || 1.2;
    this.bounds = options.bounds || { minLon: 30.0, maxLon: 120.0, minLat: -30.0, maxLat: 30.0 };

    this.group = new THREE.Group();
    this.group.name = 'CoastlineLayer';

    this.lineMesh = null;
    this.landMesh = null;

    this._buildCoastlines();
  }

  _buildCoastlines() {
    // Clean up existing
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    const { minLon, maxLon, minLat, maxLat } = this.bounds;
    const lonSpan = maxLon > minLon ? (maxLon - minLon) : 90.0;
    const latSpan = maxLat > minLat ? (maxLat - minLat) : 60.0;

    const linePoints = [];

    const projectPoint = (lon, lat) => {
      const normX = ((lon - minLon) / lonSpan - 0.5) * this.xScale;
      const normZ = ((lat - minLat) / latSpan - 0.5) * this.zScale;
      return new THREE.Vector3(normX, this.yLevel, normZ);
    };

    if (coastlineData && coastlineData.features) {
      coastlineData.features.forEach((feat) => {
        const geom = feat.geometry;
        if (!geom) return;

        if (geom.type === 'LineString') {
          const coords = geom.coordinates;
          for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i + 1];
            // Check if within or near domain bounds
            if (
              (p1[0] >= minLon - 5 && p1[0] <= maxLon + 5 && p1[1] >= minLat - 5 && p1[1] <= maxLat + 5) ||
              (p2[0] >= minLon - 5 && p2[0] <= maxLon + 5 && p2[1] >= minLat - 5 && p2[1] <= maxLat + 5)
            ) {
              const v1 = projectPoint(p1[0], p1[1]);
              const v2 = projectPoint(p2[0], p2[1]);
              linePoints.push(v1.x, v1.y, v1.z);
              linePoints.push(v2.x, v2.y, v2.z);
            }
          }
        } else if (geom.type === 'MultiLineString') {
          geom.coordinates.forEach((line) => {
            for (let i = 0; i < line.length - 1; i++) {
              const p1 = line[i];
              const p2 = line[i + 1];
              if (
                (p1[0] >= minLon - 5 && p1[0] <= maxLon + 5 && p1[1] >= minLat - 5 && p1[1] <= maxLat + 5) ||
                (p2[0] >= minLon - 5 && p2[0] <= maxLon + 5 && p2[1] >= minLat - 5 && p2[1] <= maxLat + 5)
              ) {
                const v1 = projectPoint(p1[0], p1[1]);
                const v2 = projectPoint(p2[0], p2[1]);
                linePoints.push(v1.x, v1.y, v1.z);
                linePoints.push(v2.x, v2.y, v2.z);
              }
            }
          });
        }
      });
    }

    if (linePoints.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
      
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x67e8f9, // Bright cyan coastline
        transparent: true,
        opacity: 0.85,
        linewidth: 1.5,
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
    this._buildCoastlines();
  }

  setYLevel(yLevel) {
    this.yLevel = yLevel;
    if (this.lineMesh) {
      this.lineMesh.position.y = yLevel - 0.302;
    }
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  }
}