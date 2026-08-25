import { ObjectEraser } from '../core/object-eraser';

/**
 * 🎨 Local Inpainting Client
 *
 * There is no self-hosted inpainting model (an earlier version tried POSTing to a `/inpaint`
 * endpoint that returned the input image unchanged while reporting success — see the git history
 * of docker/zero-dce/server.py). This always runs the real local engine directly: a Navier-Stokes
 * style canvas inpainter (see src/core/object-eraser.ts).
 */
export class FreeInpaintingClient {
  private static readonly cache = new Map<string, ImageData>();

  /**
   * Erase unwanted objects/watermarks from image using mask
   */
  public static async eraseObject(
    sourceImageData: ImageData,
    maskImageData: ImageData
  ): Promise<{ imageData: ImageData; isCloud: boolean; modelUsed: string }> {
    const cacheKey = `${sourceImageData.width}x${sourceImageData.height}_${sourceImageData.data[0]}_${sourceImageData.data[100]}`;
    if (this.cache.has(cacheKey)) {
      return { imageData: this.cache.get(cacheKey)!, isCloud: false, modelUsed: '快取結果' };
    }

    const localResult = ObjectEraser.inpaint(sourceImageData, maskImageData);
    this.cache.set(cacheKey, localResult);
    return {
      imageData: localResult,
      isCloud: false,
      modelUsed: '本機 Navier-Stokes 畫布修復'
    };
  }
}
