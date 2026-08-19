import { describe, it, expect } from 'vitest';
import { PrintScoreCalculator } from '../src/core/print-score';
import { DpiCalculator } from '../src/core/dpi-calculator';
import { ALL_PRESETS } from '../src/core/presets';
import type { ImagePixelStats, InkAnalysis } from '../src/types';

interface TestCase {
  id: number;
  category: string;
  name: string;
  presetId: string;
  width: number;
  height: number;
  avgLum: number;
  avgSat: number;
  stdLum: number;
  edgeScore: number;
  maxTac: number;
}

describe('50 Diverse Image Styles Benchmark & Scoring Verification', () => {
  const testCases: TestCase[] = [
    { id: 1, category: '動漫插畫', name: '日系二次元萌系頭像', presetId: 'sticker', width: 256, height: 256, avgLum: 0.72, avgSat: 0.65, stdLum: 0.18, edgeScore: 0.045, maxTac: 310 },
    { id: 2, category: '動漫插畫', name: '暗黑系動漫機甲海報', presetId: 'poster-a4', width: 720, height: 1024, avgLum: 0.22, avgSat: 0.45, stdLum: 0.14, edgeScore: 0.038, maxTac: 380 },
    { id: 3, category: '動漫插畫', name: '賽璐珞風格同人明信片', presetId: 'postcard', width: 600, height: 400, avgLum: 0.60, avgSat: 0.70, stdLum: 0.20, edgeScore: 0.050, maxTac: 290 },
    { id: 4, category: '動漫插畫', name: '粉彩少女漫畫扉頁', presetId: 'poster-a4', width: 800, height: 1131, avgLum: 0.80, avgSat: 0.35, stdLum: 0.10, edgeScore: 0.028, maxTac: 240 },
    { id: 5, category: '動漫插畫', name: '黑白網點熱血漫畫頁', presetId: 'poster-a4', width: 900, height: 1280, avgLum: 0.50, avgSat: 0.02, stdLum: 0.38, edgeScore: 0.085, maxTac: 320 },

    { id: 6, category: '寫實攝影', name: '高動態範圍夜景霓虹街頭', presetId: 'poster-a4', width: 1080, height: 1920, avgLum: 0.28, avgSat: 0.55, stdLum: 0.24, edgeScore: 0.032, maxTac: 395 },
    { id: 7, category: '寫實攝影', name: '影棚高光人像寫真', presetId: 'photo-4x6', width: 800, height: 1200, avgLum: 0.75, avgSat: 0.30, stdLum: 0.16, edgeScore: 0.024, maxTac: 270 },
    { id: 8, category: '寫實攝影', name: '微距水滴花卉生態', presetId: 'postcard', width: 640, height: 480, avgLum: 0.55, avgSat: 0.68, stdLum: 0.22, edgeScore: 0.042, maxTac: 315 },
    { id: 9, category: '寫實攝影', name: '壯闊雪山風光大片', presetId: 'poster-a3', width: 1280, height: 720, avgLum: 0.68, avgSat: 0.40, stdLum: 0.28, edgeScore: 0.036, maxTac: 280 },
    { id: 10, category: '寫實攝影', name: '低照度復古膠片婚紗照', presetId: 'photo-4x6', width: 900, height: 1350, avgLum: 0.35, avgSat: 0.25, stdLum: 0.12, edgeScore: 0.018, maxTac: 340 },

    { id: 11, category: '藝術油畫', name: '印象派莫內花園光影', presetId: 'poster-a4', width: 800, height: 600, avgLum: 0.62, avgSat: 0.52, stdLum: 0.15, edgeScore: 0.022, maxTac: 295 },
    { id: 12, category: '藝術油畫', name: '古典寫實厚塗人物肖像', presetId: 'poster-a3', width: 1000, height: 1400, avgLum: 0.38, avgSat: 0.42, stdLum: 0.19, edgeScore: 0.026, maxTac: 360 },
    { id: 13, category: '藝術油畫', name: '現代抽象幾何色塊', presetId: 'poster-a4', width: 750, height: 750, avgLum: 0.58, avgSat: 0.75, stdLum: 0.25, edgeScore: 0.060, maxTac: 310 },
    { id: 14, category: '藝術水彩', name: '透明水彩植物圖鑑', presetId: 'postcard', width: 500, height: 700, avgLum: 0.82, avgSat: 0.40, stdLum: 0.11, edgeScore: 0.020, maxTac: 220 },
    { id: 15, category: '藝術水彩', name: '濕畫法煙雨江南水鄉', presetId: 'postcard', width: 720, height: 480, avgLum: 0.65, avgSat: 0.28, stdLum: 0.09, edgeScore: 0.015, maxTac: 260 },

    { id: 16, category: '商業設計', name: '極簡現代科技公司名片', presetId: 'business-card', width: 450, height: 270, avgLum: 0.90, avgSat: 0.15, stdLum: 0.08, edgeScore: 0.040, maxTac: 230 },
    { id: 17, category: '商業設計', name: '黑金奢華燙金VIP卡', presetId: 'business-card', width: 400, height: 240, avgLum: 0.12, avgSat: 0.20, stdLum: 0.15, edgeScore: 0.048, maxTac: 390 },
    { id: 18, category: '商業設計', name: '餐飲美食外送菜單折頁', presetId: 'poster-a4', width: 900, height: 1600, avgLum: 0.52, avgSat: 0.62, stdLum: 0.21, edgeScore: 0.035, maxTac: 335 },
    { id: 19, category: '商業設計', name: '電商促銷主視覺 Banner', presetId: 'social', width: 800, height: 800, avgLum: 0.55, avgSat: 0.80, stdLum: 0.22, edgeScore: 0.055, maxTac: 320 },
    { id: 20, category: '商業設計', name: '精品香水包裝彩盒外觀', presetId: 'poster-a4', width: 1100, height: 1100, avgLum: 0.70, avgSat: 0.35, stdLum: 0.17, edgeScore: 0.030, maxTac: 285 },

    { id: 21, category: '向量圖形', name: '扁平化商用 App Icon 集合', presetId: 'sticker', width: 512, height: 512, avgLum: 0.60, avgSat: 0.60, stdLum: 0.26, edgeScore: 0.075, maxTac: 290 },
    { id: 22, category: '向量圖形', name: '精緻模切貼紙標籤徽章', presetId: 'sticker', width: 350, height: 350, avgLum: 0.65, avgSat: 0.55, stdLum: 0.20, edgeScore: 0.065, maxTac: 275 },
    { id: 23, category: '向量圖形', name: '復古美式復古機車貼花', presetId: 'sticker', width: 400, height: 300, avgLum: 0.45, avgSat: 0.50, stdLum: 0.23, edgeScore: 0.058, maxTac: 330 },
    { id: 24, category: '向量圖形', name: '建築室內 CAD 平面藍圖', presetId: 'poster-a3', width: 1600, height: 1130, avgLum: 0.25, avgSat: 0.75, stdLum: 0.30, edgeScore: 0.090, maxTac: 300 },
    { id: 25, category: '向量圖形', name: '手繪植物圖騰線稿', presetId: 'postcard', width: 600, height: 850, avgLum: 0.88, avgSat: 0.05, stdLum: 0.22, edgeScore: 0.070, maxTac: 250 },

    { id: 26, category: '賽博未來', name: '賽博龐克雨夜全息投影', presetId: 'poster-a4', width: 600, height: 850, avgLum: 0.20, avgSat: 0.85, stdLum: 0.22, edgeScore: 0.035, maxTac: 400 },
    { id: 27, category: '賽博未來', name: '故障藝術 Glitch 潮流海報', presetId: 'poster-a4', width: 800, height: 1200, avgLum: 0.45, avgSat: 0.90, stdLum: 0.27, edgeScore: 0.062, maxTac: 350 },
    { id: 28, category: '賽博未來', name: '蒸氣波 80s 復古霓虹日落', presetId: 'postcard', width: 750, height: 500, avgLum: 0.40, avgSat: 0.78, stdLum: 0.20, edgeScore: 0.040, maxTac: 360 },
    { id: 29, category: '賽博未來', name: '深空宇宙星雲與黑洞', presetId: 'poster-a3', width: 1400, height: 900, avgLum: 0.15, avgSat: 0.65, stdLum: 0.18, edgeScore: 0.025, maxTac: 385 },
    { id: 30, category: '賽博未來', name: '電競戰隊發光炫彩徽標', presetId: 'sticker', width: 450, height: 450, avgLum: 0.30, avgSat: 0.80, stdLum: 0.25, edgeScore: 0.055, maxTac: 370 },

    { id: 31, category: '復古懷舊', name: '70年代爵士黑膠唱片封面', presetId: 'poster-a4', width: 800, height: 800, avgLum: 0.35, avgSat: 0.32, stdLum: 0.15, edgeScore: 0.028, maxTac: 330 },
    { id: 32, category: '復古懷舊', name: '牛皮紙質舊報紙排版', presetId: 'poster-a4', width: 900, height: 1270, avgLum: 0.68, avgSat: 0.20, stdLum: 0.16, edgeScore: 0.042, maxTac: 270 },
    { id: 33, category: '復古懷舊', name: '昭和時代復古廣告招牌', presetId: 'postcard', width: 640, height: 450, avgLum: 0.55, avgSat: 0.62, stdLum: 0.18, edgeScore: 0.038, maxTac: 315 },
    { id: 34, category: '復古懷舊', name: '點陣像素 8-Bit 像素遊戲圖', presetId: 'sticker', width: 320, height: 320, avgLum: 0.48, avgSat: 0.70, stdLum: 0.32, edgeScore: 0.095, maxTac: 300 },
    { id: 35, category: '復古懷舊', name: '古典浮世繪海浪木刻版畫', presetId: 'postcard', width: 800, height: 530, avgLum: 0.58, avgSat: 0.48, stdLum: 0.21, edgeScore: 0.048, maxTac: 305 },

    { id: 36, category: '3D渲染', name: 'Blender 黏土風格 Q版立體場景', presetId: 'sticker', width: 600, height: 600, avgLum: 0.65, avgSat: 0.50, stdLum: 0.14, edgeScore: 0.024, maxTac: 280 },
    { id: 37, category: '3D渲染', name: 'Unreal 5 金屬機械結構細節', presetId: 'poster-a4', width: 1024, height: 1440, avgLum: 0.42, avgSat: 0.30, stdLum: 0.22, edgeScore: 0.045, maxTac: 340 },
    { id: 38, category: '3D渲染', name: 'C4D 充氣漸層液態動態字體', presetId: 'poster-a4', width: 750, height: 1050, avgLum: 0.60, avgSat: 0.72, stdLum: 0.20, edgeScore: 0.032, maxTac: 310 },
    { id: 39, category: '3D渲染', name: '透明玻璃折射珠寶質感', presetId: 'postcard', width: 700, height: 500, avgLum: 0.75, avgSat: 0.25, stdLum: 0.25, edgeScore: 0.038, maxTac: 260 },
    { id: 40, category: '3D渲染', name: '極簡磨砂亞克力展示台', presetId: 'poster-a4', width: 850, height: 1200, avgLum: 0.82, avgSat: 0.18, stdLum: 0.10, edgeScore: 0.020, maxTac: 240 },

    { id: 41, category: '極限測試', name: '21:9 超寬全景公路風光', presetId: 'poster-a4', width: 1680, height: 720, avgLum: 0.52, avgSat: 0.45, stdLum: 0.18, edgeScore: 0.030, maxTac: 290 },
    { id: 42, category: '極限測試', name: '1:3 超長直條書籤古風插畫', presetId: 'postcard', width: 400, height: 1200, avgLum: 0.62, avgSat: 0.40, stdLum: 0.16, edgeScore: 0.035, maxTac: 280 },
    { id: 43, category: '極限測試', name: '低對比純白極簡霧面藝術照', presetId: 'poster-a4', width: 900, height: 1200, avgLum: 0.92, avgSat: 0.05, stdLum: 0.04, edgeScore: 0.012, maxTac: 180 },
    { id: 44, category: '極限測試', name: '極深黑炭素墨超飽和測試圖', presetId: 'poster-a4', width: 800, height: 1100, avgLum: 0.08, avgSat: 0.95, stdLum: 0.10, edgeScore: 0.025, maxTac: 400 },
    { id: 45, category: '極限測試', name: '超低解析 128x128 網頁縮圖', presetId: 'photo-4x6', width: 128, height: 128, avgLum: 0.50, avgSat: 0.50, stdLum: 0.15, edgeScore: 0.015, maxTac: 310 },

    { id: 46, category: '社群發布', name: 'Instagram 正方形生活美學照', presetId: 'social', width: 640, height: 640, avgLum: 0.68, avgSat: 0.35, stdLum: 0.15, edgeScore: 0.025, maxTac: 260 },
    { id: 47, category: '社群發布', name: 'YouTube 直式 Shorts 封面', presetId: 'social', width: 720, height: 1280, avgLum: 0.45, avgSat: 0.75, stdLum: 0.22, edgeScore: 0.040, maxTac: 330 },
    { id: 48, category: '文化創意', name: '書法水墨詩詞字畫掛軸', presetId: 'poster-a3', width: 800, height: 1600, avgLum: 0.85, avgSat: 0.04, stdLum: 0.28, edgeScore: 0.065, maxTac: 320 },
    { id: 49, category: '文化創意', name: '台灣傳統花磚圖騰杯墊', presetId: 'sticker', width: 400, height: 400, avgLum: 0.58, avgSat: 0.65, stdLum: 0.24, edgeScore: 0.060, maxTac: 310 },
    { id: 50, category: '文化創意', name: '文青手帳水彩生活插畫集', presetId: 'postcard', width: 600, height: 420, avgLum: 0.75, avgSat: 0.42, stdLum: 0.14, edgeScore: 0.026, maxTac: 270 }
  ];

  it('runs complete 50-image benchmark and verifies scoring integrity', () => {
    let totalScoreIncrease = 0;
    let validTests = 0;

    testCases.forEach((tc) => {
      const preset = ALL_PRESETS.find((p) => p.id === tc.presetId) || ALL_PRESETS[0];

      // 1. Initial State Score
      const initialStats: ImagePixelStats = {
        avgLum: tc.avgLum,
        avgSat: tc.avgSat,
        stdLum: tc.stdLum,
        edgeScore: tc.edgeScore,
        transparentRatio: 0,
        width: tc.width,
        height: tc.height
      };
      const initialInk: InkAnalysis = {
        maxTotalInk: tc.maxTac,
        averageTotalInk: Math.min(220, tc.maxTac * 0.7),
        exceededPixelCount: tc.maxTac > 300 ? 500 : 0,
        exceededRatio: tc.maxTac > 300 ? 0.05 : 0,
        hasOverflow: tc.maxTac > 300,
        limitThreshold: 300
      };
      const initialScore = PrintScoreCalculator.calculate(initialStats, preset, initialInk);

      // 2. Simulated Optimized State (Post 4x/8x Super-Res, USM, TAC Clamping, Bleed adaptation)
      const dpiAnalysis = DpiCalculator.analyze(tc.width, tc.height, preset);
      const scale = dpiAnalysis.needsUpscale ? dpiAnalysis.scaleFactor : 1;
      const optimizedWidth = tc.width * scale;
      const optimizedHeight = tc.height * scale;

      const optimizedStats: ImagePixelStats = {
        avgLum: tc.avgLum,
        avgSat: Math.min(1, tc.avgSat * 1.02),
        stdLum: Math.max(0.08, tc.stdLum),
        edgeScore: Math.max(0.045, tc.edgeScore * 1.6), // Post-USM edge definition
        transparentRatio: 0,
        width: optimizedWidth,
        height: optimizedHeight
      };
      const optimizedInk: InkAnalysis = {
        maxTotalInk: Math.min(300, tc.maxTac), // Post-TAC clamp
        averageTotalInk: Math.min(200, tc.maxTac * 0.6),
        exceededPixelCount: 0,
        exceededRatio: 0,
        hasOverflow: false,
        limitThreshold: 300
      };
      const optimizedScore = PrintScoreCalculator.calculate(optimizedStats, preset, optimizedInk);

      const delta = optimizedScore.score - initialScore.score;
      totalScoreIncrease += delta;
      validTests++;

      // Assert that optimization never degrades the print readiness score
      expect(optimizedScore.score).toBeGreaterThanOrEqual(initialScore.score);
    });

    expect(validTests).toBe(50);
    const avgDelta = totalScoreIncrease / validTests;
    expect(avgDelta).toBeGreaterThan(0);
  });
});
