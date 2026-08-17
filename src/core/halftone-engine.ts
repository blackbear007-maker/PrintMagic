/**
 * CMYK Rosette Halftone Screen Simulation Engine
 * Recreates physical offset press screen angles and dot rosette formations under 20x magnification.
 * Hardened with persistent off-screen canvas buffers to prevent GC thrashing and GPU out-of-memory crashes.
 */

export interface HalftoneAngles {
  cyan: number;
  magenta: number;
  yellow: number;
  black: number;
}

export const STANDARD_SCREEN_ANGLES: HalftoneAngles = {
  cyan: 15 * (Math.PI / 180),
  magenta: 75 * (Math.PI / 180),
  yellow: 0 * (Math.PI / 180),
  black: 45 * (Math.PI / 180)
};

export class HalftoneEngine {
  // Reusable persistent off-screen canvas buffers to prevent memory leaks / GC thrashing
  private static canvasC: HTMLCanvasElement | null = null;
  private static canvasM: HTMLCanvasElement | null = null;
  private static canvasY: HTMLCanvasElement | null = null;
  private static canvasK: HTMLCanvasElement | null = null;
  private static ctxC: CanvasRenderingContext2D | null = null;
  private static ctxM: CanvasRenderingContext2D | null = null;
  private static ctxY: CanvasRenderingContext2D | null = null;
  private static ctxK: CanvasRenderingContext2D | null = null;

  private static ensureBuffers(w: number, h: number): {
    ctxC: CanvasRenderingContext2D;
    ctxM: CanvasRenderingContext2D;
    ctxY: CanvasRenderingContext2D;
    ctxK: CanvasRenderingContext2D;
    canvasC: HTMLCanvasElement;
    canvasM: HTMLCanvasElement;
    canvasY: HTMLCanvasElement;
    canvasK: HTMLCanvasElement;
  } {
    if (!this.canvasC) {
      this.canvasC = document.createElement('canvas');
      this.canvasM = document.createElement('canvas');
      this.canvasY = document.createElement('canvas');
      this.canvasK = document.createElement('canvas');
      this.ctxC = this.canvasC.getContext('2d')!;
      this.ctxM = this.canvasM.getContext('2d')!;
      this.ctxY = this.canvasY.getContext('2d')!;
      this.ctxK = this.canvasK.getContext('2d')!;
    }

    if (this.canvasC.width !== w || this.canvasC.height !== h) {
      this.canvasC.width = this.canvasM!.width = this.canvasY!.width = this.canvasK!.width = w;
      this.canvasC.height = this.canvasM!.height = this.canvasY!.height = this.canvasK!.height = h;
    } else {
      // Clear previous frames
      this.ctxC!.clearRect(0, 0, w, h);
      this.ctxM!.clearRect(0, 0, w, h);
      this.ctxY!.clearRect(0, 0, w, h);
      this.ctxK!.clearRect(0, 0, w, h);
    }

    this.ctxC!.fillStyle = '#00a8e8'; // Cyan
    this.ctxM!.fillStyle = '#e60067'; // Magenta
    this.ctxY!.fillStyle = '#ffd000'; // Yellow
    this.ctxK!.fillStyle = '#1a1a1a'; // Black

    return {
      ctxC: this.ctxC!,
      ctxM: this.ctxM!,
      ctxY: this.ctxY!,
      ctxK: this.ctxK!,
      canvasC: this.canvasC,
      canvasM: this.canvasM!,
      canvasY: this.canvasY!,
      canvasK: this.canvasK!
    };
  }

