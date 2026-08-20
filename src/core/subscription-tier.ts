/**
 * PrintMagic Subscription & Commercial Tier Management
 * Free (NT$ 0) | Pro (NT$ 399/mo) | VIP (NT$ 699/mo)
 */

export type SubscriptionPlanId = 'free' | 'pro' | 'vip';

export interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  nameZh: string;
  badge: string;
  priceMonthly: number;
  currency: string;
  period: string;
  tagline: string;
  isPopular?: boolean;
  features: PlanFeature[];
  maxBatchSize: number;
  pdfxExportAllowed: boolean;
  doubleSidedAllowed: boolean;
  dielineAllowed: boolean;
  impositionAllowed: boolean;
  vipAiAllowed: boolean;
  bleedExpanderAllowed: boolean;
  aiMattingAllowed: boolean;
  aiVectorizerAllowed: boolean;
  pipelineCustomizerAllowed: boolean;
  monthlyAiQuota: number;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Consumer Free',
    nameZh: '大眾免費版',
    badge: 'FREE',
    priceMonthly: 0,
    currency: 'NT$',
    period: '/ 永久免費',
    tagline: '適合學生、個人創作者與超商快印',
    features: [
      { text: '100% 離線本機 8x 金字塔超解析度 (0.1s)', included: true },
      { text: '單圖極速優化與 CMYK 溢墨檢測', included: true },
      { text: '7-11 ibon / 全家 FamiPort 雲端列印碼', included: true },
      { text: '每日 3 次標準單面裁切線 PDF 輸出', included: true },
      { text: '多圖批次連續製版', included: false },
      { text: '雙面合版關聯製版 (名片/明信片/DM)', included: false },
      { text: '自動造型刀模 + 0.2mm 內縮白墨', included: false },
      { text: 'A4/A3 拼版試算 (省 80% 印刷費)', included: false },
      { text: '🎛️ 專家級印前管線逐項開關自訂', included: false },
      { text: '🖼️ AI 智慧 3mm 出血外擴延伸', included: false },
      { text: '✂️ 髮絲級 AI 模切貼紙去背', included: false },
      { text: '✒️ AI 點陣轉真向量 SVG 貝茲曲線', included: false },
      { text: '💎 VIP 高階商業 AI 影像重建引擎', included: false }
    ],
    maxBatchSize: 1,
    pdfxExportAllowed: false,
    doubleSidedAllowed: false,
    dielineAllowed: false,
    impositionAllowed: false,
    vipAiAllowed: false,
    bleedExpanderAllowed: false,
    aiMattingAllowed: false,
    aiVectorizerAllowed: false,
    pipelineCustomizerAllowed: false,
    monthlyAiQuota: 0
  },
  {
    id: 'pro',
    name: 'Pro Designer',
    nameZh: '專業設計師版',
    badge: '👑 PRO',
    priceMonthly: 399,
    currency: 'NT$',
    period: '/ 月',
    tagline: '專為接案設計師與中小型品牌打造 (每月 500 點)',
    isPopular: true,
    features: [
      { text: '包含免費版全部功能', included: true },
      { text: '🎛️ 專家印前管線逐項開關自訂 (放大/銳化/控墨/階調)', included: true, highlight: true },
      { text: '每月 500 點 AI 算力點數', included: true, highlight: true },
      { text: '20 張多圖批次連續製版', included: true, highlight: true },
      { text: '雙面合版關聯製版 (名片/明信片/DM)', included: true, highlight: true },
      { text: '自動造型刀模 + 0.2mm 內縮白墨 (防溢白)', included: true, highlight: true },
      { text: 'A4/A3 拼版試算 (省 80% 印刷費)', included: true, highlight: true },
      { text: '✂️ 髮絲級 AI 模切貼紙去背 (含白墨刀模)', included: true, highlight: true },
      { text: 'ISO 15930-1 工業級 PDF/X-1a 出機檔', included: true },
      { text: '國際 ICC 描述檔 (Japan Color / ISO FOGRA)', included: true },
      { text: 'K100 純黑字與向量 Logo 疊印層', included: true },
      { text: '免費開源 Real-ESRGAN / Anime6B 雲端運算', included: true },
      { text: '💎 VIP 高階商業 8K / 出血外擴 / 向量化', included: false }
    ],
    maxBatchSize: 20,
    pdfxExportAllowed: true,
    doubleSidedAllowed: true,
    dielineAllowed: true,
    impositionAllowed: true,
    vipAiAllowed: false,
    bleedExpanderAllowed: false,
    aiMattingAllowed: true,
    aiVectorizerAllowed: false,
    pipelineCustomizerAllowed: true,
    monthlyAiQuota: 500
  },
  {
    id: 'vip',
    name: 'VIP Enterprise Studio',
    nameZh: 'VIP 頂級企業版',
    badge: '💎 VIP',
    priceMonthly: 699,
    currency: 'NT$',
    period: '/ 月',
    tagline: '廣告事務所、品牌總監與巨幅展覽專用 (每月 1000 點)',
    features: [
      { text: '包含 Pro 版全部功能', included: true },
      { text: '🎛️ 專家印前管線逐項開關自訂 (放大/銳化/控墨/階調)', included: true, highlight: true },
      { text: '每月 1000 點高階 GPU 算力點數', included: true, highlight: true },
      { text: '🖼️ AI 智慧 3mm 出血外擴延伸 (解決裁切痛點)', included: true, highlight: true },
      { text: '✒️ AI 點陣圖轉真向量 SVG/EPS 貝茲曲線檔', included: true, highlight: true },
      { text: '✂️ 髮絲級 AI 模切貼紙去背 Pro (超清 Alpha)', included: true, highlight: true },
      { text: '💎 Fal.ai Clarity 8K 神經網路細節超重構', included: true, highlight: true },
      { text: '💎 Topaz Photo AI 商業級攝影保真去模糊', included: true, highlight: true },
      { text: '💎 Replicate Anime6B 向量高精銳化 Pro', included: true, highlight: true },
      { text: '無限多圖批次連續製版 (最高 100 張)', included: true },
      { text: '印刷廠一件送印與專屬客服通道', included: true }
    ],
    maxBatchSize: 100,
    pdfxExportAllowed: true,
    doubleSidedAllowed: true,
    dielineAllowed: true,
    impositionAllowed: true,
    vipAiAllowed: true,
    bleedExpanderAllowed: true,
    aiMattingAllowed: true,
    aiVectorizerAllowed: true,
    pipelineCustomizerAllowed: true,
    monthlyAiQuota: 1000
  }
];

