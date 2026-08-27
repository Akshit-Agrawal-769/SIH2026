import * as THREE from 'three';
import { latLonToVector3, EARTH_RADIUS } from './geoTransform';

/**
 * CAMERA VERBS CONTROLLER
 * 
 * Inspired by the camera choreography of God's Eye View, adapted for
 * the Three.js spherical ocean visualization engine.
 * 
 * Handles smooth eased transitions, orbital tracking, and planetary/regional framing.
 */
export class CameraVerbsController {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;

    this.isTransitioning = false;
    this.transitionStart = 0;
    this.transitionDuration = 0;

    this.startPos = new THREE.Vector3();
    this.targetPos = new THREE.Vector3();
    this.startLookAt = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();

    this.onCompleteCallback = null;

    // Continuous orbital motion state
    this.isOrbiting = false;
    this.orbitSpeed = 0.002; // rad/frame
  }

  /**
   * Easing function: Quintic Ease In-Out for cinematic deceleration.
   */
  _easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }

  /**
   * Smoothly frame the entire Earth sphere with standard scientific tilt.
   */
  fitEarth(duration = 1.6) {
    // Camera placed at equator looking at center from distance
    const targetPos = new THREE.Vector3(0, 3.5, 14.5);
    const targetLookAt = new THREE.Vector3(0, 0, 0);
    this._startFlight(targetPos, targetLookAt, duration);
  }

  /**
   * Smoothly frame the Indian Ocean basin (centered ~10°N, 75°E).
   */
  fitIndianOcean(duration = 1.8) {
    const indianOceanCenter = latLonToVector3(10.0, 75.0, EARTH_RADIUS);
    const cameraPos = latLonToVector3(10.0, 75.0, EARTH_RADIUS, 5.8);
    this._startFlight(cameraPos, indianOceanCenter.clone().multiplyScalar(0.2), duration);
  }

  /**
   * Smoothly fly camera to look directly at a specific (latitude, longitude) coordinate.
   * 
   * @param {number} lat 
   * @param {number} lon 
   * @param {number} altitudeOffset - Height above Earth surface (default 3.8)
   * @param {number} duration - Flight duration in seconds
   * @param {Function} onComplete 
   */
  flyToCoordinate(lat, lon, altitudeOffset = 3.8, duration = 2.0, onComplete = null) {
    const targetSurface = latLonToVector3(lat, lon, EARTH_RADIUS);
    const targetCameraPos = latLonToVector3(lat, lon, EARTH_RADIUS, altitudeOffset);

    this.onCompleteCallback = onComplete;
    this._startFlight(targetCameraPos, targetSurface, duration);
  }

  /**
   * Reset view to standard default orientation.
   */
  resetView() {
    this.fitIndianOcean(1.5);
  }

  /**
   * Toggle continuous orbital rotation around current target.
   */
  toggleContinuousOrbit(enable = null, speed = 0.002) {
    this.isOrbiting = enable !== null ? enable : !this.isOrbiting;
    this.orbitSpeed = speed;
    if (this.controls) {
      this.controls.autoRotate = this.isOrbiting;
      this.controls.autoRotateSpeed = speed * 600;
    }
  }

  /**
   * Stop all active transitions and return immediate manual control.
   */
  stopFlight() {
    this.isTransitioning = false;
    if (this.controls) {
      this.controls.enabled = true;
    }
  }

  _startFlight(targetCamPos, targetLookAt, duration) {
    if (!this.camera) return;

    this.isTransitioning = true;
    this.transitionStart = performance.now();
    this.transitionDuration = Math.max(0.1, duration) * 1000;

    this.startPos.copy(this.camera.position);
    this.targetPos.copy(targetCamPos);

    if (this.controls) {
      this.startLookAt.copy(this.controls.target);
      this.controls.enabled = false;
    } else {
      this.startLookAt.set(0, 0, 0);
    }
    this.targetLookAt.copy(targetLookAt);
  }

  /**
   * Update method called each animation frame in the render loop.
   */
  update(time) {
    if (!this.isTransitioning) {
      if (this.isOrbiting && this.controls) {
        this.controls.update();
      }
      return;
    }

    const elapsed = time - this.transitionStart;
    const progress = Math.min(1.0, elapsed / this.transitionDuration);
    const easedProgress = this._easeInOutQuint(progress);

    // Arc elevation: slightly lift the camera during mid-flight for cinematic flyover
    const midLift = Math.sin(progress * Math.PI) * 0.8;

    // Interpolate camera position with spherical arc
    const currPos = new THREE.Vector3().lerpVectors(this.startPos, this.targetPos, easedProgress);
    if (midLift > 0) {
      currPos.addScaledVector(currPos.clone().normalize(), midLift);
    }
    this.camera.position.copy(currPos);

    // Interpolate lookAt target
    const currLookAt = new THREE.Vector3().lerpVectors(this.startLookAt, this.targetLookAt, easedProgress);
    if (this.controls) {
      this.controls.target.copy(currLookAt);
      this.controls.update();
    } else {
      this.camera.lookAt(currLookAt);
    }

    if (progress >= 1.0) {
      this.isTransitioning = false;
      if (this.controls) {
        this.controls.enabled = true;
      }
      if (this.onCompleteCallback) {
        const cb = this.onCompleteCallback;
        this.onCompleteCallback = null;
        cb();
      }
    }
  }
}
