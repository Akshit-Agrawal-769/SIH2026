import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { volumeFragmentShader, volumeVertexShader } from "./raymarchShaders";
import type { VolumePayload } from "./volumeApi";

export interface RenderParams {
  mode: "volume" | "iso";
  iso: number;              // [0,1]
  density: number;          // DVR
  window: [number, number]; // DVR value window, [0,1]
  clipMin: [number, number, number]; // u-space: x=lon, y=lat, z=vertical (1 = surface)
  clipMax: [number, number, number];
  caps: boolean;
  verticalExaggeration: number;
  stepScale: number;
}

export const DEFAULT_PARAMS: RenderParams = {
  mode: "volume",
  iso: 0.5,
  density: 1.2,
  window: [0, 1],
  clipMin: [0, 0, 0],
  clipMax: [1, 1, 1],
  caps: true,
  verticalExaggeration: 0.35,
  stepScale: 1.5,
};

export interface VolumeGeometryHints {
  lonSpan?: number; // degrees, for aspect ratio
  latSpan?: number;
  flipLat?: boolean; // true if latitude index 0 is the northernmost row
  flipLon?: boolean;
  depthIndexZeroIsBottom?: boolean; // ROMS s-levels are bottom-first
}

/**
 * Owns every GPU resource for the studio. React only calls
 * `new`, `setVolume`, `setParams` and `dispose` — no Three objects leak into React state.
 */
export class VolumeEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
  private outline: THREE.LineSegments;
  private clipOutline: THREE.LineSegments;
  private texture: THREE.Data3DTexture | null = null;
  private resizeObserver: ResizeObserver;
  private params: RenderParams = { ...DEFAULT_PARAMS };
  private hints: VolumeGeometryHints = {};
  private disposed = false;
  private floatLinear: boolean;
  private tmp = new THREE.Vector3();

  constructor(private container: HTMLElement, private onError?: (msg: string) => void) {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error("WebGL2 is not available in this browser; the volumetric studio needs it for 3D textures.");

    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    this.floatLinear = this.renderer.extensions.has("OES_texture_float_linear");
    if (!this.floatLinear) {
      console.warn("[VolumetricStudio] OES_texture_float_linear missing; falling back to nearest-neighbour sampling.");
    }

    canvas.addEventListener("webglcontextlost", this.handleContextLost, false);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    this.camera.position.set(1.35, 1.0, 1.55);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 6;
    this.controls.target.set(0, 0, 0);

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: volumeVertexShader,
      fragmentShader: volumeFragmentShader,
      side: THREE.BackSide, // works with the camera inside the box too
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      uniforms: {
        uVolume: { value: null },
        uVolSize: { value: new THREE.Vector3(1, 1, 1) },
        uFlip: { value: new THREE.Vector3(0, 0, 0) },
        uCameraLocal: { value: new THREE.Vector3() },
        uClipMin: { value: new THREE.Vector3(0, 0, 0) },
        uClipMax: { value: new THREE.Vector3(1, 1, 1) },
        uMode: { value: 0 },
        uIso: { value: 0.5 },
        uDensity: { value: 1.2 },
        uWindow: { value: new THREE.Vector2(0, 1) },
        uStepScale: { value: 1.5 },
        uCaps: { value: 1 },
      },
    });

    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    this.mesh.visible = false;

    // Object-space z (vertical, 1 = surface) -> world +y; object y (north) -> world -z.
    this.root.rotation.x = -Math.PI / 2;
    this.root.add(this.mesh);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.22 })
    );
    this.clipOutline = new THREE.LineSegments(
      edges.clone(),
      new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.75 })
    );
    this.root.add(this.outline, this.clipOutline);
    this.scene.add(this.root);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop(this.frame);
  }

  /* ---------------------------------------------------------------- */

  setVolume(vol: VolumePayload, hints: VolumeGeometryHints = {}) {
    if (this.disposed) return;
    const { nx, ny, nz } = vol.dims;
    const n = nx * ny * nz;
    if (vol.data.length !== n) {
      const msg = `setVolume: data length ${vol.data.length} ≠ ${nx}×${ny}×${nz}`;
      console.error("[VolumetricStudio]", msg);
      this.onError?.(msg);
      return;
    }

    const maxTex = (this.renderer.capabilities as any).max3DTextureSize ?? 2048;
    if (nx > maxTex || ny > maxTex || nz > maxTex) {
      const msg = `Grid ${nx}×${ny}×${nz} exceeds this GPU's 3D texture limit (${maxTex}).`;
      console.error("[VolumetricStudio]", msg);
      this.onError?.(msg);
      return;
    }

    const rg = buildValueMaskRG(vol.data, nx, ny, nz);

    this.texture?.dispose();
    const tex = new THREE.Data3DTexture(rg, nx, ny, nz);
    tex.format = THREE.RGFormat;
    tex.type = THREE.FloatType;
    tex.internalFormat = "RG32F";
    const filter = this.floatLinear ? THREE.LinearFilter : THREE.NearestFilter;
    tex.minFilter = filter;
    tex.magFilter = filter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.texture = tex;

    this.hints = hints;
    const u = this.mesh.material.uniforms;
    u.uVolume.value = tex;
    u.uVolSize.value.set(nx, ny, nz);
    u.uFlip.value.set(hints.flipLon ? 1 : 0, hints.flipLat ? 1 : 0, hints.depthIndexZeroIsBottom ? 1 : 0);

    this.applyScale();
    this.mesh.visible = true;
  }

  setParams(p: Partial<RenderParams>) {
    this.params = { ...this.params, ...p };
    const u = this.mesh.material.uniforms;
    u.uMode.value = this.params.mode === "iso" ? 1 : 0;
    u.uIso.value = this.params.iso;
    u.uDensity.value = this.params.density;
    u.uWindow.value.set(this.params.window[0], this.params.window[1]);
    u.uClipMin.value.fromArray(this.params.clipMin);
    u.uClipMax.value.fromArray(this.params.clipMax);
    u.uCaps.value = this.params.caps ? 1 : 0;
    u.uStepScale.value = this.params.stepScale;
    this.applyScale();
    this.updateClipOutline();
  }

  resetView() {
    this.camera.position.set(1.35, 1.0, 1.55);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);

    this.texture?.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
    this.clipOutline.geometry.dispose();
    (this.clipOutline.material as THREE.Material).dispose();

    this.renderer.dispose();
    this.renderer.forceContextLoss(); // frees the context immediately; browsers cap live contexts (~16)
    this.renderer.domElement.remove();
  }

  /* ---------------------------------------------------------------- */

  private frame = () => {
    this.controls.update();
    // Ray origin must be in the mesh's object space (inverse of scale+rotation).
    this.mesh.updateMatrixWorld();
    this.mesh.worldToLocal(this.tmp.copy(this.camera.position));
    this.mesh.material.uniforms.uCameraLocal.value.copy(this.tmp);
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyScale() {
    const lon = this.hints.lonSpan ?? 1;
    const lat = this.hints.latSpan ?? 1;
    const m = Math.max(lon, lat) || 1;
    const s = new THREE.Vector3(lon / m, lat / m, this.params.verticalExaggeration);
    this.mesh.scale.copy(s);
    this.outline.scale.copy(s);
    this.updateClipOutline();
  }

  private updateClipOutline() {
    const [x0, y0, z0] = this.params.clipMin;
    const [x1, y1, z1] = this.params.clipMax;
    const s = this.mesh.scale;
    this.clipOutline.scale.set(Math.max(1e-4, x1 - x0) * s.x, Math.max(1e-4, y1 - y0) * s.y, Math.max(1e-4, z1 - z0) * s.z);
    this.clipOutline.position.set(((x0 + x1) / 2 - 0.5) * s.x, ((y0 + y1) / 2 - 0.5) * s.y, ((z0 + z1) / 2 - 0.5) * s.z);
    const full = x0 <= 0 && y0 <= 0 && z0 <= 0 && x1 >= 1 && y1 >= 1 && z1 >= 1;
    this.clipOutline.visible = !full;
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    console.error("[VolumetricStudio] WebGL context lost (GPU reset or too many contexts).");
    this.onError?.("The GPU context was lost. Close and reopen the studio to recover.");
  };
}

