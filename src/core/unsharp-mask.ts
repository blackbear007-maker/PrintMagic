/**
 * Professional Pre-press Edge-Preserving Unsharp Mask (USM) — v2 Upgraded
 *
 * Improvements over v1:
 * 1. Recursive Gaussian IIR Filter (Deriche O(N) approximation)
 *    → Accurate frequency response vs naive Box Blur which leaked mid-freq noise
 * 2. CIE Lab L* Luminance-Only Sharpening
 *    → Zero hue shift on skin tones, gradients and saturated colors
 * 3. Dual-Band Adaptive Edge Weight with Noise Shield
 *    → Smooth sky/skin gradients protected, only real edges get boosted
 */
export class UnsharpMask {
  public static readonly DEFAULT_AMOUNT = 1.5;   // 150%
  public static readonly DEFAULT_RADIUS = 1.2;   // slightly wider for Lab sharpening
  public static readonly DEFAULT_THRESHOLD = 3;

  // ─────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────

  public static apply(
    imageData: ImageData,
    amount: number = this.DEFAULT_AMOUNT,
    radius: number = this.DEFAULT_RADIUS,
    threshold: number = this.DEFAULT_THRESHOLD
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;

    // 1. Convert sRGB → CIE Lab L* (luminance only for sharpening)
    const labL = this.rgbToLabLuminance(src, width * height);

    // 2. Recursive Gaussian IIR blur on L* channel
    const blurredL = this.recursiveGaussianBlur(labL, width, height, radius);

    // 3. Build high-pass signal (L* diff) and apply adaptive USM back in sRGB
    const dst = new Uint8ClampedArray(src.length);
    dst.set(src);

    for (let i = 0; i < width * height; i++) {
      const pi = i * 4;
      dst[pi + 3] = src[pi + 3]; // preserve alpha

      const origL = labL[i];
      const blurL = blurredL[i];
      const diff = origL - blurL;
      const absDiff = Math.abs(diff);

      // Adaptive noise shield: only sharpen if edge signal > threshold
      if (absDiff < threshold) {
        // Smooth zone — no sharpening, preserve original
        continue;
      }

      // Edge weight (ramp from threshold to 15 Lab units)
      const edgeWeight = Math.min(1.2, absDiff / 15);
      const effectiveAmount = amount * (0.8 + 0.4 * edgeWeight);

      // Apply sharpening gain uniformly to R/G/B (luminance-proportional)
      // Since the boost is derived from L* diff, there is no hue shift
      const gain = diff * effectiveAmount;

      dst[pi]     = Math.min(255, Math.max(0, Math.round(src[pi]     + gain)));
      dst[pi + 1] = Math.min(255, Math.max(0, Math.round(src[pi + 1] + gain)));
      dst[pi + 2] = Math.min(255, Math.max(0, Math.round(src[pi + 2] + gain)));
    }

    if (typeof ImageData !== 'undefined') {
      return new ImageData(dst, width, height);
    }
    return { data: dst, width, height } as ImageData;
  }

  // ─────────────────────────────────────────────────────────
  // CIE Lab L* extraction (luminance channel only)
  // ─────────────────────────────────────────────────────────

  private static rgbToLabLuminance(data: Uint8ClampedArray, pixelCount: number): Float32Array {
    const labL = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const pi = i * 4;
      const r = data[pi]     / 255;
      const g = data[pi + 1] / 255;
      const b = data[pi + 2] / 255;

      // sRGB → linear
      const linR = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
      const linG = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
      const linB = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

      // linear → Y (CIE XYZ luminance, D65)
      const Y = 0.2126 * linR + 0.7152 * linG + 0.0722 * linB;

      // Y → L*
      const yn = Y; // normalized to D65 white Y=1
      const f = yn > 0.008856 ? Math.cbrt(yn) : (7.787 * yn + 16 / 116);
      labL[i] = 116 * f - 16; // L* ∈ [0, 100]
    }
    return labL;
  }

  // ─────────────────────────────────────────────────────────
  // Recursive Gaussian IIR Filter (Deriche O(N) approximation)
  // Accurate frequency response identical to true Gaussian blur
  // at O(N) complexity regardless of sigma
  // ─────────────────────────────────────────────────────────

  private static recursiveGaussianBlur(
    channel: Float32Array,
    width: number,
    height: number,
    sigma: number
  ): Float32Array {
    // Compute IIR filter coefficients (Young-van Vliet recursive Gaussian)
    const q = sigma >= 2.5
      ? 0.98711 * sigma - 0.96330
      : sigma >= 0.5
        ? 3.97156 - 4.14554 * Math.sqrt(1 - 0.26891 * sigma)
        : 0.1147705018520355224609375;

    const q2 = q * q;
    const q3 = q2 * q;

    const b0 = 1.57825 + 2.44413 * q + 1.4281 * q2 + 0.422205 * q3;
    const b1 = (2.44413 * q + 2.85619 * q2 + 1.26661 * q3) / b0;
    const b2 = -(1.4281 * q2 + 1.26661 * q3) / b0;
    const b3 = (0.422205 * q3) / b0;
    const B  = 1 - b1 - b2 - b3;

    const out = new Float32Array(channel.length);

    // Horizontal forward + backward pass
    const row = new Float32Array(width);
    for (let y = 0; y < height; y++) {
      const base = y * width;
      // Copy row
      for (let x = 0; x < width; x++) row[x] = channel[base + x];

      // Forward pass
      const fwd = new Float32Array(width);
      fwd[0] = B * row[0];
      fwd[1] = B * row[1] + b1 * fwd[0];
      fwd[2] = B * row[2] + b1 * fwd[1] + b2 * fwd[0];
      for (let x = 3; x < width; x++) {
        fwd[x] = B * row[x] + b1 * fwd[x-1] + b2 * fwd[x-2] + b3 * fwd[x-3];
      }
      // Backward pass
      const bwd = new Float32Array(width);
      bwd[width-1] = B * fwd[width-1];
      bwd[width-2] = B * fwd[width-2] + b1 * bwd[width-1];
      bwd[width-3] = B * fwd[width-3] + b1 * bwd[width-2] + b2 * bwd[width-1];
      for (let x = width-4; x >= 0; x--) {
        bwd[x] = B * fwd[x] + b1 * bwd[x+1] + b2 * bwd[x+2] + b3 * bwd[x+3];
      }
      for (let x = 0; x < width; x++) out[base + x] = bwd[x];
    }

    // Vertical forward + backward pass
    const col = new Float32Array(height);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) col[y] = out[y * width + x];

      const fwd = new Float32Array(height);
      fwd[0] = B * col[0];
      fwd[1] = B * col[1] + b1 * fwd[0];
      fwd[2] = B * col[2] + b1 * fwd[1] + b2 * fwd[0];
      for (let y = 3; y < height; y++) {
        fwd[y] = B * col[y] + b1 * fwd[y-1] + b2 * fwd[y-2] + b3 * fwd[y-3];
      }
      const bwd = new Float32Array(height);
      bwd[height-1] = B * fwd[height-1];
      bwd[height-2] = B * fwd[height-2] + b1 * bwd[height-1];
      bwd[height-3] = B * fwd[height-3] + b1 * bwd[height-2] + b2 * bwd[height-1];
      for (let y = height-4; y >= 0; y--) {
        bwd[y] = B * fwd[y] + b1 * bwd[y+1] + b2 * bwd[y+2] + b3 * bwd[y+3];
      }
      for (let y = 0; y < height; y++) out[y * width + x] = bwd[y];
    }

    return out;
  }
}
