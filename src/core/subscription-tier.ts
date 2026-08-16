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
      { text: 'ISO 15930-1 工業級 PDF/X-1a 出機檔', included: false },
      { text: '💎 VIP 高階商業 AI 影像重建引擎', included: false }
    ],
    maxBatchSize: 1,
    pdfxExportAllowed: false,
    doubleSidedAllowed: false,
    dielineAllowed: false,
    impositionAllowed: false,
    vipAiAllowed: false,
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
    tagline: '專為接案設計師與中小型品牌打造',
    isPopular: true,
    features: [
      { text: '包含免費版全部功能', included: true },
      { text: '20 張多圖批次連續製版', included: true, highlight: true },
      { text: '雙面合版關聯製版 (名片/明信片/DM)', included: true, highlight: true },
      { text: '自動造型刀模 + 0.2mm 內縮白墨 (防溢白)', included: true, highlight: true },
      { text: 'A4/A3 拼版試算 (省 80% 印刷費)', included: true, highlight: true },
      { text: 'ISO 15930-1 工業級 PDF/X-1a 出機檔', included: true, highlight: true },
      { text: '國際 ICC 描述檔 (Japan Color / ISO FOGRA)', included: true },
      { text: 'K100 純黑字與向量 Logo 疊印層', included: true },
      { text: '免費開源 Real-ESRGAN / Anime6B 雲端運算', included: true },
      { text: '💎 VIP 高階商業 AI 影像重建引擎', included: false }
    ],
    maxBatchSize: 20,
    pdfxExportAllowed: true,
    doubleSidedAllowed: true,
    dielineAllowed: true,
    impositionAllowed: true,
    vipAiAllowed: false,
    monthlyAiQuota: 100
  },
  {
    id: 'vip',
    name: 'VIP Enterprise Studio',
    nameZh: 'VIP 頂級企業版',
    badge: '💎 VIP',
    priceMonthly: 699,
    currency: 'NT$',
    period: '/ 月',
    tagline: '廣告事務所、品牌總監與巨幅展覽專用',
    features: [
      { text: '包含 Pro 版全部功能', included: true },
      { text: '💎 解鎖 Fal.ai Clarity 8K 神經網路細節超重構', included: true, highlight: true },
      { text: '💎 解鎖 Topaz Photo AI 商業級攝影保真去模糊', included: true, highlight: true },
      { text: '💎 解鎖 Replicate Anime6B 向量高精銳化 Pro', included: true, highlight: true },
      { text: '每月 500 張高階付費 GPU 專屬無佇列通道', included: true, highlight: true },
      { text: '無限多圖批次連續製版 (最高 100 張)', included: true },
      { text: '印刷廠一件送印與專屬客服通道', included: true },
      { text: '多螢幕 3D 燙金打樣視圖', included: true }
    ],
    maxBatchSize: 100,
    pdfxExportAllowed: true,
    doubleSidedAllowed: true,
    dielineAllowed: true,
    impositionAllowed: true,
    vipAiAllowed: true,
    monthlyAiQuota: 500
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

  public static canUseFeature(feature: 'doubleSided' | 'dieline' | 'imposition' | 'pdfx' | 'vipAi' | 'batch'): boolean {
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
      case 'batch':
        return plan.maxBatchSize > 1;
      default:
        return true;
    }
  }
}
