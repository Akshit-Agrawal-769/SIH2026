import * as THREE from 'three';

export class MarinePlatform {
  constructor(options = {}) {
    this.group = new THREE.Group();
    this.initialPosition = options.position || new THREE.Vector3(0.15, 0.3, 0.1);
    this.group.position.copy(this.initialPosition);

    this.beaconLight = null;
    this.beaconMat = null;
    this.radarMesh = null;

    this._buildPlatform();
  }

  _buildPlatform() {
    // 1. Central Buoyancy Hull (Hexagonal / Cylinder Hull)
    const hullGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.03, 8);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.25,
    });
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.position.y = -0.005;
    this.group.add(hullMesh);

    // 2. Yellow Marine High-Visibility Ring & Flotation Collar
    const collarGeo = new THREE.TorusGeometry(0.052, 0.008, 8, 24);
    collarGeo.rotateX(Math.PI / 2);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Marine Safety Yellow
      roughness: 0.3,
      metalness: 0.2,
    });
    const collarMesh = new THREE.Mesh(collarGeo, collarMat);
    collarMesh.position.y = 0.002;
    this.group.add(collarMesh);

    // 3. Operational Instrument Deck
    const deckGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.005, 12);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.6,
      metalness: 0.5,
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.y = 0.012;
    this.group.add(deckMesh);

    // 4. Communication & Satellite Radome
    const domeGeo = new THREE.SphereGeometry(0.016, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.1,
      metalness: 0.1,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.set(-0.012, 0.014, -0.01);
    this.group.add(domeMesh);

    // 5. Sensor Mast & Anemometer Array
    const mastGeo = new THREE.CylinderGeometry(0.002, 0.003, 0.05, 6);
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.1,
    });
    const mastMesh = new THREE.Mesh(mastGeo, mastMat);
    mastMesh.position.set(0.015, 0.038, 0.01);
    this.group.add(mastMesh);

    // 6. Rotating Radar Scanner
    const radarGeo = new THREE.BoxGeometry(0.018, 0.003, 0.004);
    const radarMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.6,
      roughness: 0.3,
    });
    this.radarMesh = new THREE.Mesh(radarGeo, radarMat);
    this.radarMesh.position.set(0.015, 0.064, 0.01);
    this.group.add(this.radarMesh);

    // 7. Flashing Navigation Strobe Beacon LED
    const beaconGeo = new THREE.SphereGeometry(0.005, 8, 8);
    this.beaconMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, this.beaconMat);
    beaconMesh.position.set(0.015, 0.068, 0.01);
    this.group.add(beaconMesh);

    // PointLight for strobe illumination
    this.beaconLight = new THREE.PointLight(0x38bdf8, 1.2, 0.3);
    this.beaconLight.position.set(0.015, 0.07, 0.01);
    this.group.add(this.beaconLight);

    // 8. Subsurface Mooring Tether to Seabed
    const tetherPoints = [
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(0.02, -0.3, 0.01),
      new THREE.Vector3(0.01, -0.58, 0.02),
    ];
    const tetherGeo = new THREE.BufferGeometry().setFromPoints(tetherPoints);
    const tetherMat = new THREE.LineDashedMaterial({
      color: 0x0284c7,
      dashSize: 0.02,
      gapSize: 0.01,
      linewidth: 1,
    });
    this.tetherLine = new THREE.Line(tetherGeo, tetherMat);
    this.tetherLine.computeLineDistances();
    this.group.add(this.tetherLine);

    // Tag group for raycaster inspection
    this.group.userData = {
      type: 'platform',
      id: 'INCOIS_OCEAN_STATION_01',
      name: 'INCOIS Moored Ocean Intelligence Station (Arabian Sea)',
      coords: { lat: 14.5, lon: 68.2 },
    };
  }

  update(elapsedTime) {
    // 1. Rotate Radar
    if (this.radarMesh) {
      this.radarMesh.rotation.y = elapsedTime * 3.5;
    }

    // 2. Wave Heave & Pitch Motion
    const waveY = Math.sin(elapsedTime * 1.8 + this.initialPosition.x * 4.0) * 0.008;
    const wavePitch = Math.sin(elapsedTime * 1.5 + this.initialPosition.z * 3.0) * 0.04;
    const waveRoll = Math.cos(elapsedTime * 1.3) * 0.03;

    this.group.position.y = this.initialPosition.y + waveY;
    this.group.rotation.x = wavePitch;
    this.group.rotation.z = waveRoll;

    // 3. Strobe Beacon Flash
    const flash = (Math.sin(elapsedTime * 6.0) + 1.0) * 0.5;
    if (this.beaconLight && this.beaconMat) {
      this.beaconLight.intensity = flash > 0.8 ? 2.5 : 0.2;
      this.beaconMat.opacity = flash > 0.8 ? 1.0 : 0.3;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