export interface UserSubscriptionState {
  planId: SubscriptionPlanId;
  planName: string;
  monthlyQuotaRemaining: number;
  expiresAt: string | null;
  isSubscribed: boolean;
}

export class SubscriptionManager {
  private static readonly STORAGE_KEY = 'printmagic_subscription_plan';
  private static readonly QUOTA_KEY = 'printmagic_ai_quota_used';

  /**
   * Growth Phase Flag: Unlock 100% of Pro and VIP features for free
   */
  public static readonly ALL_FREE_UNLOCKED = true;

  public static getCurrentPlanId(): SubscriptionPlanId {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.STORAGE_KEY) as SubscriptionPlanId;
      if (saved && ['free', 'pro', 'vip'].includes(saved)) {
        return saved;
      }
    }
    return 'free';
  }

  public static getPlan(planId: SubscriptionPlanId = this.getCurrentPlanId()): SubscriptionPlan {
    return SUBSCRIPTION_PLANS.find((p) => p.id === planId) || SUBSCRIPTION_PLANS[0];
  }

  public static setPlan(planId: SubscriptionPlanId): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, planId);
    }
  }

  public static getQuotaUsed(): number {
    if (typeof localStorage !== 'undefined') {
      const val = parseInt(localStorage.getItem(this.QUOTA_KEY) || '0', 10);
      return isNaN(val) ? 0 : val;
    }
    return 0;
  }

  public static consumeQuota(count: number = 1): boolean {
    if (this.ALL_FREE_UNLOCKED) {
      if (typeof localStorage !== 'undefined') {
        const used = this.getQuotaUsed();
        localStorage.setItem(this.QUOTA_KEY, (used + count).toString());
      }
      return true; // Unlimited quota in free unlocked mode
    }

    const plan = this.getPlan();
    if (plan.id === 'free') return false;

    const used = this.getQuotaUsed();
    if (used + count > plan.monthlyAiQuota) {
      return false; // Quota exceeded
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.QUOTA_KEY, (used + count).toString());
    }
    return true;
  }

  public static getSubscriptionState(): UserSubscriptionState {
    if (this.ALL_FREE_UNLOCKED) {
      return {
        planId: 'free',
        planName: '全功能開放體驗 (限時免費)',
        monthlyQuotaRemaining: 99999,
        expiresAt: '2026-12-31',
        isSubscribed: true
      };
    }

    const plan = this.getPlan();
    const used = this.getQuotaUsed();
    const remaining = Math.max(0, plan.monthlyAiQuota - used);

    return {
      planId: plan.id,
      planName: plan.nameZh,
      monthlyQuotaRemaining: remaining,
      expiresAt: plan.id === 'free' ? null : '2026-12-31',
      isSubscribed: plan.id !== 'free'
    };
  }

  public static canUseFeature(
    feature: 'doubleSided' | 'dieline' | 'imposition' | 'pdfx' | 'vipAi' | 'batch' | 'bleedExpander' | 'aiMatting' | 'aiVectorizer' | 'pipelineCustomizer'
  ): boolean {
    if (this.ALL_FREE_UNLOCKED) {
      return true; // Unlock all features for free
    }

    const plan = this.getPlan();
    switch (feature) {
      case 'doubleSided':
        return plan.doubleSidedAllowed;
      case 'dieline':
        return plan.dielineAllowed;
      case 'imposition':
        return plan.impositionAllowed;
      case 'pdfx':
        return plan.pdfxExportAllowed;
      case 'vipAi':
        return plan.vipAiAllowed;
      case 'bleedExpander':
        return plan.bleedExpanderAllowed;
      case 'aiMatting':
        return plan.aiMattingAllowed;
      case 'aiVectorizer':
        return plan.aiVectorizerAllowed;
      case 'pipelineCustomizer':
        return plan.pipelineCustomizerAllowed;
      case 'batch':
        return plan.maxBatchSize > 1;
      default:
        return true;
    }
  }
}
