import type { PrintPresetId } from '../types';

export interface PrintShopVendor {
  id: string;
  name: string;
  shortName: string;
  brandTag: string;
  description: string;
  leadTimeBaseDays: number;
  onlineUploadUrl: string;
  features: string[];
}

export interface CommercialPaperOption {
  id: string;
  name: string;
  weightGsm: number;
  tactileDesc: string;
  bestFor: string;
  isPopular?: boolean;
}

export interface PrintQuoteResult {
  shopId: string;
  shopName: string;
  presetId: PrintPresetId;
  presetNameZh: string;
  paperId: string;
  paperName: string;
  quantity: number;
  totalPriceNTD: number;
  unitPriceNTD: number;
  leadTimeDays: number;
  leadTimeFormatted: string;
  isBestValue: boolean;
  notes: string[];
}

export const COMMERCIAL_PAPER_OPTIONS: CommercialPaperOption[] = [
  {
    id: '250g-matte',
    name: '250P 頂級雙面霧膜',
    weightGsm: 250,
    tactileDesc: '雙面細緻消光霧膜，防潑水耐磨，色彩沉穩不反光',
    bestFor: '商業名片、品牌海報、精緻紀念卡片（設計師最推薦）',
    isPopular: true
  },
  {
    id: '150g-art',
    name: '150P 經濟亮面銅版紙',
    weightGsm: 150,
    tactileDesc: '光滑亮面高平滑度，墨色鮮豔對比強烈，紙張輕薄',
    bestFor: '商業傳單、展場派發海報、活動大量宣傳品'
  },
  {
    id: '300g-ivory',
    name: '300P 頂級厚磅象牙卡',
    weightGsm: 300,
    tactileDesc: '無塗佈溫潤手感，微米吸墨自然柔和，厚實具分量感',
    bestFor: '藝術水彩、插畫明信片、文創酷卡、手寫祝福卡'
  },
  {
    id: '220g-linen',
    name: '220P 日本萊妮紙',
    weightGsm: 220,
    tactileDesc: '表面具細密立體十字編織布紋，典雅復古文藝氣息',
    bestFor: '個人藝術名片、古典水墨插畫、證書邀請卡'
  },
  {
    id: 'sticker-gloss',
    name: '特黏亮膜模切貼紙',
    weightGsm: 90,
    tactileDesc: '超黏底膠＋表面覆亮光保護膜，防刮抗污耐磨損',
    bestFor: '二次元模切貼紙、商品包裝封口標籤、筆電行李箱貼'
  }
];

export const VENDOR_PRINT_SHOPS: PrintShopVendor[] = [
  {
    id: 'gainhow',
    name: '健豪印刷 (Gainhow)',
    shortName: '健豪',
    brandTag: '全台最大合版龍頭',
    description: '自動化大型印刷基地，大量合版價格全台最低，品質穩定',
    leadTimeBaseDays: 2,
    onlineUploadUrl: 'https://www.gainhow.tw/',
    features: ['線上直接拋單傳檔', '全台門市自取免運', '支援大批次合版輪轉']
  },
  {
    id: 'cardhome',
    name: '卡之屋 (CardHome)',
    shortName: '卡之屋',
    brandTag: '名片與特殊紙材專家',
    description: '老字號專業名片/酷卡印刷，紙材庫最齊全，校色嚴謹',
    leadTimeBaseDays: 2,
    onlineUploadUrl: 'https://www.cardhome.com.tw/',
    features: ['特殊紙材在庫豐富', '線上自動檢檔系統', '色彩管理嚴格']
  },
  {
    id: 'classic',
    name: '經典數位印刷 (Classic Print)',
    shortName: '經典數位',
    brandTag: '急件當日直出名店',
    description: '市中心捷運門市，主打少量多樣與急件快速取件服務',
    leadTimeBaseDays: 1,
    onlineUploadUrl: 'https://www.classicprint.com.tw/',
    features: ['最快當日/1小時急件', '現場門市即時對色打樣', '少量10張起印友善']
  },
  {
    id: 'lange',
    name: '藍格印刷 (Lange)',
    shortName: '藍格',
    brandTag: '超高 CP 值代表',
    description: '北部知名合版印刷廠，大量名片、DM 印刷極致平價',
    leadTimeBaseDays: 3,
    onlineUploadUrl: 'https://www.lange.com.tw/',
    features: ['超低起印門檻', '標準合版高性價比', '大台北固定配送點']
  }
];

export const STANDARD_QUANTITY_TIERS = [10, 20, 50, 100, 200, 500, 1000];

/**
 * Estimated Taiwan commercial print pricing formula
 *
 * This is a synthetic estimate (fixed base rate × hand-tuned multipliers below), not a live quote
 * pulled from any vendor's real price list or API — no network call is made. Treat the numbers as
 * a rough planning reference; actual vendor pricing may differ.
 */
