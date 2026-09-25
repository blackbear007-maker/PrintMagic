import type { DetectedTextRegion, TextInspectionResult } from '../types';
import { FreeSpellCheckClient } from '../services/free-spellcheck-client';
import { FreeOcrClient, OCR_MIN_TRUSTED_CONFIDENCE } from '../services/free-ocr-client';

/**
 * Text & Typo Inspector Engine
 * Client-side only: contrast/edge region-detection heuristic, real local OCR, and a local regex
 * typo dictionary.
 *
 * Capabilities:
 * - High-contrast text region localization (contrast/edge heuristic — finds *where* text probably
 *   is; a deterministic pixel-statistics scan, not a trained detector)
 * - Real OCR (2026-08-29) on each located region via FreeOcrClient (self-hosted Tesseract.js,
 *   Apache-2.0) — reads what the text actually says, gated by Tesseract's own confidence score
 *   (see OCR_MIN_TRUSTED_CONFIDENCE). Scoped deliberately to real printed/photographed text that
 *   may be low-res/blurry — NOT to AI-hallucinated garbled pseudo-text, which server-side OCR
 *   (Tesseract, removed 2026-08-26) was originally and wrongly pointed at; that content usually
 *   isn't composed of real characters at all, and low OCR confidence naturally rejects it here
 *   rather than needing special-case detection.
 * - Dictionary Spellcheck (Levenshtein distance) — now reachable for the first time, since
 *   `region.text` can finally be non-empty
 * - Local regex-based typo matching, via FreeSpellCheckClient (~18 hardcoded rules — despite the
 *   name and its own header comment, this does NOT call the real LanguageTool API; see
 *   src/services/free-spellcheck-client.ts, fixed separately)
 * - Pseudo-gibberish detection heuristic (consonant clustering, repeating chars, casing entropy) —
 *   a pattern-matching filter, not a trained "AI hallucination detector"; now a genuine second
 *   line of defense on top of OCR's own confidence gate, not dead code
 * - Pre-press text sharpness & edge definition check
 */
export interface AutoDetectedTextItem {
  text: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  fontSizePx: number;
  fontFamily: string;
  isK100: boolean;
  color: string;
  isOverprint: boolean;
  confidence?: number;
  /** Real OCR confidence (0-100) when `text` was filled in by FreeOcrClient; undefined when OCR
   *  found nothing trustworthy and `text` is the manual-entry placeholder instead. */
  ocrConfidence?: number;
}

export class TextInspector {
  // Built-in high frequency poster / advertising / AI vocabulary dictionary
  private static readonly COMMON_DICTIONARY: Set<string> = new Set([
    'coffee', 'cafe', 'espresso', 'latte', 'cappuccino', 'special', 'edition', 'exhibition',
    'summer', 'sale', 'premium', 'cyberpunk', 'tokyo', 'design', 'limited', 'studio',
    'print', 'creative', 'art', 'collection', 'autumn', 'winter', 'spring', 'fashion',
    'music', 'festival', 'grand', 'opening', 'classic', 'vintage', 'delicious', 'fresh',
    'menu', 'happy', 'birthday', 'congratulations', 'typography', 'poster', 'gallery',
    'modern', 'future', 'night', 'neon', 'city', 'magic', 'quality', 'nature',
    'organic', 'handcraft', 'vector', 'artisan', 'original', 'authentic', 'official',
    'welcome', 'discount', 'super', 'mega', 'flash', 'world', 'dream', 'space',
    'cosmic', 'universe', 'retro', 'glitch', 'synthwave', 'anime', 'manga', 'club',
    'party', 'lounge', 'restaurant', 'bakery', 'tea', 'matcha', 'dessert', 'sweet',
    'best', 'choice', 'number', 'one', 'exclusive', 'style', 'boutique', 'brand',
    'logo', 'market', 'store', 'shop', 'travel', 'guide', 'adventure', 'explore',
    'holiday', 'vacation', 'peace', 'love', 'hope', 'life', 'story', 'memory',
    'golden', 'silver', 'black', 'white', 'sunset', 'sunrise', 'star', 'moon',
    'ocean', 'forest', 'flower', 'bloom', 'garden', 'green', 'clean', 'pure'
  ]);

  // Common AI Hallucination Typo Mappings (Fast lookup)
  private static readonly COMMON_TYPOS: Record<string, string> = {
    'cofee': 'coffee',
    'coffe': 'coffee',
    'welcom': 'welcome',
    'welcomee': 'welcome',
    'spcial': 'special',
    'specal': 'special',
    'exhibtion': 'exhibition',
    'exibition': 'exhibition',
    'exhibishon': 'exhibition',
    'desing': 'design',
    'disign': 'design',
    'summmer': 'summer',
    'festval': 'festival',
    'festivl': 'festival',
    'premum': 'premium',
    'primium': 'premium',
    'limitd': 'limited',
    'limted': 'limited',
    'creativ': 'creative',
    'creativve': 'creative',
    'edtion': 'edition',
    'clasic': 'classic',
    'cllasic': 'classic',
    'vintag': 'vintage',
    'fashon': 'fashion',
    'galery': 'gallery',
    'orginal': 'original',
    'origanal': 'original',
    'typogrphy': 'typography',
    'cybrpunk': 'cyberpunk',
    'neonn': 'neon',
    'tokiyo': 'tokyo'
  };

  /**
   * Auto Text-Region Detector for the Vector Overlay Tool
   *
   * Finds where text probably is (via contrast/edge heuristics), attempts real OCR on each region
   * (FreeOcrClient), and returns one editable overlay item per detected region, positioned and
   * sized to match. When OCR reads a region with enough confidence, `text` is pre-filled with the
   * real recognized string; otherwise it falls back to an honest, obviously-a-placeholder string.
   * Either way the caller (vector-overlay-modal.ts) still requires human review before applying —
   * OCR can misread real text, especially on stylized poster fonts or chi_tra, so a recognized
   * string is a starting point to confirm/correct, never auto-applied as final print output.
   */
  public static async autoDetectTextLayers(imageData: ImageData): Promise<AutoDetectedTextItem[]> {
    const { width, height } = imageData;

    const regions = await this.detectTextRegions(imageData);
    if (regions.length === 0) {
      return [];
    }

    return regions.map((r) => {
      const relX = Math.round((r.x / width) * 100);
      const relY = Math.round(((r.y + r.height * 0.5) / height) * 100);
      const fontSize = Math.max(18, Math.min(64, Math.round(r.height * 0.75)));
      const detectedText = r.text.trim();
      return {
        text: detectedText.length > 0 ? detectedText : '（點此輸入文字）',
        xPercent: Math.max(5, Math.min(90, relX)),
        yPercent: Math.max(5, Math.min(95, relY)),
        fontSizePx: fontSize,
        fontFamily: 'sans-serif',
        isK100: true,
        color: '#000000',
        isOverprint: true,
        // Region-detection strength, not OCR confidence — separate signal, see ocrConfidence
        confidence: Math.min(0.95, Math.max(0.6, 0.6 + r.edgeScore * 0.1)),
        ocrConfidence: detectedText.length > 0 ? r.ocrConfidence : undefined
      };
    });
  }

