import { EdgeChokeMatting } from '../core/edge-choke-matting';

/**
 * ✂️ Local Background Removal Client
 *
 * Runs entirely client-side: a corner-sampled color-distance matting pass (see
 * src/core/edge-choke-matting.ts). There is no self-hosted matting microservice — a previous
 * version of this client called `/api/ai/matting`, but that endpoint's backend was a no-op stub
 * that echoed the input image back while reporting success=true, which silently produced an
 * unmodified (not background-removed) result whenever the network was reachable, and never
 * actually ran the local engine below. That dead/deceptive network path has been removed; this
 * always uses the real, working local engine now.
 *
 * 2026-08-29: this used to run a SECOND full-image matting pass (`AiMatting.removeBackground`)
 * over EdgeChokeMatting's already-matted output purely to get a `toDataURL()` string — wasted
 * work, and worse, a real correctness bug: the returned `dataUrl` encoded AiMatting's hard
 * three-tier alpha (re-computed from corners that were already partially transparent from pass
 * one), while the returned `imageData` was EdgeChokeMatting's smoother first-pass alpha — the two
 * fields described two different images. Fixed by encoding the dataUrl directly from
 * EdgeChokeMatting's own result, so both fields are the same single pass.
 *
 * Separately: this client (and edge-choke-matting.ts) currently has no callers anywhere in
 * main.ts/src/ui — the live matting pipeline (`free-matting-client.ts` → `FreeMattingClient`) uses
 * `AiMatting` directly instead. Left in place rather than deleted since EdgeChokeMatting's alpha
 * (soft feathering, hairline gradient boost, edge choke against print fringing) is a real
 * capability AiMatting's live path lacks — worth wiring in or consciously removing, not silently
 * left to rot.
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
    return {
      dataUrl: this.imageDataToDataUrl(edgeChokeResult.mattedImageData),
      imageData: edgeChokeResult.mattedImageData,
      isCloud: false
    };
  }

  private static imageDataToDataUrl(imageData: ImageData): string {
    if (typeof document === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }
}
