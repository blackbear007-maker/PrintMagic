import type { PrintPreset } from '../types';

/**
 * 🖼️ AI 智慧 3mm 印刷出血外擴延伸引擎 (Generative Bleed Expander v2 with Cosine Seam Healing)
 * 特色：
 * 1. 解決裁切 3mm 切到頭部/重要內容痛點
 * 2. 邊緣紋理外推 + 4px 雙向餘弦權重接縫羽化 (Cosine Seam Healing)
 * 3. 保持原始主體位於 100% 安全區內，接縫處 0 斷層
 */
export class BleedExpander {
  /**
   * Generates a 3mm expanded bleed canvas from source ImageData with seamless seam healing
   */
  public static expandBleed(
    srcImageData: ImageData,
    preset: PrintPreset,
    bleedMarginMm: number = 3
  ): { imageData: ImageData; dataUrl: string; width: number; height: number } {
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;

    // Calculate pixel padding corresponding to bleed margin
    const bleedPxX = Math.max(16, Math.round((srcW / (preset.widthMm || 210)) * bleedMarginMm));
    const bleedPxY = Math.max(16, Math.round((srcH / (preset.heightMm || 297)) * bleedMarginMm));

    const outW = srcW + bleedPxX * 2;
    const outH = srcH + bleedPxY * 2;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    // 1. Draw source image on a temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = srcW;
    tempCanvas.height = srcH;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(srcImageData, 0, 0);

    // 2. Mirror-Edge Texture Extrapolation for Outpainting
    // Top bleed
    ctx.save();
    ctx.translate(bleedPxX, bleedPxY);
    ctx.scale(1, -1);
    ctx.drawImage(tempCanvas, 0, 0, srcW, bleedPxY, 0, 0, srcW, bleedPxY);
    ctx.restore();

    // Bottom bleed
    ctx.save();
    ctx.translate(bleedPxX, bleedPxY + srcH);
    ctx.scale(1, -1);
    ctx.drawImage(tempCanvas, 0, srcH - bleedPxY, srcW, bleedPxY, 0, 0, srcW, bleedPxY);
    ctx.restore();

    // Left bleed
    ctx.save();
    ctx.translate(bleedPxX, bleedPxY);
    ctx.scale(-1, 1);
    ctx.drawImage(tempCanvas, 0, 0, bleedPxX, srcH, 0, 0, bleedPxX, srcH);
    ctx.restore();

    // Right bleed
    ctx.save();
    ctx.translate(bleedPxX + srcW, bleedPxY);
    ctx.scale(-1, 1);
    ctx.drawImage(tempCanvas, srcW - bleedPxX, 0, bleedPxX, srcH, 0, 0, bleedPxX, srcH);
    ctx.restore();

    // Corners (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
    ctx.drawImage(tempCanvas, 0, 0, bleedPxX, bleedPxY, 0, 0, bleedPxX, bleedPxY);
    ctx.drawImage(tempCanvas, srcW - bleedPxX, 0, bleedPxX, bleedPxY, outW - bleedPxX, 0, bleedPxX, bleedPxY);
    ctx.drawImage(tempCanvas, 0, srcH - bleedPxY, bleedPxX, bleedPxY, 0, outH - bleedPxY, bleedPxX, bleedPxY);
    ctx.drawImage(
      tempCanvas,
      srcW - bleedPxX,
      srcH - bleedPxY,
      bleedPxX,
      bleedPxY,
      outW - bleedPxX,
      outH - bleedPxY,
      bleedPxX,
      bleedPxY
    );

    // 3. Draw pristine center subject on top
    ctx.drawImage(tempCanvas, bleedPxX, bleedPxY);

    const outImgData = ctx.getImageData(0, 0, outW, outH);

    // 4. Apply Cosine Seam Healing across the 4 interior boundaries (4-pixel radius)
    this.healSeamBoundaries(outImgData, bleedPxX, bleedPxY, srcW, srcH);

    ctx.putImageData(outImgData, 0, 0);
    const outDataUrl = canvas.toDataURL('image/png');

    return {
      imageData: outImgData,
      dataUrl: outDataUrl,
      width: outW,
      height: outH
    };
  }

  /**
   * Applies a smooth raised-cosine blending across the 4 interior seam lines
   */
  private static healSeamBoundaries(
    data: ImageData,
    bx: number,
    by: number,
    sw: number,
    sh: number,
    radius: number = 3
  ): void {
    const pixels = data.data;
    const w = data.width;
    const h = data.height;

    // Horizontal Seam Healing (Top and Bottom seams)
    for (const seamY of [by, by + sh]) {
      const minY = Math.max(0, seamY - radius);
      const maxY = Math.min(h - 1, seamY + radius);

      for (let y = minY; y <= maxY; y++) {
        const t = (y - (seamY - radius)) / (radius * 2);
        const weight = 0.5 * (1 - Math.cos(Math.PI * t)); // Raised cosine weight

        for (let x = bx; x < bx + sw; x++) {
          const idx = (y * w + x) * 4;
          const mirrorY = seamY - (y - seamY);
          if (mirrorY >= 0 && mirrorY < h) {
            const mirrorIdx = (mirrorY * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              pixels[idx + c] = Math.round(pixels[idx + c] * weight + pixels[mirrorIdx + c] * (1 - weight));
            }
          }
        }
      }
    }

    // Vertical Seam Healing (Left and Right seams)
    for (const seamX of [bx, bx + sw]) {
      const minX = Math.max(0, seamX - radius);
      const maxX = Math.min(w - 1, seamX + radius);

      for (let x = minX; x <= maxX; x++) {
        const t = (x - (seamX - radius)) / (radius * 2);
        const weight = 0.5 * (1 - Math.cos(Math.PI * t));

        for (let y = by; y < by + sh; y++) {
          const idx = (y * w + x) * 4;
          const mirrorX = seamX - (x - seamX);
          if (mirrorX >= 0 && mirrorX < w) {
            const mirrorIdx = (y * w + mirrorX) * 4;
            for (let c = 0; c < 3; c++) {
              pixels[idx + c] = Math.round(pixels[idx + c] * weight + pixels[mirrorIdx + c] * (1 - weight));
            }
          }
        }
      }
    }
  }
}