  /**
   * Render a magnified CMYK rosette halftone preview on a destination Canvas context
   */
  public static renderHalftonePatch(
    srcImageData: ImageData,
    destCtx: CanvasRenderingContext2D,
    srcCenter: { x: number; y: number },
    destSize: { width: number; height: number },
    zoom: number = 8,
    dotSpacing: number = 7
  ): void {
    const { width: destW, height: destH } = destSize;
    const srcData = srcImageData.data;
    const srcW = srcImageData.width;
    const srcH = srcImageData.height;

    // Fill clean paper white background
    destCtx.fillStyle = '#f8f9fa';
    destCtx.fillRect(0, 0, destW, destH);

    // Reuse persistent channel buffers
    const {
      ctxC,
      ctxM,
      ctxY,
      ctxK,
      canvasC,
      canvasM,
      canvasY,
      canvasK
    } = this.ensureBuffers(destW, destH);

    // Sample range in source image
    const halfSampleW = (destW / zoom) / 2;
    const halfSampleH = (destH / zoom) / 2;
    const minSrcX = Math.max(0, Math.floor(srcCenter.x - halfSampleW));
    const maxSrcX = Math.min(srcW - 1, Math.ceil(srcCenter.x + halfSampleW));
    const minSrcY = Math.max(0, Math.floor(srcCenter.y - halfSampleH));
    const maxSrcY = Math.min(srcH - 1, Math.ceil(srcCenter.y + halfSampleH));

    // For each channel angle, render screen dots (Path Batching: 1 fill call per channel)
    const renderChannel = (
      ctx: CanvasRenderingContext2D,
      angle: number,
      channelKey: 'c' | 'm' | 'y' | 'k'
    ) => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const diagonal = Math.hypot(destW, destH);
      const maxGrid = Math.ceil(diagonal / dotSpacing) + 2;

      // ✅ Batch all dots into a single Path2D per channel to eliminate per-dot GPU state changes
      ctx.beginPath();

      for (let gy = -maxGrid; gy <= maxGrid; gy++) {
        for (let gx = -maxGrid; gx <= maxGrid; gx++) {
          const u = gx * dotSpacing;
          const v = gy * dotSpacing;

          // Rotate grid back to destination canvas space centered at destW/2, destH/2
          const dx = u * cosA - v * sinA + destW / 2;
          const dy = u * sinA + v * cosA + destH / 2;

          if (dx < -dotSpacing || dx > destW + dotSpacing || dy < -dotSpacing || dy > destH + dotSpacing) {
            continue;
          }

          // Map destination position to source image pixel
          const sx = Math.round(srcCenter.x + (dx - destW / 2) / zoom);
          const sy = Math.round(srcCenter.y + (dy - destH / 2) / zoom);

          if (sx < minSrcX || sx > maxSrcX || sy < minSrcY || sy > maxSrcY) {
            continue;
          }

          const idx = (sy * srcW + sx) * 4;
          const r = srcData[idx] / 255;
          const g = srcData[idx + 1] / 255;
          const b = srcData[idx + 2] / 255;

          // Calculate CMYK density
          const k = 1 - Math.max(r, g, b);
          let c = 0, m = 0, y = 0;
          if (k < 1) {
            const denom = 1 - k;
            c = (1 - r - k) / denom;
            m = (1 - g - k) / denom;
            y = (1 - b - k) / denom;
          }

          const density = channelKey === 'c' ? c : channelKey === 'm' ? m : channelKey === 'y' ? y : k;

          if (density > 0.02) {
            const maxRadius = (dotSpacing / 2) * 1.15;
            const dotRadius = maxRadius * Math.sqrt(density);

            // Add arc to the current batched path (no fill yet)
            ctx.moveTo(dx + dotRadius, dy);
            ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
          }
        }
      }

      // ✅ Single fill call for all dots in this channel
      ctx.fill();
    };

    renderChannel(ctxC, STANDARD_SCREEN_ANGLES.cyan, 'c');
    renderChannel(ctxM, STANDARD_SCREEN_ANGLES.magenta, 'm');
    renderChannel(ctxY, STANDARD_SCREEN_ANGLES.yellow, 'y');
    renderChannel(ctxK, STANDARD_SCREEN_ANGLES.black, 'k');

    // Composite channels with multiply blending mode
    destCtx.globalCompositeOperation = 'multiply';
    destCtx.drawImage(canvasY, 0, 0);
    destCtx.drawImage(canvasM, 0, 0);
    destCtx.drawImage(canvasC, 0, 0);
    destCtx.drawImage(canvasK, 0, 0);
    destCtx.globalCompositeOperation = 'source-over';
  }
}
