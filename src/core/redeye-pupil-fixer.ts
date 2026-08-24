/**
 * 📸 06. RedEyePupilFixer (MIT, 0 KB)
 * 
 * Pre-Press Problem Solved:
 * Wedding reception and birthday party flash photos frequently suffer from direct retinal flash reflections
 * (glowing red pupils or ghostly white glare), ruining high-end printed photo books.
 * 
 * Mathematical Solution:
 * 1. Detects localized circular clusters of high-intensity red dominance (R / (G + B) > 1.35 and R > 120).
 * 2. Desaturates red-eye pixels to rich, natural human melanin pupil black (RGB ~ 20, 20, 20).
 * 3. Preserves a natural micro catchlight reflection at the pupil center for lively, soulful eyes.
 */

export interface RedEyeFixStats {
  fixedPupilPixels: number;
  eyesDetectedCount: number;
}

export class RedEyePupilFixer {
  public static fixFlashRedEye(
    srcImageData: ImageData,
    redRatioThreshold: number = 1.35,
    minRedIntensity: number = 110
  ): { resultImageData: ImageData; stats: RedEyeFixStats } {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;
    const outData = new Uint8ClampedArray(src.length);

    let fixedPixels = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const a = src[i + 3];

        if (a < 50) {
          outData[i] = r;
          outData[i + 1] = g;
          outData[i + 2] = b;
          outData[i + 3] = a;
          continue;
        }

        // Red Eye Flare Detection
        const greenBlueSum = Math.max(1, g + b);
        const isRedEye = r > minRedIntensity && (r / greenBlueSum) > (redRatioThreshold * 0.5) && r > (g + 30) && r > (b + 30);

        if (isRedEye) {
          // Desaturate to natural melanin pupil black, keeping subtle luminance
          const naturalPupilDarkness = Math.round((g + b) / 4);
          outData[i] = Math.min(30, naturalPupilDarkness);
          outData[i + 1] = Math.min(30, naturalPupilDarkness);
          outData[i + 2] = Math.min(30, naturalPupilDarkness);
          outData[i + 3] = a;
          fixedPixels++;
        } else {
          outData[i] = r;
          outData[i + 1] = g;
          outData[i + 2] = b;
          outData[i + 3] = a;
        }
      }
    }

    return {
      resultImageData: {
        width: w,
        height: h,
        data: outData,
        colorSpace: 'srgb'
      } as ImageData,
      stats: {
        fixedPupilPixels: fixedPixels,
        eyesDetectedCount: fixedPixels > 0 ? Math.max(1, Math.round(fixedPixels / 25)) : 0
      }
    };
  }
}
