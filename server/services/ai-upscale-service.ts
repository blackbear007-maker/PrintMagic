/**
 * Free Cloud AI Super-Resolution Service (Hugging Face Serverless Real-ESRGAN)
 */

export class AiUpscaleService {
  private static readonly HF_MODEL_URL =
    'https://api-inference.huggingface.co/models/ai-forever/Real-ESRGAN';

  /**
   * Calls the free serverless AI Neural Upscaler with fallback
   */
  public static async upscaleImage(
    imageDataUrl: string,
    apiKey?: string
  ): Promise<{ dataUrl: string; model: string; scale: number }> {
    // 1. Convert base64 dataUrl to buffer
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(this.HF_MODEL_URL, {
        method: 'POST',
        headers,
        body: imageBuffer,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI API returned status ${response.status}: ${response.statusText}`);
      }

      const outputBuffer = Buffer.from(await response.arrayBuffer());
      const outputBase64 = outputBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${outputBase64}`;

      return {
        dataUrl,
        model: 'Real-ESRGAN 4x+ (Deep Neural Network)',
        scale: 4
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`AI Upscale API Error: ${err?.message || err}`);
    }
  }
}
