import { describe, it, expect } from 'vitest';
import { SceneClassifier } from '../src/core/scene-classifier';

describe('Intelligent Pre-Press Scene & Image Type Auto-Classifier', () => {
  const createBlankImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  it('should detect Sticker / Icon when alpha transparency is present', () => {
    const img = createBlankImageData(50, 50);
    // Fill 20% of pixels with alpha = 0
    for (let i = 0; i < img.data.length; i += 4) {
      if (i < img.data.length * 0.2) {
        img.data[i + 3] = 0; // transparent
      } else {
        img.data[i] = 200;
        img.data[i + 1] = 50;
        img.data[i + 2] = 50;
        img.data[i + 3] = 255;
      }
    }

    const res = SceneClassifier.classifyImage(img);
    expect(res.category).toBe('sticker');
    expect(res.categoryNameZh).toContain('貼紙');
    expect(res.recommendedPipeline.specialCraft).toContain('刀模');
  });

  it('should detect Document / Business Card when light background + black lines + low saturation', () => {
    const img = createBlankImageData(50, 50);
    // Fill with white background and black text lines
    for (let i = 0; i < img.data.length; i += 4) {
      if (i % 32 === 0) {
        // Black text
        img.data[i] = 20;
        img.data[i + 1] = 20;
        img.data[i + 2] = 20;
      } else {
        // White paper background
        img.data[i] = 245;
        img.data[i + 1] = 245;
        img.data[i + 2] = 245;
      }
      img.data[i + 3] = 255;
    }

    const res = SceneClassifier.classifyImage(img);
    expect(res.category).toBe('document');
    expect(res.categoryNameZh).toContain('文件');
    expect(res.recommendedPipeline.superResolutionModel).toContain('K100');
  });

  it('should detect Anime / 2D Manga when high saturation + dark contour lines', () => {
    const img = createBlankImageData(50, 50);
    // Fill with vibrant anime colors and dark ink lines
    for (let i = 0; i < img.data.length; i += 4) {
      if (i % 20 === 0) {
        // Dark ink line
        img.data[i] = 10;
        img.data[i + 1] = 10;
        img.data[i + 2] = 10;
      } else {
        // Vibrant neon/saturated anime colors
        img.data[i] = 255;
        img.data[i + 1] = 50;
        img.data[i + 2] = 180;
      }
      img.data[i + 3] = 255;
    }

    const res = SceneClassifier.classifyImage(img);
    expect(res.category).toBe('anime');
    expect(res.categoryNameZh).toContain('動漫');
    expect(res.recommendedPipeline.superResolutionModel).toContain('LineArtUpscaler');
  });

  it('should detect Portrait when skin tones are dominant', () => {
    const img = createBlankImageData(50, 50);
    // Fill with realistic warm skin tones (R: 220, G: 160, B: 130)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 220;
      img.data[i + 1] = 160;
      img.data[i + 2] = 130;
      img.data[i + 3] = 255;
    }

    const res = SceneClassifier.classifyImage(img);
    expect(res.category).toBe('portrait');
    expect(res.categoryNameZh).toContain('人像');
    expect(res.recommendedPipeline.superResolutionModel).toContain('EdgeAwareUpscaler');
  });

  it('should default to Landscape / Scenery for broad scenery palettes', () => {
    const img = createBlankImageData(50, 50);
    // Fill with natural forest / sky colors
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 60;
      img.data[i + 1] = 120;
      img.data[i + 2] = 180;
      img.data[i + 3] = 255;
    }

    const res = SceneClassifier.classifyImage(img);
    expect(res.category).toBe('landscape');
    expect(res.categoryNameZh).toContain('風景');
  });

  it('should detect Food / Dish when warm appetite hues are dominant', () => {
    const img = createBlankImageData(50, 50);
    // Fill with warm roasted food colors (R: 210, G: 110, B: 30)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 210;
      img.data[i + 1] = 110;
      img.data[i + 2] = 30;
      img.data[i + 3] = 255;
    }

    const res = SceneClassifier.classifyImage(img);
    expect(res.category).toBe('food');
    expect(res.categoryNameZh).toContain('美食');
    expect(res.recommendedPipeline.superResolutionModel).toContain('EdgeAwareUpscaler');
  });

  it('should instantly identify Anime via Clip Studio Paint EXIF software tag', () => {
    const img = createBlankImageData(20, 20);
    const mockFileBytes = new TextEncoder().encode('ICC_PROFILE...Software: Clip Studio Paint 2.0...Photoshop');

    const res = SceneClassifier.classifyImage(img, mockFileBytes);
    expect(res.category).toBe('anime');
    expect(res.confidence).toBeGreaterThanOrEqual(0.99);
    expect(res.detectedTraits.some(t => t.includes('Clip Studio'))).toBe(true);
  });
});
