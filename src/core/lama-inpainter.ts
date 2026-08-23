import { ObjectEraser, type InpaintOptions } from './object-eraser';

/**
 * 🪄 LaMa-Lite (Fast Fourier Inpainting) & Object Eraser Engine
 * 
 * Pre-Press Problem Solved:
 * Customers need to erase timestamps, watermarks, dust spots, and photobombing strangers
 * before commercial output.
 * 
 * Solution:
 * 1. Client-Side: Fast Marching Gradient Inward Diffusion + Cosine Feathering (0ms offline).
 * 2. Server-Side: Fast Fourier Convolution (FFC) receptive field inpainting for large areas.
 */
export class LamaInpainter {
  /**
   * Inpaints masked areas on an image
   */
  public static inpaint(
    srcImageData: ImageData,
    maskImageData: ImageData,
    options: InpaintOptions = {}
  ): ImageData {
    return ObjectEraser.inpaint(srcImageData, maskImageData, options);
  }
}
