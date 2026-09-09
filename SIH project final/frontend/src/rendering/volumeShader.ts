/**
 * GLSL Vertex Shader for 3D Ocean Volume Ray-Marching Bounding Box
 */
export const VOLUME_VERTEX_SHADER = `
in vec3 position;
in vec3 normal;
in vec2 st;

out vec3 v_positionEC;
out vec3 v_texCoord;
out vec3 v_rayDirection;

void main() {
    v_positionEC = (czm_modelViewRelativeToEye * vec4(position, 1.0)).xyz;
    // Map normalized bounding box position to [0, 1] texture coordinates
    v_texCoord = position * 0.5 + 0.5;
    v_rayDirection = normalize(position);
    gl_Position = czm_modelViewProjectionRelativeToEye * vec4(position, 1.0);
}
`;

/**
 * GLSL Fragment Shader for Ocean Volume Ray-Marching & Depth-Slice sampling
 */
export const VOLUME_FRAGMENT_SHADER = `
in vec3 v_positionEC;
in vec3 v_texCoord;
in vec3 v_rayDirection;

uniform sampler2D u_dataTexture;
uniform float u_depthSlice; // -1.0 for full 3D volume, or 0.0-1.0 for horizontal depth plane
uniform float u_opacity;
uniform float u_verticalExaggeration;
uniform vec2 u_dataRange; // [minVal, maxVal]
uniform int u_colormapType; // 0=Turbo, 1=Viridis, 2=Chlorophyll

// Polynomial Turbo Colormap
vec3 turbo(float t) {
    t = clamp(t, 0.0, 1.0);
    float r = 0.1357 + t * (4.61539 + t * (-42.6603 + t * (132.131 + t * (-152.942 + t * 59.2864))));
    float g = 0.0914 + t * (-2.19418 + t * (16.4289 + t * (14.6455 + t * (-44.8236 + t * 16.7118))));
    float b = 0.1067 + t * (12.5833 + t * (-30.1604 + t * (18.0097 + t * (11.7584 + t * -12.4338))));
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

// Viridis Colormap Approximation
vec3 viridis(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.267, 0.004, 0.329);
    vec3 c1 = vec3(0.127, 0.566, 0.550);
    vec3 c2 = vec3(0.993, 0.906, 0.144);
    if (t < 0.5) {
        return mix(c0, c1, t * 2.0);
    } else {
        return mix(c1, c2, (t - 0.5) * 2.0);
    }
}

vec3 evalColormap(float normVal) {
    if (u_colormapType == 1) {
        return viridis(normVal);
    }
    return turbo(normVal);
}

void main() {
    // 1. Depth-slice mode: sample horizontal plane
    if (u_depthSlice >= 0.0) {
        vec2 uv = v_texCoord.xy;
        vec4 sampleData = texture(u_dataTexture, uv);
        float normVal = clamp(sampleData.r, 0.0, 1.0);
        vec3 col = evalColormap(normVal);
        out_FragColor = vec4(col, sampleData.a * u_opacity);
        return;
    }

    // 2. Full 3D Volume Ray-Marching
    vec3 rayStep = normalize(v_rayDirection) * 0.015;
    vec3 currentPos = v_texCoord;
    vec4 accumulatedColor = vec4(0.0);

    for (int i = 0; i < 48; i++) {
        if (currentPos.x < 0.0 || currentPos.x > 1.0 ||
            currentPos.y < 0.0 || currentPos.y > 1.0 ||
            currentPos.z < 0.0 || currentPos.z > 1.0) {
            break;
        }

        vec4 sampleData = texture(u_dataTexture, currentPos.xy);
        float normVal = sampleData.r;

        if (sampleData.a > 0.01) {
            vec3 col = evalColormap(normVal);
            float stepAlpha = sampleData.a * u_opacity * 0.12;

            // Front-to-back optical compositing
            accumulatedColor.rgb += (1.0 - accumulatedColor.a) * col * stepAlpha;
            accumulatedColor.a += (1.0 - accumulatedColor.a) * stepAlpha;

            if (accumulatedColor.a >= 0.95) break;
        }

        currentPos += rayStep;
    }

    out_FragColor = accumulatedColor;
}
`;

export interface VolumeShaderUniforms {
  depthSlice: number; // -1.0 for full volume, 0.0-1.0 for depth plane
  opacity: number;
  verticalExaggeration: number;
  dataRange: [number, number];
  colormapType: number; // 0=Turbo, 1=Viridis, 2=Chlorophyll
}

/**
 * Helper to create uniforms structure for the volume shader
 */
export function createVolumeUniforms(initial?: Partial<VolumeShaderUniforms>): VolumeShaderUniforms {
  return {
    depthSlice: initial?.depthSlice ?? -1.0,
    opacity: initial?.opacity ?? 0.85,
    verticalExaggeration: initial?.verticalExaggeration ?? 100.0,
    dataRange: initial?.dataRange ?? [20.0, 32.0],
    colormapType: initial?.colormapType ?? 0
  };
}
