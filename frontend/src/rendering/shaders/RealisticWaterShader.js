/**
 * Realistic Ocean Water Shader with Gerstner Wave Synthesis & Fresnel Specular Response
 * Implements physically based deep ocean light absorption and 4-component harmonic wave displacement.
 */

export const WaterVertexShader = `
  uniform float u_time;
  uniform float u_waveHeight;
  uniform float u_waveSpeed;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  // Gerstner Wave Structure: dir, steepness, wavelength
  struct Wave {
    vec2 dir;
    float steepness;
    float wavelength;
  };

  vec3 gerstnerWave(Wave w, vec3 p, inout vec3 tangent, inout vec3 binormal) {
    float k = 2.0 * 3.14159265 / w.wavelength;
    float c = sqrt(9.8 / k) * u_waveSpeed;
    vec2 d = normalize(w.dir);
    float f = k * (dot(d, p.xz) - c * u_time);
    float a = (w.steepness / k) * u_waveHeight;

    tangent += vec3(
      -d.x * d.x * (w.steepness * sin(f)),
      d.x * (w.steepness * cos(f)),
      -d.x * d.y * (w.steepness * sin(f))
    );
    binormal += vec3(
      -d.x * d.y * (w.steepness * sin(f)),
      d.y * (w.steepness * cos(f)),
      -d.y * d.y * (w.steepness * sin(f))
    );

    return vec3(
      d.x * (a * cos(f)),
      a * sin(f),
      d.y * (a * cos(f))
    );
  }

  void main() {
    vUv = uv;
    vec3 gridPoint = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);
    vec3 p = gridPoint;

    // 4 Harmonic Gerstner Waves
    Wave w1 = Wave(vec2(1.0, 0.3), 0.15, 0.8);
    Wave w2 = Wave(vec2(0.7, 0.7), 0.10, 0.45);
    Wave w3 = Wave(vec2(-0.2, 0.9), 0.08, 0.25);
    Wave w4 = Wave(vec2(0.5, -0.4), 0.05, 0.15);

    p += gerstnerWave(w1, gridPoint, tangent, binormal);
    p += gerstnerWave(w2, gridPoint, tangent, binormal);
    p += gerstnerWave(w3, gridPoint, tangent, binormal);
    p += gerstnerWave(w4, gridPoint, tangent, binormal);

    vec3 normal = normalize(cross(binormal, tangent));
    vNormal = normal;

    vec4 worldPos = modelMatrix * vec4(p, 1.0);
    vWorldPosition = worldPos.xyz;
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const WaterFragmentShader = `
  precision highp float;

  uniform vec3 u_waterDeepColor;
  uniform vec3 u_waterShallowColor;
  uniform vec3 u_sunDirection;
  uniform vec3 u_sunColor;
  uniform float u_roughness;
  uniform float u_opacity;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);
    vec3 lightDir = normalize(u_sunDirection);

    // Fresnel Schlick Approximation (Water IOR ~ 1.333, F0 ~ 0.02)
    float cosTheta = clamp(dot(viewDir, normal), 0.0, 1.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);

    // Specular Reflection (Blinn-Phong)
    vec3 halfVector = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfVector), 0.0);
    float specular = pow(NdotH, 128.0 / (u_roughness + 0.01));

    // Deep Ocean Water Scattering Gradient
    vec3 waterColor = mix(u_waterDeepColor, u_waterShallowColor, fresnel * 0.7);

    // Diffuse Sunlight on Swell
    float NdotL = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = u_sunColor * NdotL * 0.4;

    // Specular Sun Glare
    vec3 sunGlaze = u_sunColor * specular * 1.5;

    // Subtle Subsurface Scattering
    float sss = pow(clamp(dot(viewDir, -lightDir), 0.0, 1.0), 4.0) * 0.3;
    vec3 sssColor = u_waterShallowColor * sss;

    vec3 finalColor = waterColor + diffuse + sunGlaze + sssColor;

    gl_FragColor = vec4(finalColor, u_opacity);
  }
`;
