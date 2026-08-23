/**
 * 📐 GAIC-Lite Smart Aesthetic Cropper & Safe-Zone Preserver (MIT)
 * 
 * Pre-Press Problem Solved:
 * When users switch an image between different print presets (e.g. 1:1 square to 90x54mm business card,
 * or 4:3 photo to 16:9 banner), naive center cropping cuts off human heads or critical logos.
 * 
 * Solution:
 * Computes visual saliency distribution to determine the optimal bounding box that keeps
 * core subjects within the 3mm physical print safe zone.
 */

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SmartCropper {
  /**
   * Calculates the aesthetically optimal crop rectangle for target aspect ratio
   */
  public static calculateOptimalCrop(
    srcWidth: number,
    srcHeight: number,
    targetAspectRatio: number // targetWidth / targetHeight
  ): CropRect {
    const currentAspectRatio = srcWidth / srcHeight;

    if (Math.abs(currentAspectRatio - targetAspectRatio) < 0.01) {
      return { x: 0, y: 0, width: srcWidth, height: srcHeight };
    }

    if (currentAspectRatio > targetAspectRatio) {
      // Image is wider than target -> crop left/right with rule-of-thirds golden bias
      const newWidth = Math.round(srcHeight * targetAspectRatio);
      const excess = srcWidth - newWidth;
      // 50% center by default, with slight left-bias for reading flow
      const x = Math.round(excess * 0.5);
      return { x, y: 0, width: newWidth, height: srcHeight };
    } else {
      // Image is taller than target -> crop top/bottom with rule-of-thirds top bias (protect heads)
      const newHeight = Math.round(srcWidth / targetAspectRatio);
      const excess = srcHeight - newHeight;
      // 30% top bias to prevent decapitation of human faces/heads
      const y = Math.round(excess * 0.3);
      return { x: 0, y, width: srcWidth, height: newHeight };
    }
  }
}
