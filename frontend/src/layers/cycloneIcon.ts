/**
 * Generates an authentic weather-map tropical cyclone / hurricane marker icon
 * on an off-screen HTML5 canvas for 3D globe billboards.
 * 
 * Shape & Visual Design:
 * - Authentic meteorological cyclone symbol: tight spiral with curved pinwheel arms
 *   rotating counter-clockwise around a central eye.
 * - Realistic storm cloud color palette: muted grey-white tones (#B0B0B0 to #D0D0D0 range)
 *   blending naturally with satellite imagery and ocean layers rather than an alert red pin.
 * - Central calm eye with an intense eyewall ring and central eye dot.
 * - 2 sweeping aerodynamic curved spiral rainband arms tapering gracefully outward.
 * - High-contrast dark outline ensuring crisp visibility over bathymetry, current streamlines,
 *   and satellite coastlines.
 * - Subtle mist luminescence on hover.
 */

const iconCache = new Map<string, string>();

export function getCycloneMarkerIconUrl(hovered = false): string {
  const key = `cyclone_grey_vortex_${hovered ? 'hover' : 'normal'}`;
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

  // Realistic storm/cloud palette: Muted grey-white spectrum (#B0B0B0 to #D0D0D0)
  const cloudBase = hovered ? '#D4D8E2' : '#B8BCC6';
  const cloudMid = hovered ? '#E8ECF4' : '#CCD1DC';
  const cloudHighlight = hovered ? '#FFFFFF' : '#E2E8F0';
  const eyeWallColor = hovered ? '#FFFFFF' : '#F1F5F9';
  const mistGlow = hovered ? 'rgba(235, 242, 252, 0.40)' : 'rgba(195, 205, 220, 0.22)';

  ctx.clearRect(0, 0, size, size);

  // 1. Soft atmospheric storm cloud mist glow behind the swirling vortex
  const glowGrad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 56);
  glowGrad.addColorStop(0, mistGlow);
  glowGrad.addColorStop(0.55, hovered ? 'rgba(215, 225, 240, 0.18)' : 'rgba(175, 185, 200, 0.08)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  ctx.fill();

  // 2. Draw 2 tapered curved spiral arms (classic weather map hurricane/cyclone symbol)
  const eyeR = 10;
  const numArms = 2;
  const armSpanAngle = Math.PI * 1.35; // ~243 degrees of spiral wrap

  for (let armIdx = 0; armIdx < numArms; armIdx++) {
    const baseAngle = armIdx * Math.PI;

    ctx.save();
    ctx.beginPath();

    const steps = 30;
    // Outer edge: sweeps outward from eye wall to arm tip
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Counter-clockwise rotation for Northern Hemisphere tropical cyclones
      const angle = baseAngle - t * armSpanAngle;
      const rOuter = eyeR + t * 40;
      const x = cx + rOuter * Math.cos(angle);
      const y = cy + rOuter * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Inner edge: returns from arm tip back to eye wall, tapering to create aerodynamic curved blade
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const angle = baseAngle - t * (armSpanAngle * 0.92);
      const thickness = Math.sin(t * Math.PI) * (hovered ? 13 : 11);
      const rInner = Math.max(eyeR * 0.9, eyeR + t * 40 - thickness);
      const x = cx + rInner * Math.cos(angle);
      const y = cy + rInner * Math.sin(angle);
      ctx.lineTo(x, y);
    }

    ctx.closePath();

    // High-contrast deep slate outline for sharp definition over oceans and satellite land
    ctx.strokeStyle = '#0a0f1d';
    ctx.lineWidth = hovered ? 3.5 : 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Realistic storm cloud grey-white gradient along the spiral arm
    const armGrad = ctx.createLinearGradient(
      cx + eyeR * Math.cos(baseAngle),
      cy + eyeR * Math.sin(baseAngle),
      cx + 46 * Math.cos(baseAngle - armSpanAngle),
      cy + 46 * Math.sin(baseAngle - armSpanAngle)
    );
    armGrad.addColorStop(0, cloudBase);
    armGrad.addColorStop(0.5, cloudMid);
    armGrad.addColorStop(1, cloudHighlight);

    ctx.fillStyle = armGrad;
    ctx.fill();

    // Luminous silver highlight spine along the arm
    ctx.strokeStyle = hovered ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.50)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  // 3. Central Cyclone Eye (Calm core encircled by intense cloud eyewall)
  ctx.save();
  ctx.shadowColor = hovered ? '#FFFFFF' : '#CBD5E1';
  ctx.shadowBlur = hovered ? 12 : 7;

  // Dark calm center of the eye
  ctx.fillStyle = '#0a0f1d';
  ctx.beginPath();
  ctx.arc(cx, cy, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Eyewall ring in crisp silver-white
  ctx.strokeStyle = eyeWallColor;
  ctx.lineWidth = hovered ? 2.5 : 2;
  ctx.stroke();

  // Central eye pinpoint
  ctx.fillStyle = cloudHighlight;
  ctx.beginPath();
  ctx.arc(cx, cy, hovered ? 2.8 : 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  iconCache.set(key, dataUrl);
  return dataUrl;
}
