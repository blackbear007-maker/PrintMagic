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
   * Morphological Erosion (Shrink by radius) — separable box filter, O(w·h) total.
   *
   * ⚠️ 2026-08-28 效能修正：舊版是逐像素做 O(半徑²) 的圓形視窗全掃描（`dx²+dy²<=radius²`），預設
   * `bleedOffsetPx=24` 下，2000×2000 圖片要跑數十億次操作，會明顯卡住 UI。改用可分離（水平再垂直
   * 兩次 1D 掃描）的滑動窗口總和演算法：因為遮罩只有 0/1 兩種值，「視窗內全部是 1」等價於「視窗總和
   * ==視窗大小」，「視窗內至少一個 1」等價於「視窗總和 >0」——用滑動窗口總和（進一個像素、出一個像素）
   * 可以在 O(1) 攤銷時間內更新，讓每個方向的 1D 掃描變成 O(寬) 或 O(高)，總計 O(寬×高)，不再隨半徑
   * 平方增長。誠實揭露一個形狀上的取捨：可分離性只對「正方形/矩形」結構元素成立，原本的圓形結構元素
   * 無法真正分離，因此改用正方形視窗——對「白墨內縮 0.2mm」「刀模外擴 2mm」這種印前用途，方形跟圓形
   * 視窗的差異只在極小的轉角圓角程度，實務上不影響裁切/白墨效果。邊界行為維持一致：超出圖片範圍視為
   * 「非實心（0）」，讓侵蝕在圖片邊緣正確發生（跟舊版 `if (ny<0||ny>=h) isSolid=false` 語意相同）。
   */
  private static erode(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
    return this.separableBoxMorphology(mask, w, h, radius, 'erode');
  }

  /**
   * Morphological Dilation (Expand by radius) — separable box filter, O(w·h) total.
   * See the fix note on `erode()` above — same technique, same circular→square disclosure.
   */
  private static dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
    return this.separableBoxMorphology(mask, w, h, radius, 'dilate');
  }

  /**
   * Shared separable binary morphology: erosion (`mode='erode'`, output 1 only where the whole
   * window is 1) or dilation (`mode='dilate'`, output 1 where any window pixel is 1), each done
   * as an O(w·h) horizontal pass followed by an O(w·h) vertical pass on the horizontal result —
   * the standard, mathematically exact separable decomposition for a box (rectangular)
   * structuring element (not valid for a circular one, which is why the structuring element
   * changed from circular to square — see the fix note on `erode()`).
   */
  private static separableBoxMorphology(
    mask: Uint8Array,
    w: number,
    h: number,
    radius: number,
    mode: 'erode' | 'dilate'
  ): Uint8Array {
    if (radius <= 0) return new Uint8Array(mask);
    const windowSize = 2 * radius + 1;
    const isErode = mode === 'erode';
    const hitsWindow = (sum: number): number =>
      isErode ? (sum === windowSize ? 1 : 0) : (sum > 0 ? 1 : 0);

    // Horizontal pass: slide a window of width `windowSize` along each row.
    const afterRows = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const rowBase = y * w;
      let sum = 0;
      for (let dx = 0; dx <= radius && dx < w; dx++) sum += mask[rowBase + dx];
      for (let x = 0; x < w; x++) {
        afterRows[rowBase + x] = hitsWindow(sum);
        const leaveX = x - radius;
        const enterX = x + radius + 1;
        if (leaveX >= 0) sum -= mask[rowBase + leaveX];
        if (enterX < w) sum += mask[rowBase + enterX];
      }
    }

    // Vertical pass: slide the same window down each column of the horizontal-pass result.
    const out = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = 0; dy <= radius && dy < h; dy++) sum += afterRows[dy * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = hitsWindow(sum);
        const leaveY = y - radius;
        const enterY = y + radius + 1;
        if (leaveY >= 0) sum -= afterRows[leaveY * w + x];
        if (enterY < h) sum += afterRows[enterY * w + x];
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
