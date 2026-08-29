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
   * Scans ImageData for high-contrast character clusters & bounding boxes, then attempts real OCR
   * on each candidate region. Region localization stays synchronous pixel-statistics work; only
   * the OCR pass (one FreeOcrClient.recognizeRegion call per candidate, sequential — the worker
   * processes one job at a time regardless, and there are at most 8 candidates) is async.
   */
  public static async detectTextRegions(
    imageData: ImageData
  ): Promise<Array<{ x: number; y: number; width: number; height: number; text: string; edgeScore: number; ocrConfidence: number }>> {
    const { width, height, data } = imageData;
    const rawRegions: Array<{ x: number; y: number; width: number; height: number; edgeScore: number }> = [];

    // Subsampling grid for rapid <30ms scanning
    const step = Math.max(2, Math.floor(Math.min(width, height) / 250));
    const gridW = Math.floor(width / step);
    const gridH = Math.floor(height / step);
    const contrastMap = new Uint8Array(gridW * gridH);

    // 1. Compute local gradient & contrast
    for (let gy = 1; gy < gridH - 1; gy++) {
      for (let gx = 1; gx < gridW - 1; gx++) {
        const px = gx * step;
        const py = gy * step;
        const idx = (py * width + px) * 4;

        // 2026-08-28: skip cells touching transparency — a cleared canvas region's leftover RGB
        // (typically rgba(0,0,0,0)) can differ sharply from adjacent opaque content, registering
        // as a fake high-contrast "edge" even though nothing is actually visible there.
        const idxRight = (py * width + (px + 1)) * 4;
        const idxDown = ((py + 1) * width + px) * 4;
        if (data[idx + 3] < 50 || data[idxRight + 3] < 50 || data[idxDown + 3] < 50) continue;

        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const lumRight = 0.299 * data[idxRight] + 0.587 * data[idxRight + 1] + 0.114 * data[idxRight + 2];
        const lumDown = 0.299 * data[idxDown] + 0.587 * data[idxDown + 1] + 0.114 * data[idxDown + 2];

        const grad = Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
        if (grad > 38) {
          contrastMap[gy * gridW + gx] = 1;
        }
      }
    }

    // 2. Horizontal & vertical connected projection to locate text lines
    const rowDensity = new Float32Array(gridH);
    for (let gy = 0; gy < gridH; gy++) {
      let sum = 0;
      for (let gx = 0; gx < gridW; gx++) {
        sum += contrastMap[gy * gridW + gx];
      }
      rowDensity[gy] = sum / gridW;
    }

    // Find dense horizontal bands (typical text headlines & captions).
    //
    // 2026-08-29: the end-of-band threshold used to be 0.04, same order of magnitude as the
    // 0.08 start threshold — too close together for real bold/large glyphs, verified via real OCR.
    // A row entering solid glyph ink from background lights up nearly every column (high density,
    // clears 0.08 easily), but the very next row — still inside the same letters — only has edges
    // where strokes/counters/gaps break up the fill, a much lower density that can dip under 0.04
    // for a single row even mid-glyph. That prematurely ended the band one row in, before the
    // minimum-length filter below even had a chance to run, silently dropping the entire line.
    // Confirmed directly: a text line read at 95% OCR confidence once given its true height,
    // 0% when cut down to the 1-2 row fragment this produced. Lowering the end threshold to 0.02
    // — well below the 0.08 start threshold, but still comfortably above the genuine all-zero gap
    // between separate lines seen in real test data — lets a band survive a brief internal dip
    // without merging genuinely separate lines together.
    let inBand = false;
    let bandStart = 0;
    const candidateBands: Array<{ start: number; end: number; density: number }> = [];

    for (let gy = 0; gy < gridH; gy++) {
      if (rowDensity[gy] > 0.08 && !inBand) {
        inBand = true;
        bandStart = gy;
      } else if (rowDensity[gy] <= 0.02 && inBand) {
        inBand = false;
        if (gy - bandStart >= 2 && gy - bandStart <= gridH * 0.4) {
          candidateBands.push({ start: bandStart, end: gy, density: rowDensity[bandStart] });
        }
      }
    }
    if (inBand && gridH - bandStart >= 2) {
      candidateBands.push({ start: bandStart, end: gridH - 1, density: rowDensity[bandStart] });
    }

    // Merge bands separated by only a small vertical gap. Real bug, found via real OCR (2026-08-29):
    // a single line of bold/large text produces a very dense top-edge row (entering the glyphs from
    // background), then a much sparser run through the glyph interiors (solid fill has near-zero
    // internal gradient — edges only appear at counters/gaps between letters), before density rises
    // again — fragmenting one text line into two-plus thin bands instead of one. Cropping to just
    // the thin top-edge band feeds OCR a sliver through the middle of every glyph instead of the
    // full letterforms; verified directly — the same region read at 96% confidence when given its
    // true full height, 0% when cropped to the fragment this produced. A genuine gap between two
    // separate text lines is comfortably larger than this internal-dip gap, so merging only small
    // gaps doesn't fuse unrelated lines together.
    const MERGE_GAP_ROWS = Math.max(6, Math.round(gridH * 0.04));
    const mergedBands: Array<{ start: number; end: number; density: number }> = [];
    for (const band of candidateBands) {
      const prev = mergedBands[mergedBands.length - 1];
      if (prev && band.start - prev.end <= MERGE_GAP_ROWS) {
        prev.end = band.end;
        prev.density = Math.max(prev.density, band.density);
      } else {
        mergedBands.push({ ...band });
      }
    }

    // Extract text blocks inside candidate bands
    for (const band of mergedBands.slice(0, 8)) {
      const y1 = band.start * step;
      const y2 = Math.min(height, band.end * step + step * 2);
      const bandHeight = y2 - y1;

      // Find horizontal boundaries
      let minX = width;
      let maxX = 0;
      let highContrastCount = 0;

      for (let gy = band.start; gy <= band.end; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
          if (contrastMap[gy * gridW + gx] === 1) {
            const px = gx * step;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            highContrastCount++;
          }
        }
      }

      if (maxX > minX && (maxX - minX) > width * 0.08) {
        const textWidth = Math.min(width - minX, maxX - minX + step * 4);
        const textHeight = bandHeight;

        rawRegions.push({
          x: Math.max(0, minX - step * 2),
          y: y1,
          width: textWidth,
          height: textHeight,
          edgeScore: highContrastCount / ((textWidth / step) * (textHeight / step) || 1)
        });
      }
    }

    // Real OCR pass: one recognizeRegion call per candidate, against a single shared canvas.
    const sourceCanvas = FreeOcrClient.imageDataToCanvas(imageData);
    const regions: Array<{ x: number; y: number; width: number; height: number; text: string; edgeScore: number; ocrConfidence: number }> = [];

    for (const r of rawRegions) {
      let text = '';
      let ocrConfidence = 0;

      if (sourceCanvas) {
        const ocrResult = await FreeOcrClient.recognizeRegion(sourceCanvas, r);
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
