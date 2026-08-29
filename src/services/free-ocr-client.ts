import { createWorker, OEM, type Worker } from 'tesseract.js';

/**
 * Local OCR Client (self-hosted Tesseract.js — real WASM port of Tesseract OCR, Apache-2.0)
 *
 * Scoped narrowly on purpose, learning from this project's own history: OCR (Tesseract, server-
 * side) was removed 2026-08-26 because the problem it was pointed at — reading AI-hallucinated
 * garbled "text" in generated artwork — is fundamentally unsolvable by OCR (that "text" usually
 * isn't composed of real characters at all). This client exists for a genuinely different, well-
 * defined problem: reading real printed/photographed text that happens to be low-resolution or
 * blurry (a scanned business card, a photographed label, a low-res logo) — real OCR engines are
 * actually good at that. The two cases are told apart by OCR's own confidence score, not by any
 * special-case detection logic: a genuinely blurry real word still reads with moderate-to-high
 * confidence; feeding Tesseract a region of decorative AI-hallucinated squiggles (not real
 * characters) reliably produces low-confidence, often near-empty output — "garbage in" naturally
 * yields "low-confidence garbage out," which the confidence gate below rejects.
 *
 * 100% local, no network round-trip to any server: the WASM core + worker script + language data
 * are self-hosted in public/tesseract/ (copied from the tesseract.js / tesseract.js-core npm
 * packages and the official tesseract-ocr/tessdata_fast GitHub releases, all Apache-2.0 — see
 * public/tesseract/README.md for provenance and how to refresh them). The only network activity
 * is a one-time same-origin fetch of those static files on first use (lazy — nothing loads until
 * OCR is actually invoked), not a call to any external/third-party service, so this is NOT gated
 * behind NetworkGuard.isPrivacyShieldActive() the way the self-hosted-service Free*Clients are —
 * no image data or recognition result ever leaves the browser.
 *
 * Supports English + Traditional Chinese (`eng` + `chi_tra`) in one worker, matching this app's
 * Traditional-Chinese-speaking print/design audience. Recognition accuracy on chi_tra is honestly
 * expected to be noticeably weaker than eng, especially on stylized/decorative poster fonts — CJK
 * OCR is a harder problem than Latin-script OCR in general, and tessdata_fast trades some accuracy
 * for speed/size versus tessdata_best. The confidence gate is the same for both scripts; callers
 * should not assume equal reliability.
 */
export interface OcrRegionResult {
  text: string;
  confidence: number; // 0-100, Tesseract's own reported confidence for this recognition
}

const CORE_PATH = '/tesseract/tesseract-core-lstm.wasm.js';
const WORKER_PATH = '/tesseract/worker.min.js';
const LANG_PATH = '/tesseract/lang-data';
const LANGS = ['eng', 'chi_tra'];

/** Below this confidence (0-100), treat the recognition as unreliable and report no text found. */
export const OCR_MIN_TRUSTED_CONFIDENCE = 60;

export class FreeOcrClient {
  private static workerPromise: Promise<Worker> | null = null;

  private static getWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker(LANGS, OEM.LSTM_ONLY, {
        corePath: CORE_PATH,
        workerPath: WORKER_PATH,
        langPath: LANG_PATH,
        gzip: false
      }).catch((err) => {
        // Let the next call retry instead of caching a permanently-broken worker promise.
        this.workerPromise = null;
        throw err;
      });
    }
    return this.workerPromise;
  }

  /**
   * Recognizes text within a rectangular region of a full-image canvas. Returns null if OCR is
   * unavailable (worker failed to initialize — e.g. self-hosted assets missing) or the region
   * couldn't be read; returns a low/near-zero confidence result (not null) when OCR ran but found
   * nothing trustworthy, so callers can distinguish "didn't try" from "tried, found nothing."
   */
  public static async recognizeRegion(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<OcrRegionResult | null> {
    try {
      const worker = await this.getWorker();
      const result = await worker.recognize(sourceCanvas as any, {
        rectangle: { left: region.x, top: region.y, width: region.width, height: region.height }
      });
      return {
        text: this.cleanCjkSpacing((result.data.text || '').trim()),
        confidence: result.data.confidence ?? 0
      };
    } catch {
      return null;
    }
  }

  /**
   * Tesseract treats each CJK character as its own "word," inserting a space between every pair
   * — verified directly against real output ("限量特別版" → "限量 特 別 版"). Real Traditional
   * Chinese text is never actually space-separated per character, so this strips whitespace
   * between two CJK characters while leaving spaces next to Latin text/punctuation untouched
   * (e.g. "SALE 特別版" keeps its one real separating space).
   */
  private static cleanCjkSpacing(text: string): string {
    const cjk = '\\u4e00-\\u9fff\\u3400-\\u4dbf';
    return text.replace(new RegExp(`([${cjk}])\\s+(?=[${cjk}])`, 'gu'), '$1');
  }

  /**
   * Draws an ImageData onto a fresh canvas suitable for passing to recognizeRegion — the source
   * canvas is created once per image and reused across multiple region calls, since worker.recognize
   * accepts a canvas + rectangle directly rather than needing a separate crop per region.
   */
  public static imageDataToCanvas(imageData: ImageData): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    } catch {
      return null;
    }
  }

  /** Releases the underlying worker (WASM instance + loaded language data). */
  public static async terminate(): Promise<void> {
    if (!this.workerPromise) return;
    try {
      const worker = await this.workerPromise;
      await worker.terminate();
    } catch {
      // Already gone or never fully initialized — nothing to clean up.
    } finally {
      this.workerPromise = null;
    }
  }
}
