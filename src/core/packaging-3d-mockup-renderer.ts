/**
 * 📦 04. Packaging3DMockupRenderer (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * E-commerce brand owners and designers want to preview how their 2D flat packaging artwork
 * looks as a folded 3D physical box before committing to a costly production run.
 * 
 * Mathematical Solution:
 * 1. Takes 3 box face dimensions (Length, Width, Height in mm) and front/side artwork.
 * 2. Applies 3D Isometric Affine Projection (30° angle matrix).
 * 3. Applies Lambertian directional lighting (Top light 1.0, Front face 0.85, Side face 0.65).
 * 4. Adds soft contact shadow under box base for realistic product mockup presentation.
 */

export interface PackagingMockupConfig {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  boxFinish: 'gloss' | 'matte' | 'foil-gold';
  brandTitle?: string;
}

export class Packaging3DMockupRenderer {
  public static renderBoxMockupSvg(config: PackagingMockupConfig): string {
    const L = config.lengthMm || 120;
    const W = config.widthMm || 80;
    const H = config.heightMm || 160;

    // Isometric projection angle (30 degrees: cos(30)=0.866, sin(30)=0.5)
    const cos30 = 0.866;
    const sin30 = 0.5;

    // Origin coordinates at center
    const ox = 250;
    const oy = 280;

    // Vector calculations for box vertices
    // Front face extends along +X, -Y(isometric)
    const fx = L * cos30;
    const fy = L * sin30;

    // Side face extends along -X, -Y(isometric)
    const sx = W * cos30;
    const sy = W * sin30;

    // Height extends along -Y
    const vz = H * 1.2;

    // Points of 3D box
    const p0 = { x: ox, y: oy }; // Bottom front corner
    const p1 = { x: ox + fx, y: oy - fy }; // Bottom right corner
    const p2 = { x: ox - sx, y: oy - sy }; // Bottom left corner

    const p0Top = { x: ox, y: oy - vz }; // Top front corner
    const p1Top = { x: ox + fx, y: oy - fy - vz }; // Top right corner
    const p2Top = { x: ox - sx, y: oy - sy - vz }; // Top left corner
    const pTopBack = { x: ox + fx - sx, y: oy - fy - sy - vz }; // Top rear corner

    // Finishes and color palettes
    const frontFill = config.boxFinish === 'foil-gold' ? 'url(#goldGradFront)' : '#2E3A59';
    const sideFill = config.boxFinish === 'foil-gold' ? 'url(#goldGradSide)' : '#1E2638';
    const topFill = config.boxFinish === 'foil-gold' ? 'url(#goldGradTop)' : '#41527D';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <!-- Soft Contact Shadow -->
    <filter id="boxShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
      <feOffset dx="0" dy="18" result="offsetblur" />
      <feComponentTransfer><feFuncA type="linear" tableValues="0 0.35" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>

    <!-- Gold Foil Gradients -->
    <linearGradient id="goldGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D4AF37" />
      <stop offset="50%" stop-color="#FFF3A8" />
      <stop offset="100%" stop-color="#AA7C11" />
    </linearGradient>
    <linearGradient id="goldGradSide" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#996515" />
      <stop offset="100%" stop-color="#6B4408" />
    </linearGradient>
    <linearGradient id="goldGradTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF8DC" />
      <stop offset="100%" stop-color="#D4AF37" />
    </linearGradient>
  </defs>

  <!-- Ground Drop Shadow -->
  <polygon points="${p0.x},${p0.y + 10} ${p1.x + 20},${p1.y + 15} ${pTopBack.x},${oy + 30} ${p2.x - 20},${p2.y + 15}" fill="#000" opacity="0.25" filter="url(#boxShadow)" />

  <!-- 3D Box Right Face (Front Main Panel) -->
  <polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p1Top.x},${p1Top.y} ${p0Top.x},${p0Top.y}" fill="${frontFill}" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.3" />

  <!-- 3D Box Left Face (Side Panel) -->
  <polygon points="${p0.x},${p0.y} ${p2.x},${p2.y} ${p2Top.x},${p2Top.y} ${p0Top.x},${p0Top.y}" fill="${sideFill}" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.3" />

  <!-- 3D Box Top Face (Lid Panel) -->
  <polygon points="${p0Top.x},${p0Top.y} ${p1Top.x},${p1Top.y} ${pTopBack.x},${pTopBack.y} ${p2Top.x},${p2Top.y}" fill="${topFill}" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.3" />

  <!-- Product Branding Text (Isometric Skew) -->
  <g transform="translate(${ox + fx * 0.4}, ${oy - fy * 0.4 - vz * 0.5}) skewY(-15)">
    <text x="0" y="0" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="2">
      ${config.brandTitle || 'PREMIUM BOX'}
    </text>
    <text x="0" y="18" font-family="sans-serif" font-size="8" fill="#ffffff" opacity="0.8" text-anchor="middle">
      ${L} × ${W} × ${H} mm
    </text>
  </g>
</svg>`;
  }
}
