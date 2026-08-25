/**
 * Current Particle Flow Shader
 * GPU-instanced animated particles/streamlines for ocean surface currents (u, v velocity)
 */

export const CurrentParticleVertexShader = `
  uniform float u_time;
  uniform float u_speed;
  uniform float u_yLevel;

  attribute vec3 a_offset;
  attribute vec2 a_velocity; // (u, v)
  attribute float a_phase;

  varying float vSpeed;
  varying float vAlpha;

  void main() {
    float velMagnitude = length(a_velocity);
    vSpeed = velMagnitude;

    // Animate along direction of velocity vector
    vec2 dir = velMagnitude > 0.001 ? normalize(a_velocity) : vec2(1.0, 0.0);
    float progress = fract(a_phase + u_time * (velMagnitude * 1.5 + 0.2) * u_speed);

    // Particle trace position
    vec3 animatedOffset = a_offset;
    animatedOffset.x += dir.x * (progress - 0.5) * 0.12;
    animatedOffset.z += dir.y * (progress - 0.5) * 0.12;

    // Subtle fade in and fade out along streamline
    vAlpha = sin(progress * 3.14159265);

    vec3 transformed = position + animatedOffset;
    transformed.y += u_yLevel;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

export const CurrentParticleFragmentShader = `
  precision highp float;

  varying float vSpeed;
  varying float vAlpha;

  void main() {
    // Current speed colormap: 0.0 m/s (dark teal) -> 0.8 m/s (sky blue) -> 1.5 m/s (amber)
    vec3 slowColor = vec3(0.04, 0.45, 0.58);
    vec3 midColor = vec3(0.22, 0.74, 0.97);
    vec3 fastColor = vec3(0.98, 0.75, 0.14);

    float t = clamp(vSpeed / 1.2, 0.0, 1.0);
    vec3 color = t < 0.5 ? mix(slowColor, midColor, t / 0.5) : mix(midColor, fastColor, (t - 0.5) / 0.5);

    gl_FragColor = vec4(color, vAlpha * 0.85);
  }
`;
