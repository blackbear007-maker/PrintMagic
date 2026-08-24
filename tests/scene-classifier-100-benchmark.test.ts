import { describe, it, expect } from 'vitest';
import { SceneClassifier, SceneCategory } from '../src/core/scene-classifier';

describe('100-Sample Automated Pre-Press Scene Detection & Pipeline Dispatch Benchmark', () => {
  const createBlankImageData = (w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    return { width: w, height: h, data, colorSpace: 'srgb' } as ImageData;
  };

  /**
   * Generates synthetic randomized test cases representing real-world printing artwork
   */
  const generate100RandomSamples = () => {
    const samples: Array<{
      id: number;
      name: string;
      expectedCategory: SceneCategory;
      imageData: ImageData;
      fileBytes?: Uint8Array;
    }> = [];

    let id = 1;

    // ─── Group 1: 20x 🏷️ Die-Cut Stickers & Transparent Logos ─────────────
    for (let i = 1; i <= 20; i++) {
      const w = 40 + (i * 3);
      const h = 40 + (i * 3);
      const img = createBlankImageData(w, h);
      const transparentRatio = 0.15 + (Math.random() * 0.4); // 15% ~ 55% transparent

      for (let p = 0; p < img.data.length; p += 4) {
        if (p < img.data.length * transparentRatio) {
          img.data[p + 3] = 0; // Transparent
        } else {
          // Colorful sticker subject
          img.data[p] = Math.floor(100 + Math.random() * 155);
          img.data[p + 1] = Math.floor(50 + Math.random() * 180);
          img.data[p + 2] = Math.floor(50 + Math.random() * 200);
          img.data[p + 3] = 255;
        }
      }

      samples.push({
        id: id++,
        name: `透明模切貼紙標籤 #${i}`,
        expectedCategory: 'sticker',
        imageData: img
      });
    }

    // ─── Group 2: 20x 📄 Business Cards & Documents & Certificates ────────
    for (let i = 1; i <= 20; i++) {
      const w = 90;
      const h = 54;
      const img = createBlankImageData(w, h);

      for (let p = 0; p < img.data.length; p += 4) {
        if (p % (16 + (i % 8)) === 0) {
          // Sharp black text lines
          img.data[p] = 15;
          img.data[p + 1] = 15;
          img.data[p + 2] = 15;
        } else {
          // Clean white paper background
          img.data[p] = 248;
          img.data[p + 1] = 248;
          img.data[p + 2] = 248;
        }
        img.data[p + 3] = 255;
      }

      samples.push({
        id: id++,
        name: `商業名片/證書/黑白文件 #${i}`,
        expectedCategory: 'document',
        imageData: img
      });
    }

    // ─── Group 3: 20x 🎨 Anime / 2D Manga / Digital Illustrations ─────────
    for (let i = 1; i <= 20; i++) {
      const w = 60 + i;
      const h = 60 + i;
      const img = createBlankImageData(w, h);
      const isClipStudio = i % 2 === 0;
      const mockBytes = isClipStudio
        ? new TextEncoder().encode(`CLIP STUDIO PAINT PRO Software Tag #${i}`)
        : undefined;

      for (let p = 0; p < img.data.length; p += 4) {
        if (p % 12 === 0) {
          // Dark ink lineart outline
          img.data[p] = 10;
          img.data[p + 1] = 10;
          img.data[p + 2] = 10;
        } else {
          // Saturated flat anime colors (magenta, cyan, electric purple)
          img.data[p] = 240 + Math.floor(Math.random() * 15);
          img.data[p + 1] = 40 + Math.floor(Math.random() * 60);
          img.data[p + 2] = 180 + Math.floor(Math.random() * 70);
        }
        img.data[p + 3] = 255;
      }

      samples.push({
        id: id++,
        name: `日系動漫/二次元插畫 #${i} ${isClipStudio ? '(帶 CSP EXIF)' : ''}`,
        expectedCategory: 'anime',
        imageData: img,
        fileBytes: mockBytes
      });
    }

    // ─── Group 4: 20x 📷 Realistic Human Portraits & Wedding Photos ────────
    for (let i = 1; i <= 20; i++) {
      const w = 54;
      const h = 86; // K-Pop Photocard / Portrait aspect ratio
      const img = createBlankImageData(w, h);
      const mockBytes = i % 3 === 0
        ? new TextEncoder().encode(`Apple iPhone 15 Pro Portrait Mode Camera #${i}`)
        : undefined;

      for (let p = 0; p < img.data.length; p += 4) {
        // Human YCbCr biometric skin tones (R: 215~235, G: 150~175, B: 120~140)
        img.data[p] = 210 + Math.floor(Math.random() * 30);
        img.data[p + 1] = 150 + Math.floor(Math.random() * 25);
        img.data[p + 2] = 120 + Math.floor(Math.random() * 20);
        img.data[p + 3] = 255;
      }

      samples.push({
        id: id++,
        name: `寫實人像/婚紗寫真/偶像小卡 #${i}`,
        expectedCategory: 'portrait',
        imageData: img,
        fileBytes: mockBytes
      });
    }

    // ─── Group 5: 10x 🍜 Food & Beverage / Restaurant Menus ───────────────
    for (let i = 1; i <= 10; i++) {
      const w = 50;
      const h = 50;
      const img = createBlankImageData(w, h);

      for (let p = 0; p < img.data.length; p += 4) {
        // Food appetite warm tones (Golden crispy fry / Roasted meat warm red)
        img.data[p] = 215 + Math.floor(Math.random() * 35);
        img.data[p + 1] = 100 + Math.floor(Math.random() * 40);
        img.data[p + 2] = 25 + Math.floor(Math.random() * 30);
        img.data[p + 3] = 255;
      }

      samples.push({
        id: id++,
        name: `餐飲美食料理/精緻菜單照 #${i}`,
        expectedCategory: 'food',
        imageData: img
      });
    }

    // ─── Group 6: 10x 🏞️ Landscapes & Exhibition Banners ──────────────────
    for (let i = 1; i <= 10; i++) {
      const w = 80;
      const h = 200; // 1:2.5 Roll-up banner extreme aspect ratio
      const img = createBlankImageData(w, h);

      for (let p = 0; p < img.data.length; p += 4) {
        // Natural landscape gradients (Sky cyan to mountain forest green)
        img.data[p] = 40 + Math.floor(Math.random() * 50);
        img.data[p + 1] = 120 + Math.floor(Math.random() * 60);
        img.data[p + 2] = 180 + Math.floor(Math.random() * 65);
        img.data[p + 3] = 255;
      }

      samples.push({
        id: id++,
        name: `風景攝影/易拉寶大型展架 #${i}`,
        expectedCategory: 'landscape',
        imageData: img
      });
    }

    return samples;
  };

  it('should successfully execute 100 random samples with 100% category match and optimal model dispatching', () => {
    const samples = generate100RandomSamples();
    expect(samples.length).toBe(100);

    let matchCount = 0;
    const categoryStats: Record<SceneCategory, number> = {
      sticker: 0,
      document: 0,
      anime: 0,
      portrait: 0,
      food: 0,
      landscape: 0
    };

    console.log('\n' + '═'.repeat(90));
    console.log('🚀 開始執行 100 張隨機測試樣本：自動偵測與專屬模型派發驗證基準');
    console.log('═'.repeat(90));

    const startTime = performance.now();

    for (const sample of samples) {
      const t0 = performance.now();
      const result = SceneClassifier.classifyImage(sample.imageData, sample.fileBytes);
      const durationMs = performance.now() - t0;

      const isMatch = result.category === sample.expectedCategory;
      if (isMatch) matchCount++;
      categoryStats[result.category]++;

      // Print progress milestone every 10 samples
      if (sample.id % 10 === 0 || sample.id === 1) {
        console.log(
          `✓ [樣本 ${String(sample.id).padStart(3, ' ')}/100] ${sample.name.padEnd(28, ' ')} ` +
          `➔ 判定: 【${result.categoryIcon} ${result.categoryNameZh}】 ` +
          `| 置信度: ${(result.confidence * 100).toFixed(1)}% ` +
          `| 派發模型: ${result.recommendedPipeline.superResolutionModel.slice(0, 20)} ` +
          `| 耗時: ${durationMs.toFixed(2)}ms`
        );
      }

      // Assertions
      expect(result.category).toBe(sample.expectedCategory);
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
      expect(result.recommendedPipeline.superResolutionModel).toBeDefined();
      expect(result.recommendedPipeline.outpaintingModel).toBeDefined();
      expect(result.recommendedPipeline.specialCraft).toBeDefined();
    }

    const totalTimeMs = performance.now() - startTime;
    const avgLatencyMs = (totalTimeMs / 100).toFixed(3);

    console.log('═'.repeat(90));
    console.log(`📊 100 張圖片自動偵測與模型派發驗證統計結果：`);
    console.log(`• 🎯 總成功率：${matchCount} / 100 (${((matchCount / 100) * 100).toFixed(1)}%) 100% 全數命中`);
    console.log(`• ⚡ 平均辨識耗時：${avgLatencyMs} ms / 張 (極速 0 延遲)`);
    console.log(`• 🗂️ 各類別分佈：`);
    console.log(`  ├─ 🏷️ 模切貼紙/圖標：${categoryStats.sticker} 張`);
    console.log(`  ├─ 📄 商業文件/名片：${categoryStats.document} 張`);
    console.log(`  ├─ 🎨 動漫/二次元插畫：${categoryStats.anime} 張`);
    console.log(`  ├─ 📷 寫實人像/婚紗小卡：${categoryStats.portrait} 張`);
    console.log(`  ├─ 🍜 餐飲美食/菜單：${categoryStats.food} 張`);
    console.log(`  └─ 🏞️ 風景/大型展架：${categoryStats.landscape} 張`);
    console.log('═'.repeat(90) + '\n');

    expect(matchCount).toBe(100);
  });
});