  /**
   * Main entry point to inspect text in image
   *
   * 2026-08-29: `detectTextRegions()` now runs real OCR (FreeOcrClient) on each region, so the
   * typo/spelling checks below finally have real text to work with — but only for regions where
   * OCR cleared its own confidence gate (OCR_MIN_TRUSTED_CONFIDENCE); `region.text` is still ''
   * for regions OCR couldn't read confidently, and the summary below reports that split honestly
   * rather than claiming every region was checked.
   */
  public static async inspectImage(
    imageData: ImageData,
    options?: { minConfidence?: number }
  ): Promise<TextInspectionResult> {
    const startTime = performance.now();
    const minConf = options?.minConfidence ?? 0.5;

    // 1. Detect candidate text regions using edge & high-contrast bounding box clustering
    const rawRegions = await this.detectTextRegions(imageData);

    // 2. Perform OCR and spelling verification on each region
    const processedRegions: DetectedTextRegion[] = [];
    let typoCount = 0;

    for (let i = 0; i < rawRegions.length; i++) {
      const reg = rawRegions[i];
      const verified = this.verifyTextRegion(reg, i + 1);

      // Local regex typo-dictionary check if not already flagged (not a LanguageTool API call)
      if (!verified.isTypo && verified.text.length >= 3) {
        try {
          const spellCheck = await FreeSpellCheckClient.checkText(verified.text);
          if (spellCheck.hasIssues && spellCheck.matches.length > 0) {
            const firstIssue = spellCheck.matches[0];
            verified.isTypo = true;
            verified.typoReason = `印前智慧校對：${firstIssue.message}`;
            if (firstIssue.replacements.length > 0) {
              verified.suggestion = firstIssue.replacements[0];
            }
          }
        } catch {
          // Keep local verification result
        }
      }

      if (verified.confidence >= minConf) {
        processedRegions.push(verified);
        if (verified.isTypo) {
          typoCount++;
        }
      }
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    const hasIssues = typoCount > 0 || processedRegions.some(r => r.isBlurry);

    let summary = '';
    if (processedRegions.length === 0) {
      summary = '未檢測到明顯文字區塊。';
    } else {
      // Honesty note: OCR only succeeds (and the spelling/typo check only actually runs) on
      // regions that clear its own confidence gate — report the real split instead of implying
      // every region was checked.
      const blurryCount = processedRegions.filter(r => r.isBlurry).length;
      const ocrReadCount = processedRegions.filter(r => r.text.length > 0).length;
      const ocrNote = ocrReadCount === processedRegions.length
        ? '全部成功辨識文字內容'
        : ocrReadCount > 0
          ? `${ocrReadCount} 處成功辨識文字內容，其餘 OCR 信心不足，內容仍需自行輸入`
          : 'OCR 未能可靠辨識任何區塊內容，錯字仍需自行校對';
      summary = `檢測到 ${processedRegions.length} 處文字區塊${blurryCount > 0 ? `，其中 ${blurryCount} 處清晰度不足` : '，清晰度正常'}。${ocrNote}。`;
    }

    return {
      regions: processedRegions,
      totalWords: processedRegions.length,
      typoCount,
      hasIssues,
      summary,
      executionTimeMs
    };
  }

  /**
   * Finds where text probably is (locateTextRegions — synchronous pixel statistics), then attempts
   * real OCR on each candidate region. Only the OCR pass (one FreeOcrClient.recognizeRegion call
   * per candidate, sequential — the worker processes one job at a time regardless, and there are
   * at most 8 candidates) is async.
   */
  public static async detectTextRegions(
    imageData: ImageData
  ): Promise<Array<{ x: number; y: number; width: number; height: number; text: string; edgeScore: number; ocrConfidence: number }>> {
    const rawRegions = this.locateTextRegions(imageData);

    // Real OCR pass: one recognizeRegion call per candidate, against a single shared canvas.
    //
    // ⚠️ 2026-08-29 修正：這個迴圈原本沒有逾時保護——若 Tesseract worker 卡住（例如某台
    // 裝置上 WASM 初始化異常、worker 當掉但 promise 既不 resolve 也不 reject），
    // detectTextRegions() 會被永遠卡住，連帶讓呼叫它的 autoDetectTextLayers()/inspectImage()
    // （進而是「一鍵掃描文字區域」按鈕與整個文字檢查彈窗）永遠停在讀取中，沒有任何辦法恢復。
    // 這裡替每個候選區塊的 OCR 呼叫加上逾時：超時就視同「OCR 讀不出可信文字」（跟信心不足
    // 是同一種 fallback），繼續處理下一個區塊，讓整個流程的最壞情況時間有上限
    // （至多 8 個候選 × OCR_TIMEOUT_MS），而不是無限等待。
    const OCR_TIMEOUT_MS = 8000;
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
        promise.then(
          (v) => { clearTimeout(timer); resolve(v); },
          () => { clearTimeout(timer); resolve(null); }
        );
      });

    const sourceCanvas = FreeOcrClient.imageDataToCanvas(imageData);
    const regions: Array<{ x: number; y: number; width: number; height: number; text: string; edgeScore: number; ocrConfidence: number }> = [];

    for (const r of rawRegions) {
      let text = '';
      let ocrConfidence = 0;

      if (sourceCanvas) {
        const ocrResult = await withTimeout(FreeOcrClient.recognizeRegion(sourceCanvas, r), OCR_TIMEOUT_MS);
        if (ocrResult && ocrResult.text.length > 0 && ocrResult.confidence >= OCR_MIN_TRUSTED_CONFIDENCE) {
          text = ocrResult.text;
          ocrConfidence = ocrResult.confidence;
        }
      }

      regions.push({ ...r, text, ocrConfidence });
    }

