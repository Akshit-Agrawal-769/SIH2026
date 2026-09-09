/**
 * Generates high-resolution, sci-fi oceanographic telemetry marker icons
 * on an off-screen HTML5 canvas for Cesium billboards.
 * 
 * Supports:
 * - Argo Profiling Floats (Amber Gold with profiling buoy silhouette)
 * - Autonomous Underwater Gliders (Neon Magenta with swept-wing glider silhouette)
 * - Moored MetOcean Buoys (Neon Emerald with anchored buoy tower & tripod silhouette)
 * - Generic Sensor Extensions (Cyber Cyan beacon)
 */

export interface MarkerIconOptions {
  type: 'argo' | 'glider' | 'moored_buoy' | string;
  size?: number;
  hovered?: boolean;
}

// In-memory cache of generated data URLs to avoid re-rendering canvases
const iconCache = new Map<string, string>();

export function getPlatformMarkerIconUrl(type: string, hovered = false): string {
  const normType = type.toLowerCase();
  const key = `${normType}_${hovered ? 'hover' : 'normal'}`;
  if (iconCache.has(key)) {
    return iconCache.get(key)!;
  }

  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  const cx = size / 2;
  const cy = size / 2;

  // Palette configuration based on platform type
  let primaryColor = '#00E5FF'; // Cyber Cyan default
  let accentGlow = 'rgba(0, 229, 255, ';
  const cyberCyan = '#00E5FF';

  if (normType === 'argo') {
    primaryColor = '#FFB300'; // Amber gold
    accentGlow = 'rgba(255, 179, 0, ';
  } else if (normType === 'glider') {
    primaryColor = '#FF007F'; // Neon Magenta
    accentGlow = 'rgba(255, 0, 127, ';
  } else if (normType === 'moored_buoy') {
    primaryColor = '#00E676'; // Emerald Neon
    accentGlow = 'rgba(0, 230, 118, ';
  }

  ctx.clearRect(0, 0, size, size);

  // 1. Soft Radiant Atmosphere / Halo Glow
  const glowRadius = hovered ? 60 : 54;
  const glowGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, glowRadius);
  glowGrad.addColorStop(0, accentGlow + (hovered ? '0.55)' : '0.35)'));
  glowGrad.addColorStop(0.5, accentGlow + (hovered ? '0.22)' : '0.12)'));
  glowGrad.addColorStop(1, accentGlow + '0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Outer Sonar / Radar Pulse Ring
  const outerRingRadius = hovered ? 52 : 46;
  ctx.strokeStyle = accentGlow + (hovered ? '0.85)' : '0.55)');
  ctx.lineWidth = hovered ? 2 : 1.5;
  if (normType === 'glider') {
    ctx.setLineDash([6, 4]);
  } else if (normType === 'moored_buoy') {
    ctx.setLineDash([3, 3]);
  } else {
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, outerRingRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // 3. Four Cardinal Crosshair Telemetry Ticks
  const tickLength = hovered ? 9 : 7;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  const tickDist = outerRingRadius - 2;

  // North
  ctx.beginPath();
  ctx.moveTo(cx, cy - tickDist);
  ctx.lineTo(cx, cy - tickDist - tickLength);
  ctx.stroke();
  // South
  ctx.beginPath();
  ctx.moveTo(cx, cy + tickDist);
  ctx.lineTo(cx, cy + tickDist + tickLength);
  ctx.stroke();
  // East
  ctx.beginPath();
  ctx.moveTo(cx + tickDist, cy);
  ctx.lineTo(cx + tickDist + tickLength, cy);
  ctx.stroke();
  // West
  ctx.beginPath();
  ctx.moveTo(cx - tickDist, cy);
  ctx.lineTo(cx - tickDist - tickLength, cy);
  ctx.stroke();

  // 4. Dark Ocean High-Contrast Core Disc
  const discRadius = hovered ? 26 : 22;
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = hovered ? 18 : 12;

  ctx.fillStyle = '#020b18'; // Deep abyssal navy
  ctx.beginPath();
  ctx.arc(cx, cy, discRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = hovered ? 2.5 : 2;
  ctx.stroke();
  ctx.restore();

  // 5. Platform Vector Silhouettes
  if (normType === 'argo') {
    // --- ARGO PROFILING BUOY SILHOUETTE ---
    ctx.save();
    ctx.translate(cx, cy);

    // Buoy Hull
    const hullGrad = ctx.createLinearGradient(-7, -8, 7, 8);
    hullGrad.addColorStop(0, '#FFC107');
    hullGrad.addColorStop(0.5, '#FF8F00');
    hullGrad.addColorStop(1, '#E65100');
    ctx.fillStyle = hullGrad;

    ctx.beginPath();
    ctx.roundRect(-6, -7, 12, 16, [4, 4, 3, 3]);
    ctx.fill();

    // Buoy Collar Striping
    ctx.fillStyle = '#1A237E';
    ctx.fillRect(-6, -1, 12, 2.5);

    // Antenna Mast
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, -14);
    ctx.stroke();

    // Satellite Beacon Ping Light on Tip
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -14, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Telemetry Uplink Waves
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -13, 5, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();

    ctx.restore();
  } else if (normType === 'glider') {
    // --- AUTONOMOUS UNDERWATER GLIDER ICON ---
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 5);

    // Streamlined Fuselage
    const gliderGrad = ctx.createLinearGradient(-4, -12, 4, 12);
    gliderGrad.addColorStop(0, '#FF4081');
    gliderGrad.addColorStop(0.6, '#D81B60');
    gliderGrad.addColorStop(1, '#880E4F');
    ctx.fillStyle = gliderGrad;

    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.quadraticCurveTo(4, -5, 4, 6);
    ctx.lineTo(1.5, 12);
    ctx.lineTo(-1.5, 12);
    ctx.lineTo(-4, 6);
    ctx.quadraticCurveTo(-4, -5, 0, -13);
    ctx.closePath();
    ctx.fill();

    // High-aspect Swept Glider Wings
    ctx.fillStyle = '#FF80AB';
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(14, 4);
    ctx.lineTo(13, 6);
    ctx.lineTo(3, 2);
    ctx.moveTo(-3, -2);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-13, 6);
    ctx.lineTo(-3, 2);
    ctx.fill();

    // Science Payload Nose Sensor (Neon Cyan)
    ctx.fillStyle = cyberCyan;
    ctx.shadowColor = cyberCyan;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(0, -12.5, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  } else if (normType === 'moored_buoy') {
    // --- MOORED METOCEAN BUOY SILHOUETTE ---
    ctx.save();
    ctx.translate(cx, cy);

    // Circular Toroid Float
    const toroidGrad = ctx.createLinearGradient(-10, -2, 10, 8);
    toroidGrad.addColorStop(0, '#00E676');
    toroidGrad.addColorStop(0.5, '#00B0FF');
    toroidGrad.addColorStop(1, '#00838F');
    ctx.fillStyle = toroidGrad;

    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tower Met Mast (Pyramid Frame)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(0, -12);
    ctx.lineTo(6, 2);
    ctx.stroke();

    // Cross brace
    ctx.beginPath();
    ctx.moveTo(-3.5, -4);
    ctx.lineTo(3.5, -4);
    ctx.stroke();

    // Anemometer / Met Payload Sensor atop tower
    ctx.fillStyle = '#FFEB3B';
    ctx.shadowColor = '#FFEB3B';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -13, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Mooring line extending down into ocean abyss
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, 16);
    ctx.stroke();

    ctx.restore();
  } else {
    // --- GENERIC SENSOR BEACON ---
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = cyberCyan;
    ctx.shadowColor = cyberCyan;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL('image/png');
  iconCache.set(key, dataUrl);
  return dataUrl;
}
