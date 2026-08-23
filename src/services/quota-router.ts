/**
 * 🔀 Smart Multi-Provider Quota & Quality Router (全領域智慧多引擎額度與品質路由系統)
 * 
 * Manages 8 core pre-press optimization categories with 24+ cloud & local provider nodes:
 * 1. AI Super-Resolution & Face Detail (超解析度與五官修復)
 * 2. Background Removal & Alpha Matting (髮絲級去背與透明通道)
 * 3. Object Erasing & Content-Aware Inpainting (物件消除與智慧補圖)
 * 4. Bitmap to Vector SVG Tracing (向量化與刀模路徑提取)
 * 5. Low-Light & Shadow Enhancement (暗部階調與色彩動態強化)
 * 6. Smart Saliency & Print Aspect Cropping (智慧焦點與印刷規格自動裁切)
 * 7. Text OCR & Multi-Language Proofreading (文字識別與多國語法校對)
 * 8. Convenience Store & Nearby Print Map (超商列印與鄰近印刷廠圖資)
 * 
 * Core Switching Rules:
 * - Highest Quality (qualityScore 100 ➔ 0) comes first.
 * - Auto-switch when remaining quota <= 10% or on HTTP 429/402/timeout.
 * - 100% Zero-Friction Seamless Fallback to Local Unlimited Engine.
 */

export type EngineCategory =
  | 'upscale'
  | 'matting'
  | 'inpainting'
  | 'vectorize'
  | 'lowlight'
  | 'crop'
  | 'ocr'
  | 'geo';

export interface ProviderQuotaConfig {
  id: string;
  category: EngineCategory;
  name: string;
  provider: string;
  qualityScore: number; // 0 ~ 100 (Higher is prioritized)
  totalQuota: number; // monthly or rate quota limit
  usedQuota: number;
  isLocalUnlimited?: boolean;
  status: 'optimal' | 'low_quota' | 'exhausted' | 'rate_limited' | 'error';
  lastUsedTimestamp?: number;
  avgLatencyMs?: number;
  description: string;
}

export interface QuotaRouterState {
  providers: Record<string, ProviderQuotaConfig>;
  lastResetMonth: number;
}

export class QuotaRouter {
  private static readonly STORAGE_KEY = 'printmagic_quota_state_v2';
  private static state: QuotaRouterState = QuotaRouter.loadInitialState();

  public static readonly CATEGORY_NAMES: Record<EngineCategory, { name: string; icon: string; desc: string }> = {
    upscale: { name: '畫質超解析度與五官修復', icon: '🌐', desc: '4x 細節紋理重建與動漫/人像修復' },
    matting: { name: '髮絲級去背與透明遮罩', icon: '✂️', desc: '壓克力吊飾與貼紙透明通道提取' },
    inpainting: { name: 'AI 物件消除與智慧補圖', icon: '🎨', desc: '去除浮水印、路人、摺痕與污漬' },
    vectorize: { name: '點陣圖轉純向量 SVG', icon: '📐', desc: '貝茲曲線分層與貼紙刀模線提取' },
    lowlight: { name: '暗部透亮與低光源色彩補償', icon: '💡', desc: '防止暗部死黑糊成一團與過曝保護' },
    crop: { name: '智慧焦點與規格自動裁切', icon: '🖼️', desc: '人類視覺注視點與印刷安全邊距構圖' },
    ocr: { name: '文字辨識與多國語法校對', icon: '🔤', desc: '文字轉 K100 向量與錯別字即時標註' },
    geo: { name: '超商列印與全台印刷廠圖資', icon: '🏪', desc: '7-11/全家取件碼與附近印刷行 GPS' }
  };

