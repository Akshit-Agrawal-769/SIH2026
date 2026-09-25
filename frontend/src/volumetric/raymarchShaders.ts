export const volumeVertexShader = /* glsl */ `
uniform vec3 uCameraLocal;
out vec3 vOrigin;
out vec3 vDirection;

void main() {
  vOrigin = uCameraLocal;
  vDirection = position - uCameraLocal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const volumeFragmentShader = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec3 vOrigin;
in vec3 vDirection;

uniform sampler3D uVolume;
uniform vec3  uVolSize;     // voxel counts (nx, ny, nz)
uniform vec3  uFlip;        // 1.0 on an axis if the buffer runs opposite to u-space
uniform vec3  uClipMin;     // u-space
uniform vec3  uClipMax;
uniform int   uMode;        // 0 = direct volume rendering, 1 = isosurface
uniform float uIso;         // [0,1] normalised threshold
uniform float uDensity;     // DVR extinction multiplier
uniform vec2  uWindow;      // DVR value window [lo, hi] in [0,1]
uniform float uStepScale;   // samples per voxel along the ray
uniform int   uCaps;        // 1 = draw solid cross-section caps

// Google "Turbo" colormap, polynomial approximation (A. Mikhailov, 2019)
vec3 turbo(float x) {
  const vec4 kR4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
  const vec4 kG4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
  const vec4 kB4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
  const vec2 kR2 = vec2(-152.94239396, 59.28637943);
  const vec2 kG2 = vec2(4.27729857, 2.82956604);
  const vec2 kB2 = vec2(-89.90310912, 27.34824973);
  x = clamp(x, 0.0, 1.0);
  vec4 v4 = vec4(1.0, x, x * x, x * x * x);
  vec2 v2 = v4.zw * v4.z;
  return vec3(dot(v4, kR4) + dot(v2, kR2),
              dot(v4, kG4) + dot(v2, kG2),
              dot(v4, kB4) + dot(v2, kB2));
}

vec3 toTex(vec3 u) {
  // Buffer index 0 on the depth axis is the surface -> texcoord z = 1 - u.z
  vec3 t = vec3(u.x, u.y, 1.0 - u.z);
  return mix(t, 1.0 - t, uFlip);
}

// .x = value, .y = ocean mask
vec2 sampleVol(vec3 p) {
  return texture(uVolume, toTex(p + 0.5)).rg;
}

vec3 gradientAt(vec3 p) {
  vec3 e = 1.0 / uVolSize;
  float dx = sampleVol(p + vec3(e.x, 0, 0)).x - sampleVol(p - vec3(e.x, 0, 0)).x;
  float dy = sampleVol(p + vec3(0, e.y, 0)).x - sampleVol(p - vec3(0, e.y, 0)).x;
  float dz = sampleVol(p + vec3(0, 0, e.z)).x - sampleVol(p - vec3(0, 0, e.z)).x;
  return vec3(dx, dy, dz);
}

vec2 hitBox(vec3 o, vec3 d, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / d;
  vec3 t0 = (bmin - o) * inv;
  vec3 t1 = (bmax - o) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

bool onInteriorClipFace(vec3 u) {
  const float eps = 2e-3;
  bvec3 lo = bvec3(uClipMin.x > eps, uClipMin.y > eps, uClipMin.z > eps);
  bvec3 hi = bvec3(uClipMax.x < 1.0 - eps, uClipMax.y < 1.0 - eps, uClipMax.z < 1.0 - eps);
  return (lo.x && abs(u.x - uClipMin.x) < eps) || (hi.x && abs(u.x - uClipMax.x) < eps) ||
         (lo.y && abs(u.y - uClipMin.y) < eps) || (hi.y && abs(u.y - uClipMax.y) < eps) ||
         (lo.z && abs(u.z - uClipMin.z) < eps) || (hi.z && abs(u.z - uClipMax.z) < eps);
}

vec3 shade(vec3 base, vec3 n, vec3 viewDir) {
  vec3 L = -viewDir;                       // headlight
  float diff = abs(dot(n, L));             // two-sided
  vec3 H = normalize(L - viewDir);
  float spec = pow(max(abs(dot(n, H)), 0.0), 48.0);
  float rim = pow(1.0 - diff, 3.0);
  return base * (0.28 + 0.72 * diff) + vec3(0.35) * spec + vec3(0.0, 0.85, 1.0) * rim * 0.25;
}

void main() {
  vec3 dir = normalize(vDirection);
  vec2 t = hitBox(vOrigin, dir, uClipMin - 0.5, uClipMax - 0.5);
  if (t.x > t.y) discard;               // ray misses the clipped region entirely
  bool cameraOutside = t.x > 0.0;
  t.x = max(t.x, 0.0);

  // ---- Cross-section cap ------------------------------------------------
  vec3 pEntry = vOrigin + dir * t.x;
  if (uCaps == 1 && cameraOutside && onInteriorClipFace(pEntry + 0.5)) {
    vec2 s = sampleVol(pEntry);
    if (s.y > 0.5) {
      bool show = (uMode == 0) || (s.x >= uIso);
      if (show) {
        vec3 c = turbo(uMode == 0 ? (s.x - uWindow.x) / max(uWindow.y - uWindow.x, 1e-4) : s.x);
        gl_FragColor = vec4(c * 0.92, 1.0);
        return;
      }
    }
  }

  // ---- March ------------------------------------------------------------
  float delta = 1.0 / (max(max(uVolSize.x, uVolSize.y), uVolSize.z) * uStepScale);
  float tt = t.x + delta * hash(gl_FragCoord.xy);   // jitter kills wood-grain banding

  if (uMode == 1) {
    // Isosurface: find first sign change of (v - iso) between two ocean samples, then bisect.
    vec3 p = vOrigin + dir * tt;
    vec2 prev = sampleVol(p);
    float tPrev = tt;
    for (int i = 0; i < 2048; i++) {
      tt += delta;
      if (tt > t.y) break;
      p = vOrigin + dir * tt;
      vec2 cur = sampleVol(p);
      if (prev.y > 0.5 && cur.y > 0.5 && (prev.x - uIso) * (cur.x - uIso) <= 0.0 && prev.x != cur.x) {
        float a = tPrev, b = tt;
        for (int k = 0; k < 6; k++) {
          float m = 0.5 * (a + b);
          float vm = sampleVol(vOrigin + dir * m).x;
          if ((prev.x - uIso) * (vm - uIso) <= 0.0) b = m; else a = m;
        }
        vec3 hit = vOrigin + dir * b;
        vec3 g = gradientAt(hit);
        vec3 n = length(g) > 1e-6 ? normalize(g) : -dir;
        gl_FragColor = vec4(shade(turbo(uIso), n, dir), 1.0);
        return;
      }
      prev = cur;
      tPrev = tt;
    }
    discard;
  }

  // Direct volume rendering: front-to-back emission/absorption inside the value window.
  vec4 acc = vec4(0.0);
  float w = max(uWindow.y - uWindow.x, 1e-4);
  for (int i = 0; i < 2048; i++) {
    if (tt > t.y || acc.a > 0.97) break;
    vec2 s = sampleVol(vOrigin + dir * tt);
    if (s.y > 0.5 && s.x >= uWindow.x && s.x <= uWindow.y) {
      float a = 1.0 - exp(-uDensity * delta * 96.0);
      vec3 c = turbo((s.x - uWindow.x) / w);
      acc.rgb += (1.0 - acc.a) * a * c;
      acc.a   += (1.0 - acc.a) * a;
    }
    tt += delta;
  }
  if (acc.a < 0.004) discard;
  gl_FragColor = acc;
}
`;
