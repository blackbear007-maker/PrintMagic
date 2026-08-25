/**
 * 🎯 Gradient-Centroid Focal Cropper (pure client-side algorithm, no model weights)
 *
 * What this actually is:
 * Computes a center-biased, gradient-energy-weighted pixel centroid — pixels with more local
 * contrast near the image center pull the "focal point" toward them. It is not NanoDet-Plus (a
 * real anchor-free object detection network) — there is no anchor prediction, no object
 * classification, no learned model of any kind. It has no idea what a face or logo *is*; it only
 * knows "high local contrast, roughly central" tends to correlate with the subject in typical
 * photos. Works reasonably for a single clear subject against a simpler background; will not
 * reliably find small or off-center subjects, or choose between multiple subjects.
 */

export interface FocalSubjectBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerXPercent: number; // 0 ~ 100
  centerYPercent: number; // 0 ~ 100
  confidence: number; // heuristic strength of the gradient-energy signal, not a calibrated probability
}

export class GradientCentroidCropper {
  /**
   * Estimates the focal subject bounding box via a gradient-energy-weighted, center-biased centroid
   */
  public static detectSubject(imageData: ImageData): FocalSubjectBox {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;

    let minX = w, maxX = 0, minY = h, maxY = 0;

    const step = Math.max(1, Math.floor(Math.min(w, h) / 80));

    for (let y = step; y < h - step; y += step) {
      for (let x = step; x < w - step; x += step) {
        const idx = (y * w + x) * 4;
        const a = data[idx + 3];
        if (a < 30) continue;

        // Gradient energy
        const idxRight = (y * w + (x + step)) * 4;
        const idxDown = ((y + step) * w + x) * 4;

        const gx = Math.abs(data[idx] - data[idxRight]) + Math.abs(data[idx + 1] - data[idxRight + 1]) + Math.abs(data[idx + 2] - data[idxRight + 2]);
        const gy = Math.abs(data[idx] - data[idxDown]) + Math.abs(data[idx + 1] - data[idxDown + 1]) + Math.abs(data[idx + 2] - data[idxDown + 2]);
        const energy = gx + gy;

        // Center bias (subjects are often near center)
        const dxCenter = (x - w / 2) / (w / 2);
        const dyCenter = (y - h / 2) / (h / 2);
        const centerBias = Math.exp(-(dxCenter * dxCenter + dyCenter * dyCenter) / 1.5);

        const weight = energy * centerBias;

        if (weight > 45) {
          weightedX += x * weight;
          weightedY += y * weight;
          totalWeight += weight;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const cX = totalWeight > 0 ? weightedX / totalWeight : w / 2;
    const cY = totalWeight > 0 ? weightedY / totalWeight : h / 2;

    const boxW = Math.max(w * 0.3, maxX > minX ? maxX - minX : w * 0.5);
    const boxH = Math.max(h * 0.3, maxY > minY ? maxY - minY : h * 0.5);

    return {
      x: Math.max(0, Math.round(cX - boxW / 2)),
      y: Math.max(0, Math.round(cY - boxH / 2)),
      width: Math.min(w, Math.round(boxW)),
      height: Math.min(h, Math.round(boxH)),
      centerXPercent: Math.round((cX / w) * 100),
      centerYPercent: Math.round((cY / h) * 100),
      confidence: totalWeight > 1000 ? 0.92 : 0.75 // coarse heuristic strength, not a measured probability
    };
  }
}
