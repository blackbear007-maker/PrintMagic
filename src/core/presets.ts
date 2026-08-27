import type { PrintPreset, PrintPresetId } from '../types';

/**
 * Standard Print Shop Presets
 * Calibrated against ISO 216 standards and commercial print specifications
 */
export const PRINT_PRESETS: Record<PrintPresetId, PrintPreset> = {
  'poster-a4': {
    id: 'poster-a4',
    name: 'A4 Poster',
    nameZh: 'A4 經典海報',
    desc: '最普遍的畫作、同人誌插畫與宣傳海報規格 (210 × 297 mm)',
    category: 'commercial',
    icon: '📄',
    widthMm: 210,
    heightMm: 297,
    targetDpi: 300,
    bleedMm: 3,
    safeMarginMm: 5,
    realWorldRef: '≈ 雜誌單頁大小',
    colorMode: 'cmyk',
    recommendedPaper: 'glossy',
    cropMarks: true,
    colorBars: true,
    registrationMarks: true
  },
  'poster-a3': {
    id: 'poster-a3',
    name: 'A3 Exhibition Poster',
    nameZh: 'A3 大圖展示海報',
    desc: '展覽級大尺寸海報，細節要求極高 (297 × 420 mm)',
    category: 'art',
    icon: '🖼️',
    widthMm: 297,
    heightMm: 420,
    targetDpi: 300,
    bleedMm: 3,
    safeMarginMm: 8,
    realWorldRef: '≈ 2張雜誌展開大圖',
    colorMode: 'cmyk',
    recommendedPaper: 'matte',
    cropMarks: true,
    colorBars: true,
    registrationMarks: true
  },
  'postcard': {
    id: 'postcard',
    name: 'Art Postcard',
    nameZh: '藝術紀念明信片',
    desc: '厚卡紙印刷標準尺寸，色彩要求飽滿鮮明 (148 × 100 mm)',
    category: 'art',
    icon: '✉️',
    widthMm: 148,
    heightMm: 100,
    targetDpi: 300,
    bleedMm: 2,
    safeMarginMm: 4,
    realWorldRef: '≈ iPhone 15 Pro Max 大小',
    colorMode: 'cmyk',
    recommendedPaper: 'cotton',
    cropMarks: true,
    colorBars: true,
    registrationMarks: false
  },
  'business-card': {
    id: 'business-card',
    name: 'Standard Business Card',
    nameZh: '專業商業名片',
    desc: '標準名片尺寸，文字與精細線條邊緣清晰 (90 × 54 mm)',
    category: 'commercial',
    icon: '📇',
    widthMm: 90,
    heightMm: 54,
    targetDpi: 350,
    bleedMm: 1.5,
    safeMarginMm: 3,
    realWorldRef: '≈ 健保卡 / 信用卡大小',
    colorMode: 'cmyk',
    recommendedPaper: 'linen',
    cropMarks: true,
    colorBars: false,
    registrationMarks: false
  },
  'sticker': {
    id: 'sticker',
    name: 'Die-cut Sticker',
    nameZh: '精緻模切貼紙',
    desc: '高密度小物件印刷，需要超高 DPI 與精確出血 (50 × 50 mm)',
    category: 'commercial',
    icon: '🏷️',
    widthMm: 50,
    heightMm: 50,
    targetDpi: 350,
    bleedMm: 2,
    safeMarginMm: 3,
    realWorldRef: '≈ 手搖飲杯身 / 筆電貼紙',
    colorMode: 'cmyk',
    recommendedPaper: 'glossy',
    cropMarks: true,
    colorBars: false,
    registrationMarks: false
  },
  'id-photo': {
    id: 'id-photo',
    name: '2-inch ID Photo',
    nameZh: '2 吋證件照',
    desc: '護照/證件專用規格 (35 × 45 mm)。尺寸與頭部佔比 32-36mm 依外交部領事事務局公告規格，來源 boca.gov.tw/np-16-1.html（2026-08-27 核實）。',
    category: 'commercial',
    icon: '🪪',
    widthMm: 35,
    heightMm: 45,
    targetDpi: 300,
    bleedMm: 0,
    safeMarginMm: 2,
    realWorldRef: '≈ 信用卡的一半大小',
    colorMode: 'cmyk',
    recommendedPaper: 'glossy',
    cropMarks: true,
    colorBars: false,
    registrationMarks: false
  },
  'social': {
    id: 'social',
    name: 'HD Digital Social Share',
    nameZh: '社群高畫質',
    desc: '數位社群專用 (1080 × 1920 px · 72 DPI · RGB · 零出血)',
    category: 'digital',
    icon: '📱',
    widthMm: 0, // digital only
    heightMm: 0,
    targetDpi: 72,
    bleedMm: 0,
    safeMarginMm: 0,
    realWorldRef: '≈ 手機直式全螢幕',
    colorMode: 'rgb',
    recommendedPaper: 'glossy',
    cropMarks: false,
    colorBars: false,
    registrationMarks: false
  }
};

export const DEFAULT_PRESET_ID: PrintPresetId = 'poster-a4';
export const DEFAULT_PRESET = PRINT_PRESETS[DEFAULT_PRESET_ID];
export const ALL_PRESETS = Object.values(PRINT_PRESETS);

export function getPresetById(id: string): PrintPreset {
  return PRINT_PRESETS[id as PrintPresetId] || DEFAULT_PRESET;
}

/**
 * Intelligent Aspect-Ratio & Dimension Preset Detection
 * Automatically selects the closest matching print preset without locking manual override
 */
export function detectBestPreset(widthPx: number, heightPx: number): PrintPreset {
  if (!widthPx || !heightPx) return DEFAULT_PRESET;

  const aspect = Math.max(widthPx, heightPx) / Math.min(widthPx, heightPx);
  const minDim = Math.min(widthPx, heightPx);
  const maxDim = Math.max(widthPx, heightPx);

  // 1. Square or near-square (1:1 ± 8%)
  if (aspect >= 0.92 && aspect <= 1.08) {
    // If small icon / small dimension => Die-cut sticker
    if (maxDim <= 1200) {
      return PRINT_PRESETS['sticker'];
    }
    // High-res digital / social avatar
    return PRINT_PRESETS['social'];
  }

  // 2. Business Card Ratio (90:54 ≈ 1.667)
  if (aspect >= 1.58 && aspect <= 1.78 && minDim <= 1400) {
    return PRINT_PRESETS['business-card'];
  }

  // 3. Postcard Ratio (148:100 = 1.48)
  if (aspect >= 1.44 && aspect <= 1.55) {
    return PRINT_PRESETS['postcard'];
  }

  // 4. ISO A-series (1:1.414)
  if (aspect >= 1.35 && aspect <= 1.44) {
    // If ultra high resolution > 3200px => Suggest A3 Exhibition Poster, else A4
    if (maxDim >= 3400) {
      return PRINT_PRESETS['poster-a3'];
    }
    return PRINT_PRESETS['poster-a4'];
  }

  // 5. Default fallback to A4 Poster
  return PRINT_PRESETS['poster-a4'];
}
