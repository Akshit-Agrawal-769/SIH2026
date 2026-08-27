/**
 * SatelliteOrbitLayer
 * Renders authentic 3D orbital ground tracks and satellite sensor craft around the spherical Earth.
 * Includes Oceansat-3, SARAL/AltiKa, and SCATSAT-1.
 */

import * as THREE from 'three';
import { latLonToGlobe, EARTH_RADIUS } from '../../utils/geography';

export class SatelliteOrbitLayer {
  constructor(options = {}) {
    this.radius = options.radius || EARTH_RADIUS;
    this.group = new THREE.Group();
    this.group.name = 'SatelliteOrbitLayer';

    this.satellites = [
      {
        id: 'oceansat3',
        name: 'Oceansat-3',
        orbitRadius: this.radius * 1.115, // ~720km altitude scale
        inclination: (98.28 * Math.PI) / 180,
        speed: 0.28,
        color: 0x38bdf8,
        mesh: null,
        trackLine: null,
      },
      {
        id: 'saral',
        name: 'SARAL / AltiKa',
        orbitRadius: this.radius * 1.125, // ~790km altitude scale
        inclination: (98.55 * Math.PI) / 180,
        speed: 0.24,
        color: 0x34d399,
        mesh: null,
        trackLine: null,
      },
      {
        id: 'scatsat1',
        name: 'SCATSAT-1',
        orbitRadius: this.radius * 1.115,
        inclination: (98.1 * Math.PI) / 180,
        speed: 0.32,
        color: 0xfbbf24,
        mesh: null,
        trackLine: null,
      },
    ];

    this._buildOrbits();
  }

  _buildOrbits() {
    this.satellites.forEach((sat) => {
      // 1. Orbital ring path
      const points = [];
      const numPoints = 120;
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const x = sat.orbitRadius * Math.cos(theta);
        const y = sat.orbitRadius * Math.sin(theta) * Math.sin(sat.inclination);
        const z = sat.orbitRadius * Math.sin(theta) * Math.cos(sat.inclination);
        points.push(new THREE.Vector3(x, y, z));
      }

      const trackGeo = new THREE.BufferGeometry().setFromPoints(points);
      const trackMat = new THREE.LineBasicMaterial({
        color: sat.color,
        transparent: true,
        opacity: 0.25,
        linewidth: 1,
      });

      const trackLine = new THREE.Line(trackGeo, trackMat);
      sat.trackLine = trackLine;
      this.group.add(trackLine);

      // 2. Satellite 3D body representation
      const satGroup = new THREE.Group();
      satGroup.userData = { id: sat.id, name: sat.name, type: 'satellite' };

      // Core bus
      const busGeo = new THREE.BoxGeometry(0.018, 0.018, 0.024);
      const busMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.85,
        roughness: 0.2,
      });
      const bus = new THREE.Mesh(busGeo, busMat);
      satGroup.add(bus);

      // Solar arrays (Left & Right)
      const solarGeo = new THREE.BoxGeometry(0.045, 0.012, 0.002);
      const solarMat = new THREE.MeshStandardMaterial({
        color: sat.color,
        metalness: 0.6,
        roughness: 0.3,
        emissive: sat.color,
        emissiveIntensity: 0.3,
      });
      const leftSolar = new THREE.Mesh(solarGeo, solarMat);
      leftSolar.position.x = 0.032;
      const rightSolar = new THREE.Mesh(solarGeo, solarMat);
      rightSolar.position.x = -0.032;
      satGroup.add(leftSolar);
      satGroup.add(rightSolar);

      // Sensor cone pointing down to Earth
      const sensorGeo = new THREE.ConeGeometry(0.01, 0.03, 8);
      sensorGeo.rotateX(-Math.PI / 2);
      const sensorMat = new THREE.MeshBasicMaterial({
        color: sat.color,
        transparent: true,
        opacity: 0.3,
      });
      const sensor = new THREE.Mesh(sensorGeo, sensorMat);
      sensor.position.z = -0.018;
      satGroup.add(sensor);

      sat.mesh = satGroup;
      this.group.add(satGroup);
    });
  }

  update(elapsedTime) {
    this.satellites.forEach((sat, idx) => {
      if (!sat.mesh) return;
      const theta = elapsedTime * sat.speed + idx * (Math.PI * 0.65);
      const x = sat.orbitRadius * Math.cos(theta);
      const y = sat.orbitRadius * Math.sin(theta) * Math.sin(sat.inclination);
      const z = sat.orbitRadius * Math.sin(theta) * Math.cos(sat.inclination);

      sat.mesh.position.set(x, y, z);
      sat.mesh.lookAt(0, 0, 0); // Point towards center of Earth
    });
  }

  setVisible(visible) {
    this.group.visible = !!visible;
  }

  dispose() {
    this.satellites.forEach((sat) => {
      if (sat.trackLine) {
        this.group.remove(sat.trackLine);
        if (sat.trackLine.geometry) sat.trackLine.geometry.dispose();
        if (sat.trackLine.material) sat.trackLine.material.dispose();
      }
      if (sat.mesh) {
        this.group.remove(sat.mesh);
      }
    });
  }
}
