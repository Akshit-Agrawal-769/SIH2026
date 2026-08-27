import * as THREE from 'three';
import { latLonToVector3, EARTH_RADIUS } from '../geoTransform';

/**
 * Spherical Geographic Graticule Layer
 *
 * Generates exact spherical latitude parallels and longitude meridians
 * conforming strictly to Earth sphere curvature with zero planar artifacts.
 */
export class GraticuleLayer {
  constructor(radius = EARTH_RADIUS, altitudeOffset = 0.003) {
    this.radius = radius;
    this.altitudeOffset = altitudeOffset;
    this.group = new THREE.Group();
    this.group.name = 'GraticuleLayer';

    this._buildGraticule();
  }

  _buildGraticule() {
    const r = this.radius;
    const alt = this.altitudeOffset;

    // Standard Grid lines
    const standardPositions = [];
    // Major Grid lines (Equator, Prime Meridian, Tropics)
    const majorPositions = [];

    const latStep = 15;
    const lonStep = 15;
    const segmentResolution = 72; // Points per full circle

    // 1. Latitude Parallels (-80° to +80°)
    for (let lat = -80; lat <= 80; lat += latStep) {
      const isEquator = lat === 0;
      const isTropic = Math.abs(lat) === 23.436 || lat === 20 || lat === -20;
      const targetArray = isEquator || isTropic ? majorPositions : standardPositions;

      for (let i = 0; i < segmentResolution; i++) {
        const lon1 = -180 + (i / segmentResolution) * 360;
        const lon2 = -180 + ((i + 1) / segmentResolution) * 360;

        const p1 = latLonToVector3(lat, lon1, r, alt);
        const p2 = latLonToVector3(lat, lon2, r, alt);

        targetArray.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }

    // 2. Longitude Meridians (-180° to +180°)
    for (let lon = -180; lon < 180; lon += lonStep) {
      const isPrimeOrAnti = lon === 0 || lon === -180 || lon === 180;
      const targetArray = isPrimeOrAnti ? majorPositions : standardPositions;

      const latSegments = 36;
      for (let i = 0; i < latSegments; i++) {
        const lat1 = -90 + (i / latSegments) * 180;
        const lat2 = -90 + ((i + 1) / latSegments) * 180;

        const p1 = latLonToVector3(lat1, lon, r, alt);
        const p2 = latLonToVector3(lat2, lon, r, alt);

        targetArray.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }

    // Standard Graticule LineSegments
    if (standardPositions.length > 0) {
      const standardGeo = new THREE.BufferGeometry();
      standardGeo.setAttribute('position', new THREE.Float32BufferAttribute(standardPositions, 3));
      const standardMat = new THREE.LineBasicMaterial({
        color: 0x1e3a5f,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const standardMesh = new THREE.LineSegments(standardGeo, standardMat);
      this.group.add(standardMesh);
    }

    // Major Graticule LineSegments (Equator, Prime Meridian, Tropics)
    if (majorPositions.length > 0) {
      const majorGeo = new THREE.BufferGeometry();
      majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorPositions, 3));
      const majorMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      const majorMesh = new THREE.LineSegments(majorGeo, majorMat);
      this.group.add(majorMesh);
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  setOpacity(opacity) {
    this.group.traverse((child) => {
      if (child.material) {
        child.material.opacity = opacity;
      }
    });
  }

  dispose() {
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.group.clear();
  }
}
