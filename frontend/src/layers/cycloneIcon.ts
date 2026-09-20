/**
 * Generates an unmistakable weather-map tropical cyclone / hurricane marker icon
 * on an off-screen HTML5 canvas for 3D globe billboards.
 * 
 * Shape & Visual Design:
 * - Authentic meteorological cyclone symbol: tight spiral with curved pinwheel arms
 *   rotating counter-clockwise around a central eye (matching Indian Ocean cyclone dynamics).
 * - Central calm eye with a bright luminous eyewall ring and central eye dot.
 * - 2 sweeping aerodynamic curved spiral rainband arms tapering gracefully outward.
 * - High-contrast dark outline ensuring crisp visibility over satellite imagery and depth slices.
 * - Dynamic color gradient (vivid storm coral/crimson to electric cyan) with hover luminescence.
 */

const iconCache = new Map<string, string>();

export function getCycloneMarkerIconUrl(hovered = false): string {
  const key = `cyclone_vortex_${hovered ? 'hover' : 'normal'}`;
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

  // Storm palette: Vibrant cyclonic coral/amber transitioning to electric cyan
  const coralColor = hovered ? '#FF1744' : '#FF3D71';
  const cyanColor = hovered ? '#00FFFF' : '#38BDF8';
  const eyeColor = hovered ? '#FFFFFF' : '#E0F2FE';
  const glowRgba = hovered ? 'rgba(255, 23, 68, 0.45)' : 'rgba(255, 61, 113, 0.25)';

  ctx.clearRect(0, 0, size, size);

  // 1. Soft atmospheric storm glow behind the swirling vortex
  const glowGrad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 54);
  glowGrad.addColorStop(0, glowRgba);
  glowGrad.addColorStop(0.6, hovered ? 'rgba(0, 229, 255, 0.20)' : 'rgba(56, 189, 248, 0.10)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 54, 0, Math.PI * 2);
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
      // Tapers smoothly from wide near the eye to a sharp tip
      const thickness = Math.sin(t * Math.PI) * (hovered ? 13 : 11);
      const rInner = Math.max(eyeR * 0.9, eyeR + t * 40 - thickness);
      const x = cx + rInner * Math.cos(angle);
      const y = cy + rInner * Math.sin(angle);
      ctx.lineTo(x, y);
    }

    ctx.closePath();

    // High-contrast dark outline for maximum legibility against ocean & terrain
    ctx.strokeStyle = '#020b18';
    ctx.lineWidth = hovered ? 3.5 : 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Vibrant linear gradient along the spiral arm
    const armGrad = ctx.createLinearGradient(
      cx + eyeR * Math.cos(baseAngle),
      cy + eyeR * Math.sin(baseAngle),
      cx + 46 * Math.cos(baseAngle - armSpanAngle),
      cy + 46 * Math.sin(baseAngle - armSpanAngle)
    );
    armGrad.addColorStop(0, coralColor);
    armGrad.addColorStop(0.55, hovered ? '#FF6D00' : '#FB7185');
    armGrad.addColorStop(1, cyanColor);

    ctx.fillStyle = armGrad;
    ctx.fill();

    // Subtle luminous inner highlight spine along the arm
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  // 3. Central Cyclone Eye (Calm core encircled by intense eyewall)
  // Eye outer shadow / border
  ctx.save();
  ctx.shadowColor = hovered ? cyanColor : coralColor;
  ctx.shadowBlur = hovered ? 12 : 8;

  // Dark calm center of the eye
  ctx.fillStyle = '#020b18';
  ctx.beginPath();
  ctx.arc(cx, cy, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Eyewall ring
  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = hovered ? 2.5 : 2;
  ctx.stroke();

  // Central eye pinpoint
  ctx.fillStyle = cyanColor;
  ctx.beginPath();
  ctx.arc(cx, cy, hovered ? 3 : 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  iconCache.set(key, dataUrl);
  return dataUrl;
}
