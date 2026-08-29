import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FreeOcrClient so these tests exercise TextInspector's own region-detection and
// confidence-gating glue logic quickly and deterministically, without spinning up a real
// Tesseract.js worker/WASM instance (slow, and Node's worker path in this test environment can't
// resolve the self-hosted browser asset paths anyway). Real end-to-end OCR accuracy is verified
// separately in a real browser, not here.
const mockRecognizeRegion = vi.fn();
const mockImageDataToCanvas = vi.fn();
vi.mock('../src/services/free-ocr-client', () => ({
  FreeOcrClient: {
    recognizeRegion: (...args: any[]) => mockRecognizeRegion(...args),
    imageDataToCanvas: (...args: any[]) => mockImageDataToCanvas(...args)
  },
  OCR_MIN_TRUSTED_CONFIDENCE: 60
}));

import { TextInspector } from '../src/core/text-inspector';

describe('TextInspector Engine', () => {
  beforeEach(() => {
    mockRecognizeRegion.mockReset();
    mockImageDataToCanvas.mockReset();
    mockImageDataToCanvas.mockReturnValue({} as any);
    // Default: OCR "ran but found nothing trustworthy" — matches the old always-placeholder
    // behavior for tests below that don't care about OCR specifically.
    mockRecognizeRegion.mockResolvedValue(null);
  });

  it('should calculate accurate Levenshtein edit distance', () => {
    expect(TextInspector.levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(TextInspector.levenshteinDistance('coffee', 'coffee')).toBe(0);
    expect(TextInspector.levenshteinDistance('cofee', 'coffee')).toBe(1);
    expect(TextInspector.levenshteinDistance('welcom', 'welcome')).toBe(1);
    expect(TextInspector.levenshteinDistance('spcial', 'special')).toBe(1);
  });

  it('should detect direct common AI typos and suggest correct replacements', () => {
    const region1 = {
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      text: 'SPECIAL COFEE EDITION',
      edgeScore: 0.35
    };
    const result1 = TextInspector.verifyTextRegion(region1, 1);
    expect(result1.isTypo).toBe(true);
    expect(result1.suggestion).toContain('COFFEE');

    const region2 = {
      x: 50,
      y: 50,
      width: 150,
      height: 30,
      text: 'WELCOM TO TOKYO',
      edgeScore: 0.4
    };
    const result2 = TextInspector.verifyTextRegion(region2, 2);
    expect(result2.isTypo).toBe(true);
    expect(result2.suggestion).toContain('WELCOME');
  });

  it('should detect AI pseudo-gibberish consonant clusters and repeating characters', () => {
    const gibberish1 = TextInspector.detectAiGibberish('qwrtpkj', 'qwrtpkj');
    expect(gibberish1.isGibberish).toBe(true);
    expect(gibberish1.reason).toContain('AI 亂碼特徵');

    const gibberish2 = TextInspector.detectAiGibberish('coooollll', 'coooollll');
    expect(gibberish2.isGibberish).toBe(true);
    expect(gibberish2.reason).toContain('AI 偽字特徵');

    const gibberish3 = TextInspector.detectAiGibberish('cOfFeE', 'cOfFeE');
    expect(gibberish3.isGibberish).toBe(true);
    expect(gibberish3.reason).toContain('大小寫異常混雜');
  });

  it('should detect fuzzy typos within Levenshtein distance of 1 or 2', () => {
    const region = {
      x: 80,
      y: 120,
      width: 180,
      height: 36,
      text: 'SUMMMER FESTIVAL',
      edgeScore: 0.3
    };
    const result = TextInspector.verifyTextRegion(region, 3);
    expect(result.isTypo).toBe(true);
    expect(result.suggestion?.toUpperCase()).toContain('SUMMER');
  });

  it('should mark clean standard text as valid with no typos', () => {
    const region = {
      x: 100,
      y: 200,
      width: 250,
      height: 50,
      text: 'CYBERPUNK ART EXHIBITION',
      edgeScore: 0.45
    };
    const result = TextInspector.verifyTextRegion(region, 4);
    expect(result.isTypo).toBe(false);
    expect(result.isBlurry).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should process synthetic ImageData and return full inspection result', async () => {
    // Create dummy 400x300 ImageData with high contrast text-like bands
    const width = 400;
    const height = 300;
    const data = new Uint8ClampedArray(width * height * 4);

    // Background: light gray
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 240;
      data[i + 1] = 240;
      data[i + 2] = 240;
      data[i + 3] = 255;
    }

    // High contrast black text bar across y: 50-80
    for (let y = 50; y < 80; y++) {
      for (let x = 60; x < 340; x++) {
        if ((x + y) % 4 === 0) {
          const idx = (y * width + x) * 4;
          data[idx] = 10;
          data[idx + 1] = 10;
          data[idx + 2] = 10;
        }
      }
    }

    const dummyImageData = { width, height, data } as ImageData;
    const result = await TextInspector.inspectImage(dummyImageData);

    expect(result).toBeDefined();
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.regions)).toBe(true);
  });

  it('should auto-detect and extract structured text layers without fake placeholder watermarks', async () => {
    // 380x228 light background business card (aspect ~1.66)
    const width = 380;
    const height = 228;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 250;
      data[i + 1] = 250;
      data[i + 2] = 252;
      data[i + 3] = 255;
    }

    const dummyCard = { width, height, data } as ImageData;
    const layers = await TextInspector.autoDetectTextLayers(dummyCard);

    expect(Array.isArray(layers)).toBe(true);
    expect(layers.every(l => l.isK100 === true)).toBe(true);
  });

  describe('Real OCR integration (mocked FreeOcrClient — confidence-gating glue logic)', () => {
    const makeBandedImage = (width: number, height: number): ImageData => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 240; data[i + 1] = 240; data[i + 2] = 240; data[i + 3] = 255;
      }
      for (let y = Math.round(height * 0.2); y < Math.round(height * 0.35); y++) {
        for (let x = Math.round(width * 0.1); x < Math.round(width * 0.9); x++) {
          if ((x + y) % 3 === 0) {
            const idx = (y * width + x) * 4;
            data[idx] = 15; data[idx + 1] = 15; data[idx + 2] = 15;
          }
        }
      }
      return { width, height, data } as ImageData;
    };

    it('fills in real recognized text when OCR clears the confidence gate', async () => {
      mockRecognizeRegion.mockResolvedValue({ text: 'GRAND OPENING', confidence: 91 });

      const img = makeBandedImage(400, 200);
      const regions = await TextInspector.detectTextRegions(img);

      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0].text).toBe('GRAND OPENING');
      expect(regions[0].ocrConfidence).toBe(91);
    });

    it('falls back to empty text (placeholder territory) when OCR confidence is below the gate', async () => {
      mockRecognizeRegion.mockResolvedValue({ text: 'gRaNd 0p3n1ng', confidence: 42 });

      const img = makeBandedImage(400, 200);
      const regions = await TextInspector.detectTextRegions(img);

      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0].text).toBe('');
      expect(regions[0].ocrConfidence).toBe(0);
    });

    it('falls back to empty text when OCR returns confident-but-empty output', async () => {
      mockRecognizeRegion.mockResolvedValue({ text: '', confidence: 95 });

      const img = makeBandedImage(400, 200);
      const regions = await TextInspector.detectTextRegions(img);

      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0].text).toBe('');
    });

    it('treats OCR unavailability (null) the same as "found nothing" rather than throwing', async () => {
      mockRecognizeRegion.mockResolvedValue(null);

      const img = makeBandedImage(400, 200);
      await expect(TextInspector.detectTextRegions(img)).resolves.not.toThrow();
      const regions = await TextInspector.detectTextRegions(img);
      expect(regions.every((r) => r.text === '')).toBe(true);
    });

    it('propagates high-confidence OCR text through to autoDetectTextLayers with ocrConfidence set', async () => {
      mockRecognizeRegion.mockResolvedValue({ text: '限量特別版', confidence: 88 });

      const img = makeBandedImage(400, 200);
      const layers = await TextInspector.autoDetectTextLayers(img);

      expect(layers.length).toBeGreaterThan(0);
      expect(layers[0].text).toBe('限量特別版');
      expect(layers[0].ocrConfidence).toBe(88);
    });
  });
});
