/**
 * Generates high-resolution, subtle cyclone point-of-interest marker icons
 * on an off-screen HTML5 canvas for 3D globe billboards.
 * 
 * Design:
 * - Small, subtle spiral/dot glyph consistent in aesthetic with the telemetry markers in markerIcons.ts
 * - Soft atmospheric halo glow
 * - Dark high-contrast core disc to remain legible against deep blue ocean, bathymetry, and satellite maps
 * - High-precision Archimedean spiral glyph with center eye/dot
 * - Hover state with intensified luminescence
 */

const iconCache = new Map<string, string>();

export function getCycloneMarkerIconUrl(hovered = false): string {
  const key = `cyclone_${hovered ? 'hover' : 'normal'}`;
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

  // Storm palette: Electric Cyan with Storm Coral accents
  const primaryColor = hovered ? '#00FFFF' : '#38BDF8';
  const secondaryAccent = hovered ? '#FF3366' : '#FB7185';
  const glowRgba = hovered ? 'rgba(0, 229, 255, ' : 'rgba(56, 189, 248, ';

  ctx.clearRect(0, 0, size, size);

  // 1. Soft atmospheric halo glow
  const glowRadius = hovered ? 58 : 50;
  const glowGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, glowRadius);
  glowGrad.addColorStop(0, glowRgba + (hovered ? '0.60)' : '0.35)'));
  glowGrad.addColorStop(0.5, glowRgba + (hovered ? '0.22)' : '0.12)'));
  glowGrad.addColorStop(1, glowRgba + '0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Outer pulse / boundary ring
  const outerRingRadius = hovered ? 46 : 40;
  ctx.strokeStyle = glowRgba + (hovered ? '0.85)' : '0.50)');
  ctx.lineWidth = hovered ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRingRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Four subtle cardinal tick markers
  const tickLength = hovered ? 6 : 5;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1.5;
  const tickDist = outerRingRadius - 1;

  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  for (const a of angles) {
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx + cosA * tickDist, cy + sinA * tickDist);
    ctx.lineTo(cx + cosA * (tickDist + tickLength), cy + sinA * (tickDist + tickLength));
    ctx.stroke();
  }

  // 4. Dark Abyssal Core Disc for high contrast
  const discRadius = hovered ? 26 : 22;
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = hovered ? 16 : 10;
  ctx.fillStyle = '#020b18';
  ctx.beginPath();
  ctx.arc(cx, cy, discRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Core disc border
  ctx.strokeStyle = secondaryAccent;
  ctx.lineWidth = hovered ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, discRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 5. Archimedean Cyclone Spiral Glyph inside core disc
  ctx.save();
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = hovered ? 2.5 : 2;
  ctx.lineCap = 'round';
  ctx.beginPath();

  const totalTurns = 1.75;
  const maxAngle = totalTurns * Math.PI * 2;
  const spiralRadiusMax = discRadius - 6;
  const b = spiralRadiusMax / maxAngle;

  for (let theta = 0.5; theta <= maxAngle; theta += 0.12) {
    const r = b * theta;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    if (theta === 0.5) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Second symmetrical spiral arm (classic 2-arm cyclonic vortex symbol)
  ctx.strokeStyle = secondaryAccent;
  ctx.beginPath();
  for (let theta = 0.5; theta <= maxAngle; theta += 0.12) {
    const r = b * theta;
    const x = cx - r * Math.cos(theta);
    const y = cy - r * Math.sin(theta);
    if (theta === 0.5) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // 6. Central Eye / Dot Glyph
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, hovered ? 3 : 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  iconCache.set(key, dataUrl);
  return dataUrl;
}
