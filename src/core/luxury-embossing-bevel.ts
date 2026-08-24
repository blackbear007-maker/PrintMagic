/**
 * 🏆 06. LuxuryEmbossingBevel (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Luxury wedding invitations and high-end business cards require physical 3D embossing/debossing (立體打凸/打凹),
 * but creating the 8-bit grayscale depth heightmap for CNC brass engraving dies requires specialized 3D tools.
 * 
 * Mathematical Solution:
 * 1. Extracts high-contrast logo or typography shapes.
 * 2. Computes Euclidean Distance Transform (EDT) from contour edges to center.
 * 3. Applies a 45° smooth parabolic bevel curve to generate an 8-bit grayscale heightmap (0~255)
 *    and a pure 100% K100 vector mask for CNC engraving.
 */

export interface EmbossHeightmapResult {
  heightmapImageData: ImageData;
  solidMaskImageData: ImageData;
  maxReliefMm: number;
}

export class LuxuryEmbossingBevel {
  public static generateEmbossHeightmap(
    srcImageData: ImageData,
    maxReliefMm: number = 0.4,
    bevelRadiusPx: number = 6
  ): EmbossHeightmapResult {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const heightmap = new Uint8ClampedArray(src.length);
    const solidMask = new Uint8ClampedArray(src.length);

    // 1. Binary shape extraction
    const binary = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const a = src[i + 3];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        binary[y * w + x] = (a > 100 && lum < 128) ? 1 : 0;
      }
    }

    // 2. Distance field calculation
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const i = idx * 4;

        if (binary[idx] === 0) {
          // Background: flat zero height
          heightmap[i] = 0;
          heightmap[i + 1] = 0;
          heightmap[i + 2] = 0;
          heightmap[i + 3] = 255;

          solidMask[i] = 255;
          solidMask[i + 1] = 255;
          solidMask[i + 2] = 255;
          solidMask[i + 3] = 0;
          continue;
        }

        // Inside shape: measure distance to closest background pixel
        let minDist = bevelRadiusPx;
        for (let dy = -bevelRadiusPx; dy <= bevelRadiusPx; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) {
            minDist = Math.min(minDist, Math.abs(dy));
            continue;
          }
          for (let dx = -bevelRadiusPx; dx <= bevelRadiusPx; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w || binary[ny * w + nx] === 0) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDist) minDist = dist;
            }
          }
        }

        // Parabolic 45-degree bevel height curve
        const normDist = Math.min(1.0, minDist / bevelRadiusPx);
        const heightVal = Math.round(Math.sin(normDist * (Math.PI / 2)) * 255);

        heightmap[i] = heightVal;
        heightmap[i + 1] = heightVal;
        heightmap[i + 2] = heightVal;
        heightmap[i + 3] = 255;

        // Solid K100 Zinc Die Mask
        solidMask[i] = 0;
        solidMask[i + 1] = 0;
        solidMask[i + 2] = 0;
        solidMask[i + 3] = 255;
      }
    }

    return {
      heightmapImageData: { width: w, height: h, data: heightmap, colorSpace: 'srgb' } as ImageData,
      solidMaskImageData: { width: w, height: h, data: solidMask, colorSpace: 'srgb' } as ImageData,
      maxReliefMm
    };
  }
}