  private static getDefaultProviders(): Record<string, ProviderQuotaConfig> {
    return {
      // ════════ 1. AI Super-Resolution & Face Detail ════════
      'upscale-real-esrgan': {
        id: 'upscale-real-esrgan',
        category: 'upscale',
        name: 'Real-ESRGAN 4x+ 通用高清',
        provider: 'Hugging Face Free Inference',
        qualityScore: 98,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '極致畫質與微觀紋理重建，攝影人像與 3D 最優'
      },
      'upscale-codeformer': {
        id: 'upscale-codeformer',
        category: 'upscale',
        name: 'CodeFormer 人像五官高清修復',
        provider: 'HF Serverless REST',
        qualityScore: 96,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '專精老照片、模糊五官、眼神與髮絲銳化'
      },
      'upscale-anime6b': {
        id: 'upscale-anime6b',
        category: 'upscale',
        name: 'Real-ESRGAN Anime6B 動漫插畫',
        provider: 'Hugging Face Mirror',
        qualityScore: 94,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '專為同人周邊、向量線條與模切貼紙優化'
      },
      'upscale-waifu2x': {
        id: 'upscale-waifu2x',
        category: 'upscale',
        name: 'Waifu2x 降噪平滑引擎',
        provider: 'Gradio Space Public Mirror',
        qualityScore: 88,
        totalQuota: 200,
        usedQuota: 0,
        status: 'optimal',
        description: '消除 JPEG 區塊假影並強化輪廓平滑'
      },
      'upscale-local-pyramid': {
        id: 'upscale-local-pyramid',
        category: 'upscale',
        name: '本機 8x 金字塔 Lanczos-3 引擎',
        provider: 'Client-Side Pure CPU/GPU',
        qualityScore: 82,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: '100% 離線極速 0.1 秒渲染，無限額度零延遲'
      },

      // ════════ 2. Background Removal & Alpha Matting (100% Open-Source Commercial) ════════
      'matting-birefnet': {
        id: 'matting-birefnet',
        category: 'matting',
        name: 'BiRefNet 高解析度雙向去背 (Apache 2.0)',
        provider: 'Open Source Serverless (Apache 2.0)',
        qualityScore: 99,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '2024 SOTA 級婚紗、髮絲與眼鏡透明邊界提取，極致銳利'
      },
      'matting-inspyrenet': {
        id: 'matting-inspyrenet',
        category: 'matting',
        name: 'InSPyReNet 金字塔重構去背 (MIT)',
        provider: 'Transparent-Background Engine (MIT)',
        qualityScore: 96,
        totalQuota: 250,
        usedQuota: 0,
        status: 'optimal',
        description: '商品、立牌與文創小物主體高速精準分離'
      },
      'matting-modnet': {
        id: 'matting-modnet',
        category: 'matting',
        name: 'MODNet-Lite 即時髮絲去背 (Apache 2.0)',
        provider: 'PyTorch Unified AI Suite (Apache 2.0)',
        qualityScore: 94,
        totalQuota: 500,
        usedQuota: 0,
        status: 'optimal',
        description: '人像立牌與動漫角色無目標快速透明通道'
      },
      'matting-isnet': {
        id: 'matting-isnet',
        category: 'matting',
        name: 'DIS / IS-Net 複雜極限去背 (Apache 2.0)',
        provider: 'DIS5K Industrial Engine (Apache 2.0)',
        qualityScore: 92,
        totalQuota: 250,
        usedQuota: 0,
        status: 'optimal',
        description: '腳踏車輪輻、珠寶、蕾絲與極限鏤空物件提取'
      },
      'matting-local': {
        id: 'matting-local',
        category: 'matting',
        name: 'U2Net-P / 本機 0ms 離線去背 (Apache 2.0)',
        provider: 'Client-Side Canvas & Saliency (Apache 2.0)',
        qualityScore: 88,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: '純本機 0ms 離線去背，100% 隱私無任何外部網路連線'
      },

      // ════════ 3. Object Erasing & Inpainting ════════
      'inpainting-lama': {
        id: 'inpainting-lama',
        category: 'inpainting',
        name: 'LaMa 傅立葉大遮罩修復',
        provider: 'Hugging Face Free API',
        qualityScore: 98,
        totalQuota: 200,
        usedQuota: 0,
        status: 'optimal',
        description: '完美消除浮水印、雜物與摺痕，背景紋理自然縫合'
      },
      'inpainting-mat': {
        id: 'inpainting-mat',
        category: 'inpainting',
        name: 'MAT (Mask-Aware Transformer)',
        provider: 'HF Space Serverless',
        qualityScore: 93,
        totalQuota: 150,
        usedQuota: 0,
        status: 'optimal',
        description: '大面積污漬與複雜幾何背景結構重建'
      },
      'inpainting-patchmatch': {
        id: 'inpainting-patchmatch',
        category: 'inpainting',
        name: 'Fast PatchMatch 紋理生成',
        provider: 'Open Mirror REST',
        qualityScore: 88,
        totalQuota: 200,
        usedQuota: 0,
        status: 'optimal',
        description: '快速修補小瑕疵、灰塵與雜點'
      },
      'inpainting-local': {
        id: 'inpainting-local',
        category: 'inpainting',
        name: '本機 Navier-Stokes 畫布修復',
        provider: 'Client-Side Canvas Inpainter',
        qualityScore: 82,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: '純前端 0ms 即刷即補，離線安全無限制'
      },

      // ════════ 4. Bitmap to Vector SVG ════════
      'vectorize-vtracer': {
        id: 'vectorize-vtracer',
        category: 'vectorize',
        name: 'VTracer 貝茲高精度向量化',
        provider: 'VTracer Serverless API',
        qualityScore: 97,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '平滑曲線擬合與色彩分層，LOGO 與貼紙刀模最佳'
      },
      'vectorize-svgcode': {
        id: 'vectorize-svgcode',
        category: 'vectorize',
        name: 'SVGCode 向量輪廓提取器',
        provider: 'SVGCode Open API',
        qualityScore: 93,
        totalQuota: 200,
        usedQuota: 0,
        status: 'optimal',
        description: '平滑單色/多色向量輪廓與圖層分離'
      },
      'vectorize-autotrace': {
        id: 'vectorize-autotrace',
        category: 'vectorize',
        name: 'AutoTrace 多邊形向量引擎',
        provider: 'Open AutoTrace Mirror',
        qualityScore: 91,
        totalQuota: 250,
        usedQuota: 0,
        status: 'optimal',
        description: '幾何路徑提取與單色向量字型輪廓生成'
      },
      'vectorize-local-potrace': {
        id: 'vectorize-local-potrace',
        category: 'vectorize',
        name: '本機 Potrace TS 向量引擎',
        provider: 'Client-Side Potrace Engine',
        qualityScore: 85,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: '100% 離線純本機 SVG 向量轉換'
      },

      // ════════ 5. Low-Light & Shadow Enhancement ════════
      'lowlight-retinexformer': {
        id: 'lowlight-retinexformer',
        category: 'lowlight',
        name: 'Retinexformer 暗部透亮引擎',
        provider: 'Hugging Face Free API',
        qualityScore: 96,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '挽救暗部死黑，印刷不黑成一團，亮部過曝保護'
      },
      'lowlight-zero-dce': {
        id: 'lowlight-zero-dce',
        category: 'lowlight',
        name: 'Zero-DCE++ 零參考曝光平衡',
        provider: 'HF Serverless Mirror',
        qualityScore: 91,
        totalQuota: 250,
        usedQuota: 0,
        status: 'optimal',
        description: '輕量即時光影曲線調整，保留真實色彩動態'
      },
      'lowlight-enlightengan': {
        id: 'lowlight-enlightengan',
        category: 'lowlight',
        name: 'EnlightenGAN 自然光影修復',
        provider: 'EnlightenGAN Open REST',
        qualityScore: 89,
        totalQuota: 200,
        usedQuota: 0,
        status: 'optimal',
        description: '補償暗部對比並維持低噪點'
      },
      'lowlight-local-shadowlift': {
        id: 'lowlight-local-shadowlift',
        category: 'lowlight',
        name: '本機 Lab 非線性 ShadowLift',
        provider: 'Client-Side Color Science',
        qualityScore: 85,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: 'Lab 亮度軸三次多項式浮起補償，純本機 0ms'
      },

      // ════════ 6. Smart Saliency Cropping (100% Open Source) ════════
      'crop-nanodet-plus': {
        id: 'crop-nanodet-plus',
        category: 'crop',
        name: 'NanoDet-Plus 焦點主體與注視點偵測 (Apache 2.0)',
        provider: 'PyTorch Light Vision (Apache 2.0)',
        qualityScore: 98,
        totalQuota: 1000,
        usedQuota: 0,
        status: 'optimal',
        description: '精確計算主體注視點與人物頭部安全邊界，防止被印刷裁切刀切除'
      },
      'crop-deepsaliency': {
        id: 'crop-deepsaliency',
        category: 'crop',
        name: 'DeepSaliency 黃金構圖建議',
        provider: 'HF Space Public API',
        qualityScore: 92,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '熱力圖三等分黃金法則構圖框'
      },
      'crop-face-detector': {
        id: 'crop-face-detector',
        category: 'crop',
        name: 'AI 人像臉部焦點優先構圖',
        provider: 'MediaPipe Free Saliency',
        qualityScore: 90,
        totalQuota: 300,
        usedQuota: 0,
        status: 'optimal',
        description: '自動偵測人物頭部安全邊界，防止被印刷裁切刀切除'
      },
      'crop-local-saliency': {
        id: 'crop-local-saliency',
        category: 'crop',
        name: '本機邊緣能量九方位構圖儀',
        provider: 'Client-Side Framing Engine',
        qualityScore: 84,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: '純本機 Sobel 邊緣能量與安全邊距防切字'
      },

      // ════════ 7. Text OCR & Multi-Language Proofreading (100% Open Source) ════════
      'ocr-ppocr-v4': {
        id: 'ocr-ppocr-v4',
        category: 'ocr',
        name: 'PP-OCRv4 繁中高精文字辨識 (Apache 2.0)',
        provider: 'PaddleOCR Engine (Apache 2.0)',
        qualityScore: 99,
        totalQuota: 2000,
        usedQuota: 0,
        status: 'optimal',
        description: '繁體中文、日文、英文與商標文字精確定位，一鍵轉 K100 純黑向量'
      },
      'ocr-space': {
        id: 'ocr-space',
        category: 'ocr',
        name: 'OCR.space 免費大量文字通道',
        provider: 'OCR.space Free API',
        qualityScore: 92,
        totalQuota: 25000,
        usedQuota: 0,
        status: 'optimal',
        description: '超大額度備用 OCR 通道，支援繁中與英文'
      },
      'ocr-languagetool': {
        id: 'ocr-languagetool',
        category: 'ocr',
        name: 'LanguageTool 語法與拼寫校對',
        provider: 'LanguageTool Free API',
        qualityScore: 92,
        totalQuota: 500,
        usedQuota: 0,
        status: 'optimal',
        description: '繁中/英/日文錯別字即時標註與潤飾'
      },
      'ocr-local-contrast': {
        id: 'ocr-local-contrast',
        category: 'ocr',
        name: '本機高對比向量定位 + 印刷字典',
        provider: 'Client-Side OCR Engine',
        qualityScore: 85,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: '內建常用印刷字典與 Levenshtein 模糊比對'
      },

      // ════════ 8. Convenience Store & Nearby Print Map ════════
      'geo-osm-overpass': {
        id: 'geo-osm-overpass',
        category: 'geo',
        name: 'OpenStreetMap Overpass API',
        provider: 'OSM Open Data (Free)',
        qualityScore: 98,
        totalQuota: 10000,
        usedQuota: 0,
        status: 'optimal',
        description: '即時查詢全台 7-11、全家、萊爾富與專業印刷行座標'
      },
      'geo-nominatim': {
        id: 'geo-nominatim',
        category: 'geo',
        name: 'Nominatim 逆向地理編碼',
        provider: 'OSM Nominatim (Free)',
        qualityScore: 95,
        totalQuota: 5000,
        usedQuota: 0,
        status: 'optimal',
        description: 'GPS 經緯度反查台灣路名與行政區'
      },
      'geo-photon': {
        id: 'geo-photon',
        category: 'geo',
        name: 'Photon 快速地點搜尋引擎',
        provider: 'Komoot OSM Photon (Free)',
        qualityScore: 93,
        totalQuota: 5000,
        usedQuota: 0,
        status: 'optimal',
        description: '高容錯模糊搜尋全台影印店與連鎖輸出中心'
      },
      'geo-local-db': {
        id: 'geo-local-db',
        category: 'geo',
        name: '本機 Haversine 距離 + 離線工廠庫',
        provider: 'Client-Side Geolocation DB',
        qualityScore: 88,
        totalQuota: 999999,
        usedQuota: 0,
        isLocalUnlimited: true,
        status: 'optimal',
        description: '內建全台 120+ 家知名合版印刷廠與超商實體經緯度'
      }
    };
  }

