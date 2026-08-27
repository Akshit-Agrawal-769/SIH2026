import * as THREE from 'three';
import { latLonToVector3, EARTH_RADIUS } from '../geoTransform';

const MAJOR_OCEANIC_FEATURES = [
  { name: 'INDIAN OCEAN', lat: -5.0, lon: 78.0, size: 'large', color: '#38bdf8' },
  { name: 'ARABIAN SEA', lat: 16.0, lon: 65.0, size: 'medium', color: '#7dd3fc' },
  { name: 'BAY OF BENGAL', lat: 15.0, lon: 88.0, size: 'medium', color: '#7dd3fc' },
  { name: 'ANDAMAN SEA', lat: 11.0, lon: 96.0, size: 'small', color: '#94a3b8' },
  { name: 'LAKSHADWEEP SEA', lat: 9.5, lon: 73.5, size: 'small', color: '#94a3b8' },
  { name: 'MOZAMBIQUE CHANNEL', lat: -18.0, lon: 41.0, size: 'small', color: '#94a3b8' },
  { name: 'GULF OF ADEN', lat: 12.5, lon: 48.0, size: 'small', color: '#94a3b8' },
  { name: 'SOMALI BASIN', lat: 2.0, lon: 52.0, size: 'small', color: '#94a3b8' },
  { name: 'EQUATORIAL CHANNEL', lat: 0.0, lon: 60.0, size: 'small', color: '#64748b' },
];

export class OceanicLabelsLayer {
  constructor(options = {}) {
    if (typeof options === 'number') {
      this.radius = options;
      this.altitudeOffset = 0.05;
    } else {
      this.radius = options.radius || EARTH_RADIUS;
      this.altitudeOffset = options.altitudeOffset || 0.05;
    }
    this.group = new THREE.Group();
    this.group.name = 'OceanicLabelsLayer';
    this.sprites = [];

    this._buildLabels();
  }

  _createTextTexture(text, size, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const fontSize = size === 'large' ? 38 : size === 'medium' ? 28 : 22;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text Shadow for contrast
    ctx.shadowColor = 'rgba(2, 6, 23, 0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  _buildLabels() {
    MAJOR_OCEANIC_FEATURES.forEach((feature) => {
      const texture = this._createTextTexture(feature.name, feature.size, feature.color);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: feature.size === 'large' ? 0.9 : feature.size === 'medium' ? 0.8 : 0.65,
        depthTest: false,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      const pos = latLonToVector3(feature.lat, feature.lon, this.radius, this.altitudeOffset);
      sprite.position.copy(pos);

      const baseScale = feature.size === 'large' ? 1.8 : feature.size === 'medium' ? 1.2 : 0.85;
      sprite.scale.set(baseScale, baseScale * 0.25, 1);

      sprite.userData = {
        normal: pos.clone().normalize(),
        baseOpacity: spriteMaterial.opacity,
        baseScale: baseScale,
      };

      this.sprites.push(sprite);
      this.group.add(sprite);
    });
  }

  /**
   * Update label visibility and LOD based on camera position and angle.
   * Occludes labels facing away from the camera (behind Earth horizon).
   */
  update(camera) {
    if (!camera) return;

    const camPos = camera.position;
    const camDist = camPos.length();

    this.sprites.forEach((sprite) => {
      const normal = sprite.userData.normal;
      const toCam = camPos.clone().sub(sprite.position).normalize();
      const dot = normal.dot(toCam);

      // Horizon culling: fade out if angle > 80° from camera line of sight
      if (dot <= 0.15) {
        sprite.material.opacity = 0;
      } else {
        const angleFade = Math.min(1.0, (dot - 0.15) / 0.35);
        // Distance LOD scaling
        const distFactor = Math.max(0.6, Math.min(1.6, camDist / 12.0));
        sprite.scale.set(
          sprite.userData.baseScale * distFactor,
          sprite.userData.baseScale * 0.25 * distFactor,
          1
        );
        sprite.material.opacity = sprite.userData.baseOpacity * angleFade;
      }
    });
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  dispose() {
    this.sprites.forEach((sprite) => {
      if (sprite.material.map) sprite.material.map.dispose();
      sprite.material.dispose();
    });
    this.sprites = [];
    this.group.clear();
  }
}
