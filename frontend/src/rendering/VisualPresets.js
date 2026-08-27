/**
 * SCIENTIFIC VISUAL PRESETS
 * 
 * Presets designed for scientific oceanography and mission control operations.
 * These presets adjust lighting, globe base materials, and vector contrast without
 * altering scientific colormaps or data values.
 */

export const VISUAL_PRESETS = {
  STANDARD_OCEAN: {
    id: 'STANDARD_OCEAN',
    label: 'Standard Scientific',
    description: 'Deep oceanic blue with atmospheric scattering and true bathymetry.',
    oceanColor: 0x051226,
    atmosphereColor: 0x38bdf8,
    atmosphereIntensity: 0.35,
    landColor: 0x0b172a,
    coastlineColor: 0x1e3a5f,
    coastlineOpacity: 0.8,
    graticuleColor: 0x1e3a5f,
    graticuleOpacity: 0.45,
    ambientLightColor: 0x243b55,
    ambientIntensity: 0.7,
    directionalIntensity: 1.2,
  },
  HIGH_CONTRAST_ANALYTIC: {
    id: 'HIGH_CONTRAST_ANALYTIC',
    label: 'High Contrast Vector',
    description: 'Dark basalt background with vivid vector boundaries for publication figures.',
    oceanColor: 0x020617,
    atmosphereColor: 0x06b6d4,
    atmosphereIntensity: 0.2,
    landColor: 0x0f172a,
    coastlineColor: 0x38bdf8,
    coastlineOpacity: 0.95,
    graticuleColor: 0x0ea5e9,
    graticuleOpacity: 0.6,
    ambientLightColor: 0x1e293b,
    ambientIntensity: 0.8,
    directionalIntensity: 1.0,
  },
  NIGHT_INFRARED: {
    id: 'NIGHT_INFRARED',
    label: 'Infrared / Thermal NVG',
    description: 'Low-light thermal mode emphasizing surface temperature gradients.',
    oceanColor: 0x030712,
    atmosphereColor: 0x22c55e,
    atmosphereIntensity: 0.4,
    landColor: 0x052e16,
    coastlineColor: 0x4ade80,
    coastlineOpacity: 0.85,
    graticuleColor: 0x166534,
    graticuleOpacity: 0.5,
    ambientLightColor: 0x064e3b,
    ambientIntensity: 0.6,
    directionalIntensity: 0.9,
  },
  DEEP_BATHYMETRIC: {
    id: 'DEEP_BATHYMETRIC',
    label: 'Deep Bathymetric',
    description: 'Highlights abyssal plains, oceanic ridges, and continental shelves.',
    oceanColor: 0x020d1e,
    atmosphereColor: 0x6366f1,
    atmosphereIntensity: 0.3,
    landColor: 0x1e1b4b,
    coastlineColor: 0x818cf8,
    coastlineOpacity: 0.85,
    graticuleColor: 0x4338ca,
    graticuleOpacity: 0.4,
    ambientLightColor: 0x312e81,
    ambientIntensity: 0.7,
    directionalIntensity: 1.1,
  },
};