  private static loadInitialState(): QuotaRouterState {
    const currentMonth = new Date().getMonth();
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.providers) {
            if (parsed.lastResetMonth !== currentMonth) {
              const defaults = this.getDefaultProviders();
              return { providers: defaults, lastResetMonth: currentMonth };
            }
            // Merge with latest schema defaults in case new providers were introduced
            const defaults = this.getDefaultProviders();
            const merged = { ...defaults, ...parsed.providers };
            return { providers: merged, lastResetMonth: currentMonth };
          }
        }
      } catch {
        // use default
      }
    }
    return {
      providers: this.getDefaultProviders(),
      lastResetMonth: currentMonth
    };
  }

  private static saveState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // ignore
      }
    }
  }

  /**
   * Get all provider configs for a category, sorted by Quality descending
   */
  public static getProviders(category: EngineCategory): ProviderQuotaConfig[] {
    return Object.values(this.state.providers)
      .filter((p) => p.category === category)
      .sort((a, b) => b.qualityScore - a.qualityScore);
  }

  /**
   * Get the best active provider based on:
   * 1. Privacy Shield status (if active, force 100% local unlimited provider)
   * 2. Highest qualityScore
   * 3. Remaining quota > 10%
   * 4. Status is optimal (with 10-minute auto-recovery cooldown from rate limits)
   */
  public static getBestProvider(category: EngineCategory): ProviderQuotaConfig {
    const providers = this.getProviders(category);
    const localProvider = providers[providers.length - 1];

    // 1. Privacy Shield Check: Force local offline processing
    if (typeof localStorage !== 'undefined' && localStorage.getItem('printmagic_privacy_shield_active') === 'true') {
      return localProvider;
    }

    const now = Date.now();

    for (const p of providers) {
      if (p.isLocalUnlimited) return p;

      // Auto cooldown recovery for rate_limited providers after 10 mins
      if (p.status === 'rate_limited' && p.lastUsedTimestamp && now - p.lastUsedTimestamp > 600000) {
        p.status = 'optimal';
      }

      const remainingPct = this.getRemainingPercent(p);
      const isAvailable = remainingPct > 10 && p.status !== 'exhausted' && p.status !== 'rate_limited' && p.status !== 'error';

      if (isAvailable) {
        return p;
      }
    }

    // Default to local unlimited provider (last item in array)
    return localProvider;
  }

  /**
   * Calculate remaining quota percentage
   */
  public static getRemainingPercent(provider: ProviderQuotaConfig): number {
    if (provider.isLocalUnlimited) return 100;
    const remaining = Math.max(0, provider.totalQuota - provider.usedQuota);
    return Math.round((remaining / provider.totalQuota) * 100);
  }

  /**
   * Record a successful request usage
   */
  public static recordUsage(providerId: string, latencyMs?: number): void {
    const provider = this.state.providers[providerId];
    if (!provider) return;

    if (!provider.isLocalUnlimited) {
      provider.usedQuota += 1;
      const remainingPct = this.getRemainingPercent(provider);
      if (remainingPct <= 0) {
        provider.status = 'exhausted';
      } else if (remainingPct <= 10) {
        provider.status = 'low_quota';
      } else {
        provider.status = 'optimal';
      }
    }

    provider.lastUsedTimestamp = Date.now();
    if (latencyMs !== undefined) {
      provider.avgLatencyMs = provider.avgLatencyMs
        ? Math.round(provider.avgLatencyMs * 0.7 + latencyMs * 0.3)
        : latencyMs;
    }

    this.saveState();
  }

  /**
   * Record provider error (e.g. 429 Too Many Requests or Network Timeout)
   */
  public static recordFailure(providerId: string, isRateLimit = false): void {
    const provider = this.state.providers[providerId];
    if (!provider) return;

    provider.status = isRateLimit ? 'rate_limited' : 'error';
    this.saveState();
  }

  /**
   * Reset quota counter for a provider (or all providers)
   */
  public static resetQuota(providerId?: string): void {
    if (providerId && this.state.providers[providerId]) {
      this.state.providers[providerId].usedQuota = 0;
      this.state.providers[providerId].status = 'optimal';
    } else {
      this.state.providers = this.getDefaultProviders();
    }
    this.saveState();
  }

  /**
   * Return full router state for UI dashboard
   */
  public static getState(): QuotaRouterState {
    return this.state;
  }
}
