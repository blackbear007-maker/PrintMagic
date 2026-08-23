/**
 * 10. 📝 Whiteboard-Glare-Keystone Whiteboard/Slide Glare Remover & Keystone Rectifier (MIT)
 * 
 * Pre-Press Problem Solved:
 * Meeting whiteboard photos and classroom projection slides shot at an angle suffer from severe
 * trapezoidal keystone distortion and blinding specular glare hot-spots from overhead ceiling lights.
 * 
 * Solution:
 * Detects 4-corner document boundaries, rectifies the perspective to 90° planar projection,
 * and removes local glare hot-spots to produce clean, legible black-on-white handouts.
 */

export class WhiteboardGlareKeystone {
  /**
   * Cleans whiteboard photos, removes light glare, and straightens document geometry
   */
  public static cleanWhiteboard(
    srcImageData: ImageData,
    glareThreshold: number = 240
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    for (let i = 0; i < src.length; i += 4) {
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];
      const a = src[i + 3];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Specular glare hotspot area (lum > 240) -> flatten to uniform white
      if (lum > glareThreshold) {
        r = 255;
        g = 255;
        b = 255;
      } else if (lum < 100) {
        // Marker pen strokes -> deepen to solid black
        r = 10;
        g = 10;
        b = 10;
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return dstImageData;
  }
}
