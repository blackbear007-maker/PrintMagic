import { EdgeChokeMatting } from '../core/edge-choke-matting';
import { AiMatting } from '../core/ai-matting';

/**
 * ✂️ Local Background Removal Client
 *
 * Runs entirely client-side: a corner-sampled color-distance matting pass (see
 * src/core/edge-choke-matting.ts) followed by alpha refinement. There is no self-hosted matting
 * microservice — a previous version of this client called `/api/ai/matting`, but that endpoint's
 * backend was a no-op stub that echoed the input image back while reporting success=true, which
 * silently produced an unmodified (not background-removed) result whenever the network was
 * reachable, and never actually ran the local engine below. That dead/deceptive network path has
 * been removed; this always uses the real, working local engine now.
 */
export class FreeAiMattingClient {
  /**
   * Remove background using local corner-sampled color-distance matting
   */
  public static async removeBackground(
    _sourceDataUrl: string,
    sourceImageData: ImageData
  ): Promise<{ dataUrl: string; imageData: ImageData; isCloud: boolean }> {
    const edgeChokeResult = EdgeChokeMatting.extractMatting(sourceImageData, 0.5, true);
    const localResult = AiMatting.removeBackground(edgeChokeResult.mattedImageData, 28);
    return {
      dataUrl: localResult.dataUrl,
      imageData: edgeChokeResult.mattedImageData,
      isCloud: false
    };
  }
}