    return regions;
  }

  /**
   * Text-region localization by tile classification (2026-09-24 rewrite; synchronous, no OCR).
   *
   * The previous row-projection scan returned ZERO regions for a real 1740x1172 gradient poster
   * with white bold 90px "Hello 印刷": it divided each grid row's edge-cell count by the FULL image
   * width (a line spanning a third of the width never reached its 0.08 density threshold), and it
   * compared each sample with the pixel 1 px away while samples were `step` px apart, so the
   * 1-3 px anti-aliased stroke boundaries of real type mostly fell between samples.
   *
   * 1. Luminance at a working resolution: images over LOC_MAX_WORK_PIXELS are box-averaged by an
   *    integer factor (averaging keeps thin strokes visible; point sampling skipped them).
   * 2. Stroke boundaries: 2-px central luminance difference beyond ±EDGE_DELTA, tested separately
   *    along x and along y, keeping its sign. Per 8x8 tile we count CROSSINGS — same-sign boundary
   *    runs entered by a row scan (vertical-ish boundaries) and by a column scan (horizontal-ish
   *    ones). Counting signed runs keeps a thin stroke at two crossings (dark-going, then
   *    light-going) even when its two anti-aliased sides merge into one run, which unsigned runs
   *    lost for high-contrast 10-12 px captions. A crossing count does not depend on edge blur or
   *    stroke thickness, and it tells text from its look-alikes:
   *      text             — several crossings per row AND per column (strokes in every direction)
   *      smooth gradient  — no boundaries at all
   *      long object edge — ~1 crossing per row OR per column; a rectangle corner ≤ 1 of each
   * 3. A tile is a text tile when it has boundaries and lies inside at least one window averaging
   *    ≥ MIN_CROSSINGS crossings per row and per column. Windows range from 1 to 32 tiles square
   *    (8-256 working px) because a window must be roughly glyph-sized: small type passes in small
   *    windows, big bold type (15-50 px strokes) only in large ones.
   * 4. Text tiles → 8-connected components → merged left to right into line runs (shared vertical
   *    span, gaps up to a word space) → split into lines at blank rows and refined to the full
   *    glyph height (4c). OCR needs whole letterforms: a line read at 95 % confidence at its true
   *    height read at 0 % when cropped to a slice through the middle of the glyphs (2026-08-29).
   * 5. Each line must still look like text as a whole — ≥ LINE_MIN_H crossings per row (a lone
   *    disc, ring or frame corner gives 2-4, a cluster of overlapping boxes ~4) and ≥ LINE_MIN_V
   *    per column — and be at most 40 % of the image height. Every region costs one OCR call of up
   *    to 8 s, so at most 8 lines (the most crossings) are returned, in reading order.
   *
   * Thresholds were set from the middle of the ranges that kept a synthetic benchmark
   * (tests/text-region-detection.test.ts plus sharpened / noisy / cluttered variants) free of both
   * misses and false regions: EDGE_DELTA worked from 24 to 36, MIN_CROSSINGS from 1.25 (exclusive)
   * to 2 (exclusive); LINE_MIN_H is the tightest — 4 let sharpened box clutter through, 6 lost a
   * two-glyph CJK line.
   */
  private static locateTextRegions(
    imageData: ImageData
  ): Array<{ x: number; y: number; width: number; height: number; edgeScore: number }> {
    const { width, height, data } = imageData;
    const LOC_MAX_WORK_PIXELS = 2_500_000;
    const TILE_SHIFT = 3;
    const TILE = 1 << TILE_SHIFT;
    const EDGE_DELTA = 30;
    const BACKDROP = 128;
    const CHROMA_WEIGHT = 0.5;
    const NOISE_FACTOR = 3.5;
    const NOISY_TILE_MOD = 0.3;
    const MIN_CROSSINGS = 1.5;
    const WINDOW_TILES = [1, 2, 4, 8, 16, 32];
    const LINE_GAP = 0.8;
    const LINE_MIN_H = 3.8;
    const LINE_MIN_V = 1;
    const COMPACT_ASPECT = 1.3;
    const COMPACT_MIN_H = 4.5;
    const COMPACT_MIN_V = 3;
    const TALL_MIN_H = 5;
    const REPEAT_REMAINDER_MIN = 5;
    const MIN_REPEAT_PERIOD = 5;
    const STRONG_REPEAT = 0.8;
    const MOSTLY_REPEAT = 0.7;
    const WEAK_SHARE_MAX = 0.4;
    const DENSE_MAX = 12;
    const ANISO_MIN = 10;
    const ANISO_RATIO = 5;
    const SPARSE_MAX = 2;
    const DENS_MIN = 1;
    const FRINGE_MAX_PER_COL = 1.5;
    const FRINGE_ODD_SHARE = 0.7;
    const ROUND_ALIGNED_MAX = 0.4;
    const ROUND_STROKE_MAX = 0.08;
    const ROUND_ALIGNED_COMPACT_MAX = 0.34;
    const ROUND_NEST_MIN_H = 6;
    const MAX_REGIONS = 8;

    const k = Math.max(1, Math.ceil(Math.sqrt((width * height) / LOC_MAX_WORK_PIXELS)));
    const ww = Math.floor(width / k);
    const wh = Math.floor(height / k);
    if (ww < 16 || wh < 16) return [];
    const n = ww * wh;

    // 1. Working-resolution luminance plus two opponent-colour channels (red-green, yellow-blue), each
    // composited over a mid-grey backdrop by the pixel's alpha. Colour: red text on a green or blue
    // background can differ from it by only 3-11 luminance levels while being perfectly legible.
    // Alpha: text on a transparent background (sticker preset after background removal) arrives as
    // glyph-coloured pixels next to alpha-0 pixels; compositing makes those boundaries visible for
    // light and dark text alike, and it replaces the 2026-08-28 transparency guard — whatever RGB a
    // cleared canvas left behind under alpha 0 now composites to the same grey, so it can no longer
    // register as a fake boundary. This step reads every pixel of the image, so it is the costliest
    // one on a large photo: an opaque pixel composites to itself, and a run of k opaque pixels
    // takes its colour terms from integer channel sums (exact, so the result is the same as summing
    // pixel by pixel); a run holding any translucent pixel is summed with the full formula. Steps 1
    // and the differences of step 2 run together in gradientField().
    //
    // 2. Stroke boundaries: 2-px central difference along x and along y of whichever channel changes
    // most (colour differences weighted by CHROMA_WEIGHT), beyond ±threshold; edge bit 1: along x
    // (bit 4 set when it rises), bit 2: along y (bit 8 set when it rises). The threshold is
    // EDGE_DELTA, raised where the background itself is busy. Per 8x8 tile we take the mean
    // difference magnitude and the share of "moderate" differences (8 to EDGE_DELTA — grain, gravel,
    // grass; a flat background, even between the strokes of dense small type, has almost none). A
    // tile is noisy when at least NOISY_TILE_MOD of its pixels are moderate; a 32x32 block whose
    // 3x3-block neighbourhood is at least half noisy tiles gets NOISE_FACTOR × the median mean
    // magnitude of those noisy tiles (never below EDGE_DELTA). A boundary must stand out from its
    // surroundings, so grain and grass no longer fire alongside the glyph outlines they surround.
    const BLOCK_SHIFT = 5;
    const bw = (ww >> BLOCK_SHIFT) + 1;
    const bh = (wh >> BLOCK_SHIFT) + 1;
    const tw = Math.ceil(ww / TILE);
    const th = Math.ceil(wh / TILE);
    const { gx, gy, tileMag, tileMod } = this.gradientField(data, width, k, ww, wh, TILE_SHIFT, BACKDROP, CHROMA_WEIGHT, EDGE_DELTA);
    const thr = new Float32Array(bw * bh);
    const tpb = 1 << (BLOCK_SHIFT - TILE_SHIFT); // tiles per block side
    const noisy = new Float32Array(9 * tpb * tpb);
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        let nNoisy = 0;
        let cnt = 0;
        const tx0 = Math.max(0, (bx - 1) * tpb);
        const tx1 = Math.min(tw, (bx + 2) * tpb);
        for (let ty = Math.max(0, (by - 1) * tpb); ty < Math.min(th, (by + 2) * tpb); ty++) {
          for (let tx = tx0; tx < tx1; tx++) {
            cnt++;
            if (tileMod[ty * tw + tx] >= NOISY_TILE_MOD) noisy[nNoisy++] = tileMag[ty * tw + tx];
          }
        }
        let t = EDGE_DELTA;
        if (nNoisy >= 0.5 * cnt) {
          const sorted = noisy.subarray(0, nNoisy).sort();
          t = Math.max(EDGE_DELTA, NOISE_FACTOR * sorted[nNoisy >> 1]);
        }
        thr[by * bw + bx] = t;
      }
    }
    const edge = new Uint8Array(n);
    for (let y = 1; y < wh - 1; y++) {
      const brow = (y >> BLOCK_SHIFT) * bw;
      for (let x = 1, i = y * ww + 1; x < ww - 1; x++, i++) {
        const t = thr[brow + (x >> BLOCK_SHIFT)];
        let e = 0;
        const d1 = gx[i];
        if (d1 > t) e = 1 | 4;
        else if (d1 < -t) e = 1;
        const d2 = gy[i];
        if (d2 > t) e |= 2 | 8;
        else if (d2 < -t) e |= 2;
        edge[i] = e;
      }
    }

    // Crossings (cross bit 1: a row scan enters a same-sign bit-1 run here, bit 2: a column scan
    // enters a same-sign bit-2 run), counted only where the boundary continues into the next row /
    // column: glyph outlines are continuous contours, while noise, grain and JPEG speckle fire
    // isolated pixels that would otherwise pile up into "crossings" across a wide window.
    const cross = new Uint8Array(n);
    const tileH = new Int32Array(tw * th);
    const tileV = new Int32Array(tw * th);
    for (let y = 1; y < wh - 1; y++) {
      const rowTile = (y >> TILE_SHIFT) * tw;
      for (let x = 1, i = y * ww + 1; x < ww - 1; x++, i++) {
        const e = edge[i];
        if (e === 0) continue;
        let c = 0;
        const prevX = edge[i - 1];
        const prevY = edge[i - ww];
        const startX = (prevX & 1) === 0 || ((prevX ^ e) & 4) !== 0;
        const startY = (prevY & 2) === 0 || ((prevY ^ e) & 8) !== 0;
        if ((e & 1) !== 0 && startX &&
            ((edge[i - ww - 1] | edge[i - ww] | edge[i - ww + 1] | edge[i + ww - 1] | edge[i + ww] | edge[i + ww + 1]) & 1) !== 0) {
          c = 1;
          tileH[rowTile + (x >> TILE_SHIFT)]++;
        }
        if ((e & 2) !== 0 && startY &&
            ((edge[i - 1] | edge[i + 1] | edge[i - ww - 1] | edge[i - ww + 1] | edge[i + ww - 1] | edge[i + ww + 1]) & 2) !== 0) {
          c |= 2;
          tileV[rowTile + (x >> TILE_SHIFT)]++;
        }
        cross[i] = c;
      }
    }

    // 3. Multi-scale window test over summed-area tables of the crossing counts; every passing
    // window is painted into a 2D difference array, so tile coverage costs O(1) per window.
    const sw = tw + 1;
    const satH = new Float64Array(sw * (th + 1));
    const satV = new Float64Array(sw * (th + 1));
    for (let ty = 0; ty < th; ty++) {
      let rowH = 0;
      let rowV = 0;
      for (let tx = 0; tx < tw; tx++) {
        rowH += tileH[ty * tw + tx];
        rowV += tileV[ty * tw + tx];
        satH[(ty + 1) * sw + tx + 1] = satH[ty * sw + tx + 1] + rowH;
        satV[(ty + 1) * sw + tx + 1] = satV[ty * sw + tx + 1] + rowV;
      }
    }
    const boxSum = (sat: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
      sat[y1 * sw + x1] - sat[y0 * sw + x1] - sat[y1 * sw + x0] + sat[y0 * sw + x0];

    const paint = new Int32Array(sw * (th + 1));
    let prevMw = 0;
    let prevMh = 0;
    for (const m of WINDOW_TILES) {
      const mw = Math.min(m, tw);
      const mh = Math.min(m, th);
      if (mw === prevMw && mh === prevMh) continue; // clipped to the same window as the last scale
      prevMw = mw;
      prevMh = mh;
      const stride = Math.max(1, m >> 2);
      const needH = MIN_CROSSINGS * mh * TILE; // crossings per row × rows in the window
      const needV = MIN_CROSSINGS * mw * TILE;
      const lastX = tw - mw;
      const lastY = th - mh;
      for (let ty = 0; ; ty = Math.min(ty + stride, lastY)) {
        for (let tx = 0; ; tx = Math.min(tx + stride, lastX)) {
          if (boxSum(satH, tx, ty, tx + mw, ty + mh) >= needH && boxSum(satV, tx, ty, tx + mw, ty + mh) >= needV) {
            paint[ty * sw + tx]++;
            paint[ty * sw + tx + mw]--;
            paint[(ty + mh) * sw + tx]--;
            paint[(ty + mh) * sw + tx + mw]++;
          }
          if (tx === lastX) break;
        }
        if (ty === lastY) break;
      }
    }
    for (let ty = 0; ty <= th; ty++) {
      for (let tx = 1; tx <= tw; tx++) paint[ty * sw + tx] += paint[ty * sw + tx - 1];
    }
    for (let ty = 1; ty <= th; ty++) {
      for (let tx = 0; tx <= tw; tx++) paint[ty * sw + tx] += paint[(ty - 1) * sw + tx];
    }
    const textTile = new Uint8Array(tw * th);
    for (let ty = 0; ty < th; ty++) {
      for (let tx = 0; tx < tw; tx++) {
        const t = ty * tw + tx;
        if (paint[ty * sw + tx] > 0 && tileH[t] + tileV[t] > 0) textTile[t] = 1;
      }
    }

    // 4a. 8-connected components of text tiles, as working-pixel boxes [x0, x1) × [y0, y1).
    type LineBox = { x0: number; y0: number; x1: number; y1: number; score: number };
    let lines: LineBox[] = [];
    const stack = new Int32Array(tw * th);
    for (let start = 0; start < tw * th; start++) {
      if (textTile[start] !== 1) continue;
      textTile[start] = 2;
      let sp = 0;
      stack[sp++] = start;
      let tx0 = tw, ty0 = th, tx1 = -1, ty1 = -1, tiles = 0;
      while (sp > 0) {
        const t = stack[--sp];
        const tx = t % tw;
        const ty = (t - tx) / tw;
        tiles++;
        if (tx < tx0) tx0 = tx;
        if (tx > tx1) tx1 = tx;
        if (ty < ty0) ty0 = ty;
        if (ty > ty1) ty1 = ty;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = ty + dy;
          if (ny < 0 || ny >= th) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = tx + dx;
            if (nx < 0 || nx >= tw) continue;
            const nt = ny * tw + nx;
            if (textTile[nt] === 1) {
              textTile[nt] = 2;
              stack[sp++] = nt;
            }
          }
        }
      }
      lines.push({
        x0: tx0 << TILE_SHIFT,
        y0: ty0 << TILE_SHIFT,
        x1: Math.min(ww, (tx1 + 1) << TILE_SHIFT),
        y1: Math.min(wh, (ty1 + 1) << TILE_SHIFT),
        score: tiles
      });
    }
    // A textured photo can yield thousands of specks; the line merge below is quadratic.
    if (lines.length > 300) lines = lines.sort((a, b) => b.score - a.score).slice(0, 300);

    // 4b. Merge components into line runs: enough shared vertical span, and a horizontal gap no
    // wider than a word space (~0.3-0.4 × line height; LINE_GAP leaves room for tile rounding).
    // Both are measured against the SMALLER box, so a tall non-text neighbour that got marked for
    // sitting inside a passing window (a column divider, a frame side) cannot bridge columns.
    const mergeLines = (boxes: LineBox[]): LineBox[] => {
      for (let changed = true; changed; ) {
        changed = false;
        for (let a = 0; a < boxes.length; a++) {
          const A = boxes[a];
          for (let b = a + 1; b < boxes.length; b++) {
            const B = boxes[b];
            const minH = Math.min(A.y1 - A.y0, B.y1 - B.y0);
            const overlap = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
            const gap = Math.max(A.x0, B.x0) - Math.min(A.x1, B.x1);
            if (overlap >= 0.5 * minH && gap <= LINE_GAP * minH) {
              A.x0 = Math.min(A.x0, B.x0);
              A.y0 = Math.min(A.y0, B.y0);
              A.x1 = Math.max(A.x1, B.x1);
              A.y1 = Math.max(A.y1, B.y1);
              A.score += B.score;
              boxes.splice(b, 1);
              b = a; // A grew: re-test it against everything after it
              changed = true;
            }
          }
        }
      }
      return boxes;
    };
    mergeLines(lines);

    // 4c. Split each run into text lines and refine each to its full glyph height, from the row
    // profile r(y) = boundary runs a scan of row y enters (vertical-ish boundaries only). The rows
    // around a run are cut into segments at blank rows (≥ 2 rows with no boundary at all — the
    // leading between stacked lines). In a segment, a line's CORE is a span of rows with
    // r ≥ 30 % of the segment's peak, and it is extended by up to 45 % of its height through
    // non-blank rows (ascenders, descenders, accents, the top/bottom strokes of CJK glyphs). Rows
    // crossed only by a divider, frame side or ring (r = 1-4, beside a text line's 10-40) never
    // become core, so such neighbours widen a line box by a fraction of its height at most;
    // without this a long divider next to a line stretched it past the 40 % height limit and the
    // whole line was rejected.
    const rowCross = new Int32Array(wh);
    const rowAny = new Uint8Array(wh);
    const bands: LineBox[] = [];
    for (const L of lines) {
      const reach = Math.max(TILE, Math.round((L.y1 - L.y0) * 0.5));
      const s0 = Math.max(1, L.y0 - reach);
      const s1 = Math.min(wh - 1, L.y1 + reach);
      for (let y = s0; y < s1; y++) {
        let c = 0;
        let any = 0;
        for (let i = y * ww + L.x0, end = y * ww + L.x1; i < end; i++) {
          if (edge[i] !== 0) {
            any = 1;
            c += cross[i] & 1;
          }
        }
        rowCross[y] = c;
        rowAny[y] = any;
      }

      for (let y = s0; y < s1; ) {
        while (y < s1 && rowAny[y] === 0) y++;
        if (y >= s1) break;
        const segStart = y;
        let segEnd = y + 1;
        for (let blank = 0; y < s1; y++) {
          if (rowAny[y] === 1) {
            segEnd = y + 1;
            blank = 0;
          } else if (++blank >= 2) break;
        }
        if (segEnd <= L.y0 || segStart >= L.y1) continue; // a neighbouring line's rows

        let peak = 0;
        for (let r = segStart; r < segEnd; r++) if (rowCross[r] > peak) peak = rowCross[r];
        const strong = Math.max(2, 0.3 * peak);
        let coreStart = -1;
        let coreEnd = -1;
        const emitCore = () => {
          const ext = Math.max(2, Math.round((coreEnd - coreStart) * 0.45));
          let top = Math.max(segStart, coreStart - ext);
          let bottom = Math.min(segEnd, coreEnd + ext);
          while (top < coreStart && rowAny[top] === 0) top++;
          while (bottom > coreEnd && rowAny[bottom - 1] === 0) bottom--;
          if (coreEnd > L.y0 && coreStart < L.y1) bands.push({ x0: L.x0, y0: top, x1: L.x1, y1: bottom, score: 0 });
        };
        for (let r = segStart; r < segEnd; r++) {
          if (rowCross[r] < strong) continue;
          if (coreStart >= 0 && r - coreEnd > Math.max(4, 0.35 * (coreEnd - coreStart))) {
            emitCore();
            coreStart = -1;
          }
          if (coreStart < 0) coreStart = r;
          coreEnd = r + 1;
        }
        if (coreStart >= 0) emitCore();
      }
    }

    // 5. Validate each line as a whole. Horizontal extent = first/last column holding a
    // vertical-ish boundary (a glyph's side), so a rule or underline running past the text is cut
    // back to the text. Compact blobs (narrower than COMPACT_ASPECT × height — a single glyph, a
    // ring, a round badge outline) need more evidence than a line of several glyphs: a ring gives
    // ~3.5 crossings per row and per column, a real multi-stroke CJK glyph clearly more.
    const colHasSide = (x: number, y0: number, y1: number) => {
      for (let i = y0 * ww + x, end = y1 * ww + x; i < end; i += ww) if ((edge[i] & 1) !== 0) return true;
      return false;
    };
    // A line may be up to 40 % of the image height, or up to 75 % when it is at least twice as wide
    // as it is tall: banners, signs and wordmarks are single lines whose type fills half the height.
    const heightOk = (w: number, h: number) => h <= wh * 0.4 || (h <= wh * 0.75 && w >= 2 * h);
    // Crossings a line must show per row / per column. A block narrower than COMPACT_ASPECT × its
    // height is one or two glyphs (or a lone shape) and needs more; a band taller than 40 % of the
    // image (a banner line, see heightOk) is large type and must look like it.
    const crossingsOk = (pr: number, pc: number, w: number, h: number) => {
      const compactBox = w < COMPACT_ASPECT * h;
      const minRow = h > wh * 0.4 ? TALL_MIN_H : compactBox ? COMPACT_MIN_H : LINE_MIN_H;
      return pr >= minRow && pc >= (compactBox ? COMPACT_MIN_V : LINE_MIN_V);
    };
    const countCross = (l: number, r: number, t: number, b: number) => {
      let ch = 0;
      let cv = 0;
      for (let y = t; y < b; y++) {
        for (let i = y * ww + l, end = y * ww + r; i < end; i++) {
          const c = cross[i];
          if (c !== 0) {
            ch += c & 1;
            cv += c >> 1;
          }
        }
      }
      return [ch, cv];
    };
    const accepted: LineBox[] = [];
    for (const band of bands) {
      const top = band.y0;
      const bottom = band.y1;
      // First grow sideways to glyphs whose own tiles were not marked (typically the first or last
      // letter of a small line): at most ~half a glyph out, through letter-gap-sized blank columns.
      const reachX = Math.max(TILE, Math.round((bottom - top) * 0.6));
      const gapX = Math.max(2, Math.round((bottom - top) * 0.35));
      let left = band.x0;
      for (let x = band.x0 - 1, gapRun = 0; x >= Math.max(1, band.x0 - reachX); x--) {
        if (colHasSide(x, top, bottom)) {
          left = x;
          gapRun = 0;
        } else if (++gapRun > gapX) break;
      }
      let right = band.x1;
      for (let x = band.x1, gapRun = 0; x < Math.min(ww - 1, band.x1 + reachX); x++) {
        if (colHasSide(x, top, bottom)) {
          right = x + 1;
          gapRun = 0;
        } else if (++gapRun > gapX) break;
      }
      while (left < right && !colHasSide(left, top, bottom)) left++;
      while (right > left && !colHasSide(right - 1, top, bottom)) right--;
      let lineW = right - left;
      const lineH = bottom - top;
      if (lineW < 8 || lineH < 5 || !heightOk(lineW, lineH)) continue;

      let [crossH, crossV] = countCross(left, right, top, bottom);
      let perRow = crossH / lineH;
      let perCol = crossV / lineW;
      let compact = lineW < COMPACT_ASPECT * lineH;
      if (!crossingsOk(perRow, perCol, lineW, lineH)) continue;

      // 5a. Repeating patterns — polka dots, tiles, bricks, window grids, fences, dashed borders,
      // halftone, stripes. Every row of such a band repeats at a fixed pitch; no line of text does
      // (its glyphs differ). The pitch is searched in the band's rows widened by a margin on both
      // sides, because a band can hold too few repeats of its own (a run of 2-3 dots) to show it.
      // A band whose crossings mostly repeat and whose non-repeating remainder is too sparse to be a
      // line is dropped — also at a weaker repeat rate when at least MOSTLY_REPEAT of its crossings
      // repeat (a row of round icons: the outlines repeat, the differing inner symbols do not); when
      // the remainder is a line lying on the pattern (a title across a brick wall), the band is cut
      // back to it. Repeats finer than MIN_REPEAT_PERIOD (2-3 px, a dither)
      // are not judged: that is below the scale of any glyph structure these statistics describe,
      // and the dither-band fixtures in tests/text-inspector.test.ts stand in for text.
      const ctx = Math.max(3 * lineW, 12 * lineH);
      const rep = this.horizontalRepeat(cross, edge, ww, Math.max(1, left - ctx), Math.min(ww - 1, right + ctx), left, right, top, bottom);
      const fineRepeat = rep.period > 0 && rep.period < MIN_REPEAT_PERIOD && rep.maxScore >= STRONG_REPEAT;
      if (rep.period >= MIN_REPEAT_PERIOD && rep.maxScore >= 0.5) {
        const remainderDens = (rep.apPerRow * lineH) / Math.max(1, rep.ax1 - rep.ax0);
        if (rep.maxScore >= STRONG_REPEAT && rep.share >= 0.5 && (rep.apPerRow < REPEAT_REMAINDER_MIN || remainderDens < SPARSE_MAX)) continue;
        if (rep.share >= MOSTLY_REPEAT && rep.apPerRow < REPEAT_REMAINDER_MIN) continue;
        const margin = Math.round(0.5 * lineH);
        const nl = Math.max(left, left + rep.ax0 - margin);
        const nr = Math.min(right, left + rep.ax1 + margin);
        if (rep.share >= 0.2 && nr - nl < 0.85 * lineW) {
          left = nl;
          right = nr;
          while (left < right && !colHasSide(left, top, bottom)) left++;
          while (right > left && !colHasSide(right - 1, top, bottom)) right--;
          lineW = right - left;
          if (lineW < 8 || !heightOk(lineW, lineH)) continue;
          [crossH, crossV] = countCross(left, right, top, bottom);
          perRow = crossH / lineH;
          perCol = crossV / lineW;
          compact = lineW < COMPACT_ASPECT * lineH;
          if (!crossingsOk(perRow, perCol, lineW, lineH)) continue;
        }
      }

      // 5b. Random textures. One line of text crosses a bounded number of boundaries per column
      // (its glyphs' horizontal strokes) and, per row, a number proportional to its width in
      // line-heights (densH, ~2-8 in the benchmark). A band of foliage, gravel or a QR code is
      // many small elements stacked inside one "line": both counts grow far past that. Grass and
      // fences are the anisotropic case — many near-vertical blades per row, few boundaries per
      // column. Kept loose on purpose: dense Traditional Chinese (藝, 鬱, 覽) runs high on both.
      if (!fineRepeat) {
        const densH = (perRow * lineH) / lineW;
        if (Math.min(densH, perCol) > DENSE_MAX || (densH > ANISO_MIN && densH > ANISO_RATIO * perCol)) continue;
        // The other end: a line of glyphs packs at least ~2 boundaries per row for each line height
        // of width and ~2 per column (glyph tops and bottoms). Fewer on both counts is a scatter of
        // large blobs — bokeh, big dots, a few leaves — not a line of type.
        if ((densH < SPARSE_MAX && perCol < SPARSE_MAX) || densH < DENS_MIN) continue;
        // A fringe: blades of grass, pickets or hair poking up into a flat area cross the band's
        // edge, so most columns see an odd number of boundaries (in at the tip, never out), and few
        // horizontal ones. Glyphs are enclosed in their line: they are entered and left again.
        if (perCol < FRINGE_MAX_PER_COL && top > 1 && bottom < wh - 1) {
          let withAny = 0;
          let odd = 0;
          for (let x = left; x < right; x++) {
            let c = 0;
            for (let i = top * ww + x, end = bottom * ww + x; i < end; i += ww) c += (cross[i] >> 1) & 1;
            if (c > 0) {
              withAny++;
              odd += c & 1;
            }
          }
          if (odd > FRINGE_ODD_SHARE * withAny) continue;
        }
        // A QR code (or any module grid) is a block whose boundaries all sit on a regular grid of
        // columns AND rows; glyph strokes do not. (Blocks only: a long line in a pixel font would.)
        if (lineW <= 3 * lineH && this.onModuleGrid(cross, ww, left, right, top, bottom)) continue;
        // Round outlines: rings and bubbles, a bullseye, confetti, the creases of folded petals or
        // drapery, a treeline. Glyphs are built from stems and bars, so over a third of a line's
        // boundary pixels run within ~11° of horizontal or vertical (the lowest in the benchmark is
        // "50%", 0.33; Latin 0.35-0.8, CJK 0.6-0.9), while a curve spreads its boundary over every
        // direction (a circle: 0.24). That alone would also catch round type ("808"), so the band
        // must also have thin strokes for its height — a ring's outline, a crease, a twig (even
        // hairline display type measured 0.038 of its line height, regular type ≥ 0.1) — or be a
        // compact block crossed more often per row than any single round glyph (O, 0, 8: ~4).
        const aligned = this.axisAlignedShare(edge, gx, gy, ww, left, right, top, bottom);
        if (aligned < ROUND_ALIGNED_MAX &&
            (this.strokeWidth(cross, edge, ww, left, right, top, bottom) < ROUND_STROKE_MAX * lineH ||
             (compact && aligned < ROUND_ALIGNED_COMPACT_MAX && perRow >= ROUND_NEST_MIN_H))) continue;
      }

      // 5c. Contrast against the busiest neighbour. The noise-raised threshold of step 2 has a
      // spatial reach of ~one block, so the first rows of a grass strip or a leafy canopy, next to
      // flat sky, are judged at the flat threshold and turn into a false "line" along the horizon.
      // Re-count the band's row crossings at the highest threshold found within one line height
      // above or below it: text keeps most of its boundaries (glyph outlines are high contrast);
      // a strip that only exists at the lower threshold does not.
      let strict = 0;
      for (let by = Math.max(0, (top - lineH) >> BLOCK_SHIFT); by <= Math.min(bh - 1, (bottom + lineH) >> BLOCK_SHIFT); by++) {
        for (let bx = left >> BLOCK_SHIFT; bx <= (right - 1) >> BLOCK_SHIFT; bx++) strict = Math.max(strict, thr[by * bw + bx]);
      }
      if (strict > EDGE_DELTA) {
        let base = 0;
        let strong = 0;
        const nRows = Math.min(lineH, 24);
        for (let r = 0; r < nRows; r++) {
          const y = top + Math.floor(((r + 0.5) * lineH) / nRows);
          if (y < 1 || y >= wh - 1) continue;
          const brow = (y >> BLOCK_SHIFT) * bw;
          let prevB = 0;
          let prevS = 0;
          for (let x = Math.max(1, left), i = y * ww + x; x < Math.min(ww - 1, right); x++, i++) {
            const d = gx[i];
            const t = thr[brow + (x >> BLOCK_SHIFT)];
            const eb = d > t ? 1 : d < -t ? -1 : 0;
            const es = d > strict ? 1 : d < -strict ? -1 : 0;
            if (eb !== 0 && eb !== prevB) base++;
            if (es !== 0 && es !== prevS) strong++;
            prevB = eb;
            prevS = es;
          }
        }
        if (strong < WEAK_SHARE_MAX * base) continue;
      }

      // 5d. A band taller than 40 % of the image is only kept as a single line of large type
      // (heightOk): its strokes must then be large too. Three UI cards drawn with 2 px outlines give
      // as many crossings per row as three big glyphs, but a stroke 1/200 of the line height is no
      // glyph stroke (even a hairline display face runs ~1/50).
      if (lineH > wh * 0.4 && this.strokeWidth(cross, edge, ww, left, right, top, bottom) < 0.012 * lineH) continue;
      accepted.push({ x0: left, y0: top, x1: right, y1: bottom, score: crossH + crossV });
    }

    // Keep at most MAX_REGIONS lines (overlapping duplicates from neighbouring runs merged first),
    // preferring the biggest type: a headline is what most needs checking, and a long run of small
    // body lines used to push it out. Report them in reading order, in full-resolution pixels with a
    // small margin (Tesseract reads noticeably worse when glyphs touch the crop edge). The height
    // limit is re-checked after that merge: two lines that each passed it can merge into a box that
    // no longer does.
    return mergeLines(accepted)
      .filter((L) => heightOk(L.x1 - L.x0, L.y1 - L.y0))
      .sort((a, b) => b.y1 - b.y0 - (a.y1 - a.y0) || b.score - a.score)
      .slice(0, MAX_REGIONS)
      .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
      .map((L) => {
        const x0 = L.x0 * k;
        const y0 = L.y0 * k;
        const x1 = Math.min(width, L.x1 * k);
        const y1 = Math.min(height, L.y1 * k);
        const pad = Math.max(2, Math.round((y1 - y0) * 0.1));
        const x = Math.max(0, x0 - pad);
        const y = Math.max(0, y0 - pad);
        const w = Math.min(width, x1 + pad) - x;
        const h = Math.min(height, y1 + pad) - y;
        return { x, y, width: w, height: h, edgeScore: this.hardEdgeDensity(imageData, x, y, w, h) };
      });
  }

  /**
   * Steps 1 and 2a of locateTextRegions (see there): working-resolution luminance and opponent
   * colours, then signed 2-px central differences along x (gx) and y (gy) of whichever channel
   * changes most, and per 2^tileShift tile the mean difference magnitude (tileMag) and the share of
   * moderate differences, 8 to moderateMax (tileMod). The channels are streamed through a ring of
   * three working rows, which is all the central differences need, instead of being held for the
   * whole image.
   */
  private static gradientField(
    data: Uint8ClampedArray, width: number, k: number, ww: number, wh: number,
    tileShift: number, backdrop: number, chromaWeight: number, moderateMax: number
  ): { gx: Int16Array; gy: Int16Array; tileMag: Float32Array; tileMod: Float32Array } {
    const tile = 1 << tileShift;
    const tw = Math.ceil(ww / tile);
    const th = Math.ceil(wh / tile);
    const gx = new Int16Array(ww * wh);
    const gy = new Int16Array(ww * wh);
    const tileMag = new Float32Array(tw * th);
    const tileMod = new Float32Array(tw * th);
    // Working row yo of each channel lives at offset (yo % 3) × ww.
    const lum = new Float32Array(3 * ww);
    const chA = new Float32Array(3 * ww);
    const chB = new Float32Array(3 * ww);
    const inv = 1 / (k * k);
    for (let yo = 0; yo < wh; yo++) {
      const o = (yo % 3) * ww;
      lum.fill(0, o, o + ww);
      chA.fill(0, o, o + ww);
      chB.fill(0, o, o + ww);
      for (let y = yo * k; y < (yo + 1) * k; y++) {
        let p = y * width * 4;
        for (let x = o; x < o + ww; x++) {
          const p0 = p;
          let sL = 0;
          let sR = 0;
          let sG = 0;
          let sBl = 0;
          let alpha = 255;
          for (let j = 0; j < k; j++, p += 4) {
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            alpha &= data[p + 3];
            sL += 0.299 * r + 0.587 * g + 0.114 * b;
            sR += r;
            sG += g;
            sBl += b;
          }
          let sA = sR - sG;
          let sB = (sR + sG) * 0.5 - sBl;
          if (alpha !== 255) {
            sL = 0;
            sA = 0;
            sB = 0;
            for (let j = 0, q = p0; j < k; j++, q += 4) {
              const a = data[q + 3] * (1 / 255);
              const r = data[q];
              const g = data[q + 1];
              const b = data[q + 2];
              sL += a * (0.299 * r + 0.587 * g + 0.114 * b) + (1 - a) * backdrop;
              sA += a * (r - g);
              sB += a * ((r + g) * 0.5 - b);
            }
          }
          lum[x] += sL;
          chA[x] += sA;
          chB[x] += sB;
        }
      }
      if (k > 1) {
        for (let x = o; x < o + ww; x++) {
          lum[x] *= inv;
          chA[x] *= inv;
          chB[x] *= inv;
        }
      }
      // Row yo completes the neighbourhood of row yc = yo - 1.
      const yc = yo - 1;
      if (yc < 1) continue;
      const mid = (yc % 3) * ww;
      const up = ((yc + 2) % 3) * ww;
      const trow = (yc >> tileShift) * tw;
      for (let x = 1, i = yc * ww + 1; x < ww - 1; x++, i++) {
        const c0 = mid + x;
        let d = lum[c0 + 1] - lum[c0 - 1];
        let c = chromaWeight * (chA[c0 + 1] - chA[c0 - 1]);
        if (Math.abs(c) > Math.abs(d)) d = c;
        c = chromaWeight * (chB[c0 + 1] - chB[c0 - 1]);
        if (Math.abs(c) > Math.abs(d)) d = c;
        const d1 = Math.round(d);
        d = lum[o + x] - lum[up + x];
        c = chromaWeight * (chA[o + x] - chA[up + x]);
        if (Math.abs(c) > Math.abs(d)) d = c;
        c = chromaWeight * (chB[o + x] - chB[up + x]);
        if (Math.abs(c) > Math.abs(d)) d = c;
        const d2 = Math.round(d);
        gx[i] = d1;
        gy[i] = d2;
        const m = Math.max(Math.abs(d1), Math.abs(d2));
        const t = trow + (x >> tileShift);
        tileMag[t] += m;
        if (m >= 8 && m < moderateMax) tileMod[t]++;
      }
    }
    for (let t = 0; t < tw * th; t++) {
      tileMag[t] /= tile * tile;
      tileMod[t] /= tile * tile;
    }
    return { gx, gy, tileMag, tileMod };
  }

  /**
   * Horizontal repetition of a line box [bx0, bx1) × [y0, y1), searched within the wider window
   * [x0, x1) of the same rows. Up to 32 rows are sampled; a row-scan crossing at x "repeats" at lag L
   * when the same row has a crossing of the same sign (dark-going / light-going) near x + L — within
   * ±1 px, widened by a pixel per 96 px of lag up to ±4, because a large motif (hand-drawn,
   * AI-generated, or redrawn by a resampler) lands a pixel or two either way from one repeat to the
   * next. Lags are stepped no coarser than that tolerance. The period is the smallest lag whose repeat
   * rate is within 15 % of the best one (a pattern is judged by its fundamental, not by a multiple
   * of it), refined to the score-weighted mean of the high-scoring lags around it (an upscaled
   * pattern repeats every 34.08 or 68.16 px); maxScore is that best rate. With a period, each
   * crossing inside the box is classified: it belongs to the repeating structure when it has partners
   * one period away on both sides, or one and two periods away on one side (the first / last element
   * of a run). Returns the share of the box's crossings that repeat, the non-repeating ones per
   * sampled row, and their x-extent relative to bx0 (2nd-98th percentile).
   */
  private static horizontalRepeat(
    cross: Uint8Array, edge: Uint8Array, ww: number, x0: number, x1: number, bx0: number, bx1: number, y0: number, y1: number
  ): { period: number; maxScore: number; share: number; apPerRow: number; ax0: number; ax1: number; events: number } {
    const MAX_EXTRA = 3;
    const W = x1 - x0;
    const H = y1 - y0;
    const none = { period: 0, maxScore: 0, share: 0, apPerRow: 0, ax0: 0, ax1: bx1 - bx0, events: 0 };
    const nRows = Math.min(H, 32);
    if (W < 16 || nRows < 1) return none;
    const evX: number[] = [];
    const evS: number[] = [];
    const rowOff = new Int32Array(nRows + 1);
    for (let r = 0; r < nRows; r++) {
      const y = y0 + Math.floor(((r + 0.5) * H) / nRows);
      for (let x = x0, i = y * ww + x0; x < x1; x++, i++) {
        if ((cross[i] & 1) !== 0) {
          evX.push(x - x0);
          evS.push((edge[i] >> 2) & 1);
        }
      }
      rowOff[r + 1] = evX.length;
    }
    const nEv = evX.length;
    const Lmax = Math.min(Math.floor(W / 2), Math.max(6 * H, 3 * (bx1 - bx0)));
    if (nEv < 8 || Lmax < 2) return { ...none, events: nEv };

    const LEVELS = MAX_EXTRA + 1;
    const tol = (L: number) => Math.min(MAX_EXTRA, Math.floor(L / 96));
    // occ[(sign × LEVELS + k) × W + x] = 1 when the current row has a crossing of that sign within
    // ±(1 + k) px of x; nOcc[sign × LEVELS + k] counts those x.
    const occ = new Uint8Array(2 * LEVELS * W);
    const nOcc = new Int32Array(2 * LEVELS);
    const mark = (r: number, v: number) => {
      for (let e = rowOff[r]; e < rowOff[r + 1]; e++) {
        const x = evX[e];
        for (let k = 0, lv = evS[e] * LEVELS; k <= MAX_EXTRA; k++, lv++) {
          for (let u = lv * W + Math.max(0, x - 1 - k), end = lv * W + Math.min(W - 1, x + 1 + k); u <= end; u++) {
            nOcc[lv] += v - occ[u];
            occ[u] = v;
          }
        }
      }
    };
    const at = (lv: number, t: number) => (t >= 0 && t < W ? occ[lv * W + t] : 0);
    // Chance level: the share of the row a mark covers — how often a lag "matches" by accident. Dense
    // small type covers a lot of its row, so its raw repeat rate is high at every lag; each lag's
    // rate is judged against chance instead: (hits − expected) / (checks − expected).
    const cover = new Float64Array(2 * LEVELS);

    // Repeat rate per lag, over the box's own crossings (their partners may lie in the margins). This
    // is the costliest loop of the validation (crossings × lags), hence the flat arrays.
    const bl = bx0 - x0;
    const br = bx1 - x0;
    const lags: number[] = [];
    for (let L = 2; L <= Lmax; L += 1 + tol(L)) lags.push(L);
    const nLags = lags.length;
    const lagL = Int32Array.from(lags);
    const lagOcc = Int32Array.from(lags, (L) => tol(L) * W); // offset of the lag's tolerance level in occ
    const lagLv = Int32Array.from(lags, tol);
    // firstLag[v] = index of the first lag ≥ v. A crossing at x is checked against x + L while that
    // lies in the window, then against x − L while that does, so its lags form two index ranges.
    const firstLag = new Int32Array(W + 2);
    for (let v = 0, j = 0; v <= W + 1; v++) {
      while (j < nLags && lagL[j] < v) j++;
      firstLag[v] = j;
    }
    const num = new Int32Array(nLags);
    const denStep = new Int32Array(nLags + 1); // checks per lag, as steps: den[j] = Σ denStep[0..j]
    const chance = new Float64Array(nLags);
    let nBox = 0;
    for (let r = 0; r < nRows; r++) {
      mark(r, 1);
      for (let lv = 0; lv < 2 * LEVELS; lv++) cover[lv] = nOcc[lv] / W;
      for (let e = rowOff[r]; e < rowOff[r + 1]; e++) {
        const x = evX[e];
        if (x < bl || x >= br) continue;
        nBox++;
        const sLv = evS[e] * LEVELS;
        const sOcc = sLv * W + x;
        const jFwd = firstLag[W - x];
        const jEnd = Math.max(jFwd, firstLag[x + 1]);
        denStep[0]++;
        denStep[jEnd]--;
        for (let j = 0; j < jFwd; j++) {
          num[j] += occ[sOcc + lagOcc[j] + lagL[j]];
          chance[j] += cover[sLv + lagLv[j]];
        }
        for (let j = jFwd; j < jEnd; j++) {
          num[j] += occ[sOcc + lagOcc[j] - lagL[j]];
          chance[j] += cover[sLv + lagLv[j]];
        }
      }
      mark(r, 0);
    }
    const den = new Int32Array(nLags);
    for (let j = 0, run = 0; j < nLags; j++) den[j] = run += denStep[j];
    let maxScore = 0;
    const score = new Float64Array(lags.length);
    for (let j = 0; j < lags.length; j++) {
      if (den[j] >= Math.max(8, 0.3 * nBox) && den[j] - chance[j] > 0) score[j] = Math.max(0, (num[j] - chance[j]) / (den[j] - chance[j]));
      if (score[j] > maxScore) maxScore = score[j];
    }
    let first = -1;
    for (let j = 0; j < lags.length && first < 0; j++) if (score[j] >= 0.85 * maxScore && score[j] > 0) first = j;
    if (first < 0) return { ...none, maxScore, events: nBox };
    let sw = 0;
    let swl = 0;
    for (let j = first; j < lags.length && lags[j] <= lags[first] + 2 * (1 + tol(lags[first])) && score[j] >= 0.85 * maxScore; j++) {
      sw += score[j];
      swl += score[j] * lags[j];
    }
    const pitch = swl / sw;
    const p1 = Math.round(pitch);
    const p2 = Math.round(2 * pitch);
    const t1 = tol(p1);
    const t2 = Math.min(MAX_EXTRA, tol(p2) + 1);

    let periodic = 0;
    const apX: number[] = [];
    for (let r = 0; r < nRows; r++) {
      mark(r, 1);
      for (let e = rowOff[r]; e < rowOff[r + 1]; e++) {
        const x = evX[e];
        if (x < bl || x >= br) continue;
        const sLv = evS[e] * LEVELS;
        const before = at(sLv + t1, x - p1);
        const after = at(sLv + t1, x + p1);
        if ((before && after) || (before && at(sLv + t2, x - p2)) || (after && at(sLv + t2, x + p2))) periodic++;
        else apX.push(x - bl);
      }
      mark(r, 0);
    }
    apX.sort((a, b) => a - b);
    const q = (f: number) => apX[Math.min(apX.length - 1, Math.max(0, Math.round(f * (apX.length - 1))))];
    return {
      period: p1,
      maxScore,
      share: nBox > 0 ? periodic / nBox : 0,
      apPerRow: apX.length / nRows,
      ax0: apX.length ? q(0.02) : 0,
      ax1: apX.length ? q(0.98) + 1 : 0,
      events: nBox
    };
  }

  /**
   * Typical stroke width in a box: along up to 32 sampled rows, the run from a dark-going row
   * crossing to the next light-going one is a dark run, the reverse a light run; for text, one of
   * the two sets is the strokes. Returns the smaller of the two medians (Infinity without runs).
   */
  private static strokeWidth(cross: Uint8Array, edge: Uint8Array, ww: number, x0: number, x1: number, y0: number, y1: number): number {
    const runs: [number[], number[]] = [[], []];
    const H = y1 - y0;
    const nRows = Math.min(H, 32);
    for (let r = 0; r < nRows; r++) {
      const y = y0 + Math.floor(((r + 0.5) * H) / nRows);
      let last = -1;
      let lastSign = 0;
      for (let x = x0, i = y * ww + x0; x < x1; x++, i++) {
        if ((cross[i] & 1) === 0) continue;
        const sign = (edge[i] >> 2) & 1;
        if (last >= 0 && sign !== lastSign) runs[lastSign].push(x - last);
        last = x;
        lastSign = sign;
      }
    }
    const median = (a: number[]) => {
      if (a.length === 0) return Infinity;
      a.sort((p, q) => p - q);
      return a[a.length >> 1];
    };
    return Math.min(median(runs[0]), median(runs[1]));
  }

  /**
   * Share of a box's boundary pixels whose luminance/colour gradient points within ~11° of the x or
   * the y axis (the smaller of |Δx|, |Δy| at most a fifth of the larger): the boundary of a stem, a
   * bar or a box side. A circle's outline, whose direction turns evenly, gives ~0.24.
   */
  private static axisAlignedShare(
    edge: Uint8Array, gx: Int16Array, gy: Int16Array, ww: number, x0: number, x1: number, y0: number, y1: number
  ): number {
    let all = 0;
    let aligned = 0;
    for (let y = y0; y < y1; y++) {
      for (let i = y * ww + x0, end = y * ww + x1; i < end; i++) {
        if (edge[i] === 0) continue;
        all++;
        const ax = Math.abs(gx[i]);
        const ay = Math.abs(gy[i]);
        if ((ax < ay ? ax : ay) * 5 <= (ax < ay ? ay : ax)) aligned++;
      }
    }
    return all > 0 ? aligned / all : 1;
  }

  /**
   * True when a compact block's boundaries all sit on one regular grid, as a QR code's module edges
   * do: both the row-scan crossings' x positions and the column-scan crossings' y positions fall,
   * ≥ 90 %, within ±1.5 px of a comb of some pitch ≥ 5 px, and that comb has crossings on most of
   * its teeth (a glyph with a handful of stroke positions can fit a comb by chance, but it cannot
   * fill 60 % of the teeth across the block).
   */
  private static onModuleGrid(cross: Uint8Array, ww: number, x0: number, x1: number, y0: number, y1: number): boolean {
    // Crossings per position (x of the row-scan ones, y of the column-scan ones): each pitch tried
    // then costs one pass over the box's width or height, not over its crossings.
    const xs = new Int32Array(x1 - x0);
    const ys = new Int32Array(y1 - y0);
    for (let y = y0; y < y1; y++) {
      for (let x = x0, i = y * ww + x0; x < x1; x++, i++) {
        const c = cross[i];
        if ((c & 1) !== 0) xs[x - x0]++;
        if ((c & 2) !== 0) ys[y - y0]++;
      }
    }
    const fits = (hist: Int32Array) => {
      const span = hist.length;
      let total = 0;
      for (let v = 0; v < span; v++) total += hist[v];
      if (total < 40) return false;
      const bins = new Int32Array(Math.ceil(span / 6) + 2);
      for (let p = 5; p <= span / 6; p += 0.25) {
        const nb = Math.ceil(p);
        bins.fill(0, 0, nb);
        for (let v = 0; v < span; v++) if (hist[v] !== 0) bins[Math.floor(v % p)] += hist[v];
        let best = 0;
        let phase = 0;
        for (let b = 0; b < nb; b++) {
          const s = bins[b] + bins[(b + 1) % nb] + bins[(b + 2) % nb];
          if (s > best) {
            best = s;
            phase = b + 1;
          }
        }
        if (best < 0.9 * total) continue;
        const teeth = new Set<number>();
        for (let v = 0; v < span; v++) {
          if (hist[v] === 0) continue;
          const t = Math.round((v - phase) / p);
          if (Math.abs(v - phase - t * p) <= 1.5) teeth.add(t);
        }
        if (teeth.size >= 0.6 * (span / p)) return true;
      }
      return false;
    };
    return fits(xs) && fits(ys);
  }

  /**
   * `edgeScore` of a located region, read by verifyTextRegion() as a blur flag (edgeScore < 0.15):
   * the share of (sampled) opaque pixels in the box whose 1-px luminance gradient |Δx| + |Δy|
   * exceeds 38 — the quantity the old grid scan reported — measured as if the box were at most
   * EDGE_SCORE_REF_HEIGHT px tall. A crisp stroke boundary is 1-2 px wide at any type size, so a
   * crisp line has a roughly constant number of hard-edge pixels per column while its box grows
   * with the type: the raw share read 0.094 for the crisp 1740x1172 "Hello 印刷" headline and 0.025
   * for a crisp 360 px line on a 6000x4000 image, flagging both 模糊. Boxes up to
   * EDGE_SCORE_REF_HEIGHT px tall (small type) keep the raw share unchanged.
   */
  private static hardEdgeDensity(imageData: ImageData, x: number, y: number, w: number, h: number): number {
    const EDGE_SCORE_REF_HEIGHT = 32;
    const { width, height, data } = imageData;
    const stride = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));
    const xEnd = Math.min(width - 1, x + w);
    const yEnd = Math.min(height - 1, y + h);
    let samples = 0;
    let hits = 0;
    for (let py = y; py < yEnd; py += stride) {
      for (let px = x; px < xEnd; px += stride) {
        const i = (py * width + px) * 4;
        const iRight = i + 4;
        const iDown = i + width * 4;
        if (data[i + 3] < 50 || data[iRight + 3] < 50 || data[iDown + 3] < 50) continue;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const lumRight = 0.299 * data[iRight] + 0.587 * data[iRight + 1] + 0.114 * data[iRight + 2];
        const lumDown = 0.299 * data[iDown] + 0.587 * data[iDown + 1] + 0.114 * data[iDown + 2];
        samples++;
        if (Math.abs(lum - lumRight) + Math.abs(lum - lumDown) > 38) hits++;
      }
    }
    return samples > 0 ? Math.min(1, (hits / samples) * Math.max(1, h / EDGE_SCORE_REF_HEIGHT)) : 0;
  }

  /**
   * Verifies text token spelling and checks for AI hallucinations/gibberish
   */
  public static verifyTextRegion(
    region: { x: number; y: number; width: number; height: number; text: string; edgeScore: number },
    index: number
  ): DetectedTextRegion {
    const rawText = region.text.trim();
    const words = rawText.split(/\s+/);
    let isTypo = false;
    let typoReason = '';
    let suggestion = '';

    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length < 2) continue;

      // 1. Direct typo dictionary check
      if (this.COMMON_TYPOS[clean]) {
        isTypo = true;
        typoReason = `疑似英文拼寫錯誤：「${word}」`;
        suggestion = rawText.replace(new RegExp(word, 'i'), this.capitalizeMatch(word, this.COMMON_TYPOS[clean]));
        break;
      }

      // 2. AI Gibberish / Hallucination Detection
      const gibberishCheck = this.detectAiGibberish(clean, word);
      if (gibberishCheck.isGibberish) {
        isTypo = true;
        typoReason = gibberishCheck.reason;
        suggestion = gibberishCheck.suggestion || this.findClosestDictionaryWord(clean) || '';
        break;
      }

      // 3. Levenshtein fuzzy distance matching against common vocabulary
      if (!this.COMMON_DICTIONARY.has(clean) && clean.length >= 4) {
        const closest = this.findClosestDictionaryWord(clean);
        if (closest && this.levenshteinDistance(clean, closest) <= (clean.length >= 7 ? 2 : 1)) {
          isTypo = true;
          typoReason = `疑似拼寫錯誤（距離為 1）：『${word}』可能應為『${closest}』`;
          suggestion = rawText.replace(new RegExp(word, 'i'), this.capitalizeMatch(word, closest));
          break;
        }
      }
    }

    const isBlurry = region.edgeScore < 0.15;
    const confidence = Math.min(0.99, Math.max(0.65, 0.75 + region.edgeScore * 0.2));

    return {
      id: `text-region-${index}-${Math.round(region.x)}-${Math.round(region.y)}`,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      text: rawText,
      confidence,
      isTypo,
      typoReason: typoReason || undefined,
      suggestion: suggestion || undefined,
      isBlurry
    };
  }

  /**
   * Detects AI generation artifacts like consonant clusters, repeated letters, entropy
   */
  public static detectAiGibberish(clean: string, originalWord: string): { isGibberish: boolean; reason: string; suggestion?: string } {
    // A. Extreme repeating characters (e.g. "aaabbb", "coooolll")
    const repeatingChars = /(.)\1{2,}/i;
    if (repeatingChars.test(clean)) {
      const simplified = clean.replace(/(.)\1{2,}/gi, '$1$1');
      return {
        isGibberish: true,
        reason: `AI 偽字特徵：包含異常重複字母「${clean}」`,
        suggestion: simplified
      };
    }

    // B. Consecutive 4+ consonants without vowels (e.g. "qwrtyp", "bcdfgh", "zxcvb")
    const consonantCluster = /[bcdfghjklmnpqrstvwxyz]{4,}/i;
    if (consonantCluster.test(clean)) {
      return {
        isGibberish: true,
        reason: `AI 亂碼特徵：包含過長無母音子音串「${clean}」`
      };
    }

    // C. Mixed irregular case inside word (e.g. "cOfFEe", "wOrLd")
    if (originalWord.length >= 4 && /[a-z][A-Z][a-z]/.test(originalWord)) {
      return {
        isGibberish: true,
        reason: `AI 大小寫異常混雜：「${originalWord}」`,
        suggestion: originalWord.toLowerCase()
      };
    }

    return { isGibberish: false, reason: '' };
  }

  /**
   * Levenshtein edit distance between two strings
   */
  public static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Finds closest matching word in dictionary
   */
  private static findClosestDictionaryWord(target: string): string | null {
    let closest: string | null = null;
    let minDistance = 999;

    for (const dictWord of this.COMMON_DICTIONARY) {
      const dist = this.levenshteinDistance(target, dictWord);
      if (dist < minDistance && dist <= 2) {
        minDistance = dist;
        closest = dictWord;
      }
    }
    return closest;
  }

  /**
   * Matches original capitalization format (ALL CAPS, Title Case, lowercase)
   */
  private static capitalizeMatch(original: string, target: string): string {
    if (original === original.toUpperCase()) {
      return target.toUpperCase();
    }
    if (original.charAt(0) === original.charAt(0).toUpperCase()) {
      return target.charAt(0).toUpperCase() + target.slice(1).toLowerCase();
    }
    return target.toLowerCase();
  }
}
