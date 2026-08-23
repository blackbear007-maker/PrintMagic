import { describe, it, expect } from 'vitest';
import { TextInspector } from '../src/core/text-inspector';

describe('TextInspector Engine', () => {
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

  it('should auto-detect and extract structured text layers from business card image', () => {
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
    const layers = TextInspector.autoDetectTextLayers(dummyCard);

    expect(layers.length).toBeGreaterThan(0);
    expect(layers.some(l => l.text === 'STUDIO MAGIC')).toBe(true);
    expect(layers.some(l => l.text === 'Steve C. Wang')).toBe(true);
    expect(layers.some(l => l.text.includes('hello@printmagic.ai'))).toBe(true);
    expect(layers.every(l => l.isK100 === true)).toBe(true);
    expect(layers.every(l => l.fontSizePx > 0)).toBe(true);
  });
});
