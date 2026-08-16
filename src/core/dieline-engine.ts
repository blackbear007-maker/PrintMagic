/**
 * ✂️ Smart Dieline CutContour & White Ink Choke Engine
 * Generates White Ink Spot Channels (0.2mm choke) & Vector Cutlines (2mm offset) for transparent/acrylic stickers.
 */

export interface DielineOutput {
  cmykCanvas: HTMLCanvasElement;
  whiteInkCanvas: HTMLCanvasElement; // K100 binary mask for white ink plate
  cutContourCanvas: HTMLCanvasElement; // 100% Magenta 1pt cutline
  compositeCanvas: HTMLCanvasElement; // 3-layer visual preview
  hasTransparency: boolean;
  totalSolidPixels: number;
}

export class DielineEngine {
  /**
   * Processes an image to generate separated White Ink & Cut Contour layers
   */
  public static generateLayers(
    sourceImageData: ImageData,
    chokePx = 3, // ~0.25mm at 300 DPI
    bleedOffsetPx = 24 // ~2.0mm at 300 DPI
  ): DielineOutput {
    const { width: w, height: h, data } = sourceImageData;

    // 1. Extract Alpha Mask
    const alphaMask = new Uint8Array(w * h);
    let transparentCount = 0;
    let solidCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      const pixelIdx = i / 4;
      if (a > 20) {
        alphaMask[pixelIdx] = 1;
        solidCount++;
      } else {
        alphaMask[pixelIdx] = 0;
        transparentCount++;
      }
    }

    const hasTransparency = transparentCount > 100;

    // 2. Generate White Ink Layer with Morphological Erosion (0.2mm Choke)
    const whiteInkMask = this.erode(alphaMask, w, h, chokePx);

    // 3. Generate Cut Contour Mask with Morphological Dilation (2mm Offset)
    const cutMask = this.dilate(alphaMask, w, h, bleedOffsetPx);

    // Create Canvases
    const cmykCanvas = document.createElement('canvas');
    cmykCanvas.width = w;
    cmykCanvas.height = h;
    const cmykCtx = cmykCanvas.getContext('2d')!;
    cmykCtx.putImageData(sourceImageData, 0, 0);

    // White Ink Canvas (K100 Pure Black Mask for Printing Plate)
    const whiteInkCanvas = document.createElement('canvas');
    whiteInkCanvas.width = w;
    whiteInkCanvas.height = h;
    const whiteCtx = whiteInkCanvas.getContext('2d')!;
    const whiteImgData = whiteCtx.createImageData(w, h);

    for (let i = 0; i < whiteInkMask.length; i++) {
      const idx = i * 4;
      if (whiteInkMask[i] === 1) {
        // K100 Black on plate representing solid white ink
        whiteImgData.data[idx] = 0;
        whiteImgData.data[idx + 1] = 0;
        whiteImgData.data[idx + 2] = 0;
        whiteImgData.data[idx + 3] = 255;
      } else {
        whiteImgData.data[idx] = 255;
        whiteImgData.data[idx + 1] = 255;
        whiteImgData.data[idx + 2] = 255;
        whiteImgData.data[idx + 3] = 0;
      }
    }
    whiteCtx.putImageData(whiteImgData, 0, 0);

    // Cut Contour Canvas (100% Magenta Cutline)
    const cutContourCanvas = document.createElement('canvas');
    cutContourCanvas.width = w;
    cutContourCanvas.height = h;
    const cutCtx = cutContourCanvas.getContext('2d')!;
    this.drawContourBoundary(cutCtx, cutMask, w, h);

    // Composite Preview Canvas
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = w;
    compositeCanvas.height = h;
    const compCtx = compositeCanvas.getContext('2d')!;

    // Checkerboard background for transparency
    this.drawCheckerboard(compCtx, w, h);

    // Draw White Ink Base glow
    compCtx.drawImage(whiteInkCanvas, 0, 0);

    // Draw CMYK Artwork
    compCtx.drawImage(cmykCanvas, 0, 0);

    // Overlay Magenta Dieline
    compCtx.drawImage(cutContourCanvas, 0, 0);

    return {
      cmykCanvas,
      whiteInkCanvas,
      cutContourCanvas,
      compositeCanvas,
      hasTransparency,
      totalSolidPixels: solidCount
    };
  }

  /**
   * Morphological Erosion (Shrink by radius)
   */
  private static erode(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
    if (radius <= 0) return new Uint8Array(mask);
    const out = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let isSolid = true;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) {
            isSolid = false;
            break;
          }
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) {
              isSolid = false;
              break;
            }
            if (dx * dx + dy * dy <= radius * radius) {
              if (mask[ny * w + nx] === 0) {
                isSolid = false;
                break;
              }
            }
          }
          if (!isSolid) break;
        }
        out[y * w + x] = isSolid ? 1 : 0;
      }
    }
    return out;
  }

  /**
   * Morphological Dilation (Expand by radius)
   */
  private static dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
    if (radius <= 0) return new Uint8Array(mask);
    const out = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x] === 1) {
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= w) continue;
              if (dx * dx + dy * dy <= radius * radius) {
                out[ny * w + nx] = 1;
              }
            }
          }
        }
      }
    }
    return out;
  }

  /**
   * Draws 100% Magenta 1.5pt Dieline along the outer mask perimeter
   */
  private static drawContourBoundary(
    ctx: CanvasRenderingContext2D,
    mask: Uint8Array,
    w: number,
    h: number
  ): void {
    ctx.strokeStyle = '#ff00ff'; // 100% Magenta CutContour Standard
    ctx.lineWidth = 3;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const val = mask[y * w + x];
        if (val === 1) {
          // Check 4-neighbors
          const isEdge =
            mask[(y - 1) * w + x] === 0 ||
            mask[(y + 1) * w + x] === 0 ||
            mask[y * w + (x - 1)] === 0 ||
            mask[y * w + (x + 1)] === 0;

          if (isEdge) {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(x, y, 2, 2);
          }
        }
      }
    }
  }

  private static drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const size = 16;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = (x / size + y / size) % 2 === 0 ? '#f0f0f2' : '#ffffff';
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}