export class PrintPricingEngine {
  /**
   * Calculate an estimated quote for given print specifications (synthetic formula, not a live vendor price)
   */
  public static calculateQuote(
    shopId: string,
    presetId: PrintPresetId,
    paperId: string,
    quantity: number
  ): PrintQuoteResult {
    const shop = VENDOR_PRINT_SHOPS.find((s) => s.id === shopId) || VENDOR_PRINT_SHOPS[0];
    const paper = COMMERCIAL_PAPER_OPTIONS.find((p) => p.id === paperId) || COMMERCIAL_PAPER_OPTIONS[0];

    let presetNameZh = 'A4 經典海報';
    let baseRate = 1.0; // multiplier based on size

    switch (presetId) {
      case 'poster-a4':
        presetNameZh = 'A4 經典海報 (210×297mm)';
        baseRate = 1.0;
        break;
      case 'poster-a3':
        presetNameZh = 'A3 展覽大圖 (297×420mm)';
        baseRate = 1.85;
        break;
      case 'postcard':
        presetNameZh = '藝術明信片 (148×100mm)';
        baseRate = 0.55;
        break;
      case 'business-card':
        presetNameZh = '商業名片 (90×54mm)';
        baseRate = 0.35;
        break;
      case 'sticker':
        presetNameZh = '模切貼紙 (50×50mm)';
        baseRate = 0.45;
        break;
      case 'social':
      default:
        presetNameZh = 'A4 數位打樣 (210×297mm)';
        baseRate = 1.0;
        break;
    }

    // Paper multiplier
    let paperRate = 1.0;
    if (paper.id === '250g-matte') paperRate = 1.15;
    else if (paper.id === '300g-ivory') paperRate = 1.25;
    else if (paper.id === '220g-linen') paperRate = 1.35;
    else if (paper.id === 'sticker-gloss') paperRate = 1.4;

    // Shop vendor pricing formula
    let shopStartupFee = 80;
    let shopUnitCurve = 1.0;
    let leadTimeDays = shop.leadTimeBaseDays;

    if (shop.id === 'gainhow') {
      shopStartupFee = 70;
      shopUnitCurve = 0.9;
    } else if (shop.id === 'classic') {
      shopStartupFee = 120; // higher setup for fast turnaround
      shopUnitCurve = 1.2;
      leadTimeDays = quantity <= 50 ? 1 : 2;
    } else if (shop.id === 'cardhome') {
      shopStartupFee = 90;
      shopUnitCurve = 1.0;
    } else if (shop.id === 'lange') {
      shopStartupFee = 60;
      shopUnitCurve = 0.85;
      leadTimeDays = 3;
    }

    // Volume tier discount curve (合版規模經濟)
    let volumeDiscount = 1.0;
    if (quantity >= 1000) volumeDiscount = 0.25;
    else if (quantity >= 500) volumeDiscount = 0.35;
    else if (quantity >= 200) volumeDiscount = 0.5;
    else if (quantity >= 100) volumeDiscount = 0.65;
    else if (quantity >= 50) volumeDiscount = 0.8;
    else if (quantity >= 20) volumeDiscount = 0.92;

    const rawUnitCost = 8.5 * baseRate * paperRate * shopUnitCurve * volumeDiscount;
    const calcTotal = Math.round(shopStartupFee + rawUnitCost * quantity);
    const totalPriceNTD = Math.max(90, calcTotal);
    const unitPriceNTD = parseFloat((totalPriceNTD / quantity).toFixed(1));

    const isBestValue = quantity === 100 || quantity === 500;

    const notes: string[] = [];
    if (quantity >= 100) {
      notes.push('已達合版印刷優惠門檻，平均單張成本大幅下降');
    }
    if (shop.id === 'classic' && quantity <= 50) {
      notes.push('支援台北/台中市區門市急件當日快速取件');
    }
    if (paper.id === '250g-matte') {
      notes.push('含雙面霧膜防潑水後加工');
    }

    let leadTimeFormatted = `約 ${leadTimeDays} 個工作天出貨`;
    if (leadTimeDays === 1) {
      leadTimeFormatted = '最快當日 ~ 1 個工作天可取件 (急件)';
    }

    return {
      shopId: shop.id,
      shopName: shop.name,
      presetId,
      presetNameZh,
      paperId: paper.id,
      paperName: paper.name,
      quantity,
      totalPriceNTD,
      unitPriceNTD,
      leadTimeDays,
      leadTimeFormatted,
      isBestValue,
      notes
    };
  }

  /**
   * Get all paper options with their current pricing preview for a given quantity
   */
  public static getQuotesForAllPapers(
    shopId: string,
    presetId: PrintPresetId,
    quantity: number
  ): Array<CommercialPaperOption & { quote: PrintQuoteResult }> {
    return COMMERCIAL_PAPER_OPTIONS.map((paper) => {
      const quote = this.calculateQuote(shopId, presetId, paper.id, quantity);
      return {
        ...paper,
        quote
      };
    });
  }
}
