export const VolumeVertexShader = `
  varying vec3 vOrigin;
  varying vec3 vDirection;
  varying vec3 vPosition;

  void main() {
    vPosition = position;
    // Camera position in object local space
    vOrigin = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    vDirection = position - vOrigin;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const VolumeFragmentShader = `
  precision highp float;
  precision highp sampler3D;

  uniform sampler3D u_data;
  uniform vec3 u_dim;
  uniform float u_opacity;
  uniform float u_threshold;
  uniform float u_isoValue;
  uniform int u_renderMode; // 0 = Volume Raymarch, 1 = Iso-Surface
  uniform int u_colormap;   // 0 = Turbo, 1 = Viridis, 2 = Thermal, 3 = Jet
  uniform float u_stepSize;
  uniform float u_sliceZ;
  uniform int u_enableSlice;

  varying vec3 vOrigin;
  varying vec3 vDirection;
  varying vec3 vPosition;

  // Jet Colormap
  vec3 colormap_jet(float t) {
    return clamp(vec3(1.5) - abs(4.0 * vec3(t) + vec3(-3.0, -2.0, -1.0)), 0.0, 1.0);
  }

  // Turbo Colormap approximation
  vec3 colormap_turbo(float t) {
    const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
    const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
    const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
    const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
    const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
    const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);

    t = clamp(t, 0.0, 1.0);
    vec4 v4 = vec4(1.0, t, t * t, t * t * t);
    vec2 v2 = v4.zw * v4.z;
    return vec3(
      dot(v4, kRedVec4) + dot(v2, kRedVec2),
      dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
      dot(v4, kBlueVec4) + dot(v2, kBlueVec2)
    );
  }

  // Viridis Colormap
  vec3 colormap_viridis(float t) {
    const vec3 c0 = vec3(0.2777, 0.0054, 0.3340);
    const vec3 c1 = vec3(0.1050, 1.4046, 1.3845);
    const vec3 c2 = vec3(-0.3308, 0.2148, 0.0950);
    const vec3 c3 = vec3(-4.6342, -5.7991, -19.3324);
    const vec3 c4 = vec3(6.2282, 14.1799, 56.6905);
    const vec3 c5 = vec3(-4.7763, -13.7405, -65.3530);
    const vec3 c6 = vec3(5.4350, 4.7454, 26.5312);
    t = clamp(t, 0.0, 1.0);
    return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
  }

  // Thermal / Ocean Warm Colormap
  vec3 colormap_thermal(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c1 = vec3(0.05, 0.15, 0.45);
    vec3 c2 = vec3(0.1, 0.7, 0.8);
    vec3 c3 = vec3(0.95, 0.85, 0.2);
    vec3 c4 = vec3(0.9, 0.2, 0.1);

    if (t < 0.33) return mix(c1, c2, t / 0.33);
    if (t < 0.66) return mix(c2, c3, (t - 0.33) / 0.33);
    return mix(c3, c4, (t - 0.66) / 0.34);
  }

  vec3 apply_colormap(float t) {
    if (u_colormap == 0) return colormap_turbo(t);
    if (u_colormap == 1) return colormap_viridis(t);
    if (u_colormap == 2) return colormap_thermal(t);
    return colormap_jet(t);
  }

  // Ray-box intersection on [-0.5, 0.5]^3 mapped to [0, 1]^3
  vec2 hit_box(vec3 orig, vec3 dir) {
    vec3 box_min = vec3(-0.5);
    vec3 box_max = vec3(0.5);
    vec3 inv_dir = 1.0 / dir;
    vec3 t0 = (box_min - orig) * inv_dir;
    vec3 t1 = (box_max - orig) * inv_dir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    float t_enter = max(max(tmin.x, tmin.y), tmin.z);
    float t_exit = min(min(tmax.x, tmax.y), tmax.z);
    return vec2(t_enter, t_exit);
  }

  void main() {
    vec3 rayDir = normalize(vDirection);
    vec2 hit = hit_box(vOrigin, rayDir);

    if (hit.x > hit.y || hit.y < 0.0) {
      discard;
    }

    hit.x = max(hit.x, 0.0);
    vec3 p_enter = vOrigin + rayDir * hit.x;
    vec3 p_exit = vOrigin + rayDir * hit.y;

    float rayLength = length(p_exit - p_enter);
    int numSteps = 120;
    float dt = rayLength / float(numSteps);
    vec3 stepVec = rayDir * dt;
    vec3 currentPos = p_enter;

    vec4 accumulatedColor = vec4(0.0);

    for (int i = 0; i < 120; i++) {
      vec3 uvw = vec3(currentPos.x + 0.5, 0.5 - currentPos.y, currentPos.z + 0.5);

      if (uvw.x >= 0.0 && uvw.x <= 1.0 && uvw.y >= 0.0 && uvw.y <= 1.0 && uvw.z >= 0.0 && uvw.z <= 1.0) {

        bool sliceClip = false;
        if (u_enableSlice == 1 && uvw.y > u_sliceZ) {
          sliceClip = true;
        }

        if (!sliceClip) {
          float scalar = texture(u_data, uvw).r;

          if (scalar >= u_threshold) {
            if (u_renderMode == 1) {
              if (abs(scalar - u_isoValue) < 0.035) {
                vec3 col = apply_colormap(scalar);
                accumulatedColor = vec4(col, 0.92);
                break;
              }
            } else {
              vec3 col = apply_colormap(scalar);
              float density = (scalar - u_threshold) / (1.0 - u_threshold + 1e-4);
              float alpha = (1.0 - exp(-density * u_opacity * 3.5)) * dt * 30.0;
              alpha = clamp(alpha, 0.0, 1.0);

              accumulatedColor.rgb += (1.0 - accumulatedColor.a) * col * alpha;
              accumulatedColor.a += (1.0 - accumulatedColor.a) * alpha;

              if (accumulatedColor.a >= 0.98) {
                break;
              }
            }
          }
        }
      }

      currentPos += stepVec;
    }

    if (accumulatedColor.a < 0.01) {
      discard;
    }

    gl_FragColor = accumulatedColor;
  }
`;
