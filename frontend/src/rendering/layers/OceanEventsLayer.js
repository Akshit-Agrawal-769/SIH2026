/**
 * OceanEventsLayer
 * Renders spatial 3D event markers, cyclonic vortex spirals, thermal heatwave contour rings,
 * and eddy velocity loops directly on the spherical Earth globe.
 */

import * as THREE from 'three';
import { latLonToGlobe, EARTH_RADIUS } from '../../utils/geography';
import { OCEAN_EVENTS } from '../../store/oceanStore';

export class OceanEventsLayer {
  constructor(options = {}) {
    this.radius = options.radius || (EARTH_RADIUS * 1.006);
    this.group = new THREE.Group();
    this.group.name = 'OceanEventsLayer';

    this.eventMarkers = [];
    this._buildEvents();
  }

  _buildEvents() {
    OCEAN_EVENTS.forEach((ev) => {
      const marker = new THREE.Group();
      marker.userData = { id: ev.id, name: ev.name, type: 'event', eventData: ev };

      const gPos = latLonToGlobe(ev.lat, ev.lon, this.radius);
      const normal = new THREE.Vector3(gPos.x, gPos.y, gPos.z).normalize();
      marker.position.set(gPos.x, gPos.y, gPos.z);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

      // Distinct geometry based on event type
      if (ev.type === 'cyclone') {
        // Cyclone Spiral Vortex Rings
        const spiralGeo = new THREE.RingGeometry(0.015, 0.045, 32);
        const spiralMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
        });
        const ring = new THREE.Mesh(spiralGeo, spiralMat);
        ring.name = 'eventPulseRing';
        marker.add(ring);

        // Core eye point
        const eyeGeo = new THREE.CircleGeometry(0.008, 16);
        const eyeMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
        });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        marker.add(eye);
      } else if (ev.type === 'heatwave') {
        // Heatwave Thermal Blob
        const hwGeo = new THREE.RingGeometry(0.02, 0.055, 24);
        const hwMat = new THREE.MeshBasicMaterial({
          color: 0xf97316,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
        });
        const hwMesh = new THREE.Mesh(hwGeo, hwMat);
        hwMesh.name = 'eventPulseRing';
        marker.add(hwMesh);
      } else if (ev.type === 'eddy') {
        // Mesoscale Eddy Coherent Ring
        const eddyGeo = new THREE.RingGeometry(0.018, 0.04, 24);
        const eddyMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        });
        const eddyMesh = new THREE.Mesh(eddyGeo, eddyMat);
        eddyMesh.name = 'eventPulseRing';
        marker.add(eddyMesh);
      } else {
        // General Event Ring
        const ringGeo = new THREE.RingGeometry(0.015, 0.035, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.name = 'eventPulseRing';
        marker.add(ringMesh);
      }

      this.eventMarkers.push(marker);
      this.group.add(marker);
    });
  }

  update(elapsedTime) {
    this.eventMarkers.forEach((marker, idx) => {
      const pulseRing = marker.getObjectByName('eventPulseRing');
      if (pulseRing) {
        const pulse = (elapsedTime * 1.5 + idx * 0.4) % 1.5;
        pulseRing.scale.set(1.0 + pulse * 0.6, 1.0 + pulse * 0.6, 1.0);
        pulseRing.material.opacity = Math.max(0, 0.8 - pulse * 0.45);
      }
    });
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    this.eventMarkers.forEach((marker) => {
      this.group.remove(marker);
    });
    this.eventMarkers = [];
  }
}