/**
 * Pack into RG: R = value, G = ocean mask.
 * Land/fill voxels (encoded as -1 by volumeApi) get their R value dilated from
 * neighbouring ocean voxels, so trilinear filtering near coastlines never
 * blends in the -1 sentinel and creates false isosurface crossings.
 */
function buildValueMaskRG(src: Float32Array, nx: number, ny: number, nz: number): Float32Array {
  const n = nx * ny * nz;
  const val = new Float32Array(src);
  const out = new Float32Array(n * 2);

  const plane = nx * ny;
  const next = new Float32Array(plane);
  for (let z = 0; z < nz; z++) {
    const off = z * plane;
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const i = off + y * nx + x;
          if (val[i] >= 0) { next[y * nx + x] = val[i]; continue; }
          let sum = 0, cnt = 0;
          if (x > 0 && val[i - 1] >= 0) { sum += val[i - 1]; cnt++; }
          if (x < nx - 1 && val[i + 1] >= 0) { sum += val[i + 1]; cnt++; }
          if (y > 0 && val[i - nx] >= 0) { sum += val[i - nx]; cnt++; }
          if (y < ny - 1 && val[i + nx] >= 0) { sum += val[i + nx]; cnt++; }
          next[y * nx + x] = cnt ? sum / cnt : -1;
          if (cnt) changed = true;
        }
      }
      val.set(next, off);
      if (!changed) break;
    }
  }

  for (let i = 0; i < n; i++) {
    out[2 * i] = val[i] >= 0 ? val[i] : 0;
    out[2 * i + 1] = src[i] >= 0 ? 1 : 0;
  }
  return out;
}
