import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import {
  CONVENIENCE_STORE_SPECS,
  ConvenienceStoreEngine,
  type ConveniencePrintSpec
} from '../core/convenience-store';

/**
 * 🏪 7-ELEVEN ibon & 全家 FamiPort 雲端立印互動彈窗
 */
export class ConveniencePrintModal {
  private modalEl: HTMLElement;
  private selectedStore: '7-11' | 'familymart' = '7-11';
  private selectedSpecId: string = '711-photo-4x6';
  private isGenerating = false;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.id = 'conveniencePrintModal';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  public open(): void {
    const state = store.getState();
    if (!state.processedImageData && !state.originalImageData) {
      Toast.error('請先上傳圖片');
      return;
    }

    SoundEffects.sliderTick();
    this.render();
    this.modalEl.style.display = 'flex';
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }

  private render(): void {
    const availableSpecs = CONVENIENCE_STORE_SPECS.filter(
      (s) => s.store === this.selectedStore
    );

    // If current selected spec doesn't match selected store, default to first available
    if (!availableSpecs.some((s) => s.id === this.selectedSpecId)) {
      this.selectedSpecId = availableSpecs[0].id;
    }

    const currentSpec = CONVENIENCE_STORE_SPECS.find(
      (s) => s.id === this.selectedSpecId
    )!;

    const storeTabsHtml = `
      <div class="pm-conv-store-tabs">
        <button class="pm-conv-store-btn ${this.selectedStore === '7-11' ? 'active store-711' : ''}" data-store="7-11">
          <span>🏪</span> 7-ELEVEN ibon (全國 6,800+ 門市)
        </button>
        <button class="pm-conv-store-btn ${this.selectedStore === 'familymart' ? 'active store-fami' : ''}" data-store="familymart">
          <span>🏬</span> 全家 FamiPort (全國 4,200+ 門市)
        </button>
      </div>
    `;

    const specCardsHtml = availableSpecs
      .map((spec) => {
        const isSelected = spec.id === this.selectedSpecId;
        return `
          <div class="pm-conv-spec-card ${isSelected ? 'active' : ''}" data-spec="${spec.id}">
            <div class="pm-conv-card-header">
              <span class="pm-conv-paper-title">${spec.paperType}</span>
              <span class="pm-conv-price-tag">NT$ ${spec.priceNTD} / 張</span>
            </div>
            <div class="pm-conv-size-text">
              📐 實體尺寸：${spec.widthMm} × ${spec.heightMm} mm (300 DPI)
            </div>
            <div class="pm-conv-desc-text">${spec.description}</div>
            <div class="pm-conv-rec-badge">💡 推薦：${spec.recommendedFor}</div>
          </div>
        `;
      })
      .join('');

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-conv-modal-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">🏪 巷口超商 30 秒雲端立印 (7-11 / 全家)</span>
            <span class="pm-modal-subtitle">只想印 1~2 張試看樣？自動適配超商機台 300 DPI 滿版規格，下樓即可取件！</span>
          </div>
          <button class="pm-modal-close" id="btnConvClose">✕</button>
        </div>

        <!-- 3-Step Simple Guide -->
        <div class="pm-print-guide-steps">
          <div class="pm-guide-step-item">
            <span class="pm-guide-num">①</span>
            <span class="pm-guide-txt">選擇超商與紙材</span>
          </div>
          <div class="pm-guide-arrow">➔</div>
          <div class="pm-guide-step-item">
            <span class="pm-guide-num">②</span>
            <span class="pm-guide-txt">下載超商專用檔 (JPG)</span>
          </div>
          <div class="pm-guide-arrow">➔</div>
          <div class="pm-guide-step-item">
            <span class="pm-guide-num">③</span>
            <span class="pm-guide-txt">上傳官網拿取件碼/QR碼</span>
          </div>
        </div>

        <div class="pm-conv-body">
          <!-- Store Selector -->
          <div class="pm-conv-section">
            <label class="pm-pricing-label">
              <span class="pm-step-badge">1</span> 選擇超商體系
            </label>
            ${storeTabsHtml}
          </div>

          <!-- Paper Spec Selector -->
          <div class="pm-conv-section">
            <label class="pm-pricing-label">
              <span class="pm-step-badge">2</span> 選擇印製紙材與尺寸
            </label>
            <div class="pm-conv-specs-grid">
              ${specCardsHtml}
            </div>
          </div>

          <!-- Price & Action Summary -->
          <div class="pm-pricing-summary-card">
            <div class="pm-summary-left">
              <div class="pm-summary-price-group">
                <span class="pm-summary-currency">單張僅需 NT$</span>
                <span class="pm-summary-amount">${currentSpec.priceNTD}</span>
                <span class="pm-summary-tax">元 · ${currentSpec.paperType}</span>
              </div>
              <div class="pm-summary-unit-price">
                ✓ 已自動補足 ${currentSpec.nonPrintableMarginMm}mm 機台防白邊裁切保護 · 100% 符合 ${currentSpec.storeName} 印表機規範
              </div>
            </div>

            <div class="pm-summary-right-actions">
              <button id="btnDownloadConvFile" class="pm-btn pm-btn-artisan pm-btn-lg" ${this.isGenerating ? 'disabled' : ''}>
                <span>${this.isGenerating ? '⏳' : '📥'}</span>
                <span>${this.isGenerating ? '正在生成 300 DPI 專用圖...' : '下載超商專用列印檔 (JPG)'}</span>
              </button>
            </div>
          </div>

          <!-- Direct Upload Gateway Buttons -->
          <div class="pm-conv-gateways">
            <a href="${currentSpec.uploadUrl}" target="_blank" rel="noopener noreferrer" class="pm-btn pm-btn-secondary pm-btn-md">
              <span>🚀</span> 前往 ${currentSpec.storeName} 雲端上傳頁面 (取得列印碼) ➔
            </a>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(currentSpec);
  }

  private bindEvents(currentSpec: ConveniencePrintSpec): void {
    // Close button
    this.modalEl.querySelector('#btnConvClose')?.addEventListener('click', () => {
      this.close();
    });

    // Store switch tabs
    this.modalEl.querySelectorAll('.pm-conv-store-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const storeType = (btn as HTMLElement).dataset.store as '7-11' | 'familymart';
        if (storeType && storeType !== this.selectedStore) {
          this.selectedStore = storeType;
          SoundEffects.sliderTick();
          this.render();
        }
      });
    });

    // Spec card clicks
    this.modalEl.querySelectorAll('.pm-conv-spec-card').forEach((card) => {
      card.addEventListener('click', () => {
        const specId = (card as HTMLElement).dataset.spec;
        if (specId && specId !== this.selectedSpecId) {
          this.selectedSpecId = specId;
          SoundEffects.sliderTick();
          this.render();
        }
      });
    });

    // Download button
    this.modalEl.querySelector('#btnDownloadConvFile')?.addEventListener('click', async () => {
      const state = store.getState();
      const imgData = state.processedImageData || state.originalImageData;
      if (!imgData) return;

      this.isGenerating = true;
      this.render();

      try {
        SoundEffects.shutterClick();
        Toast.info(`🔄 正在為您生成符合 ${currentSpec.storeName} 規範之 300 DPI 檔案...`);

        const blob = await ConvenienceStoreEngine.generatePrintBlob(imgData, currentSpec);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `PrintMagic_${currentSpec.store}_${currentSpec.id}_${Date.now()}.jpg`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        Toast.success(`✓ ${currentSpec.storeName} 專用圖檔下載完成！請至官網上傳取得列印碼。`);
      } catch (err: any) {
        Toast.error(`生成失敗: ${err?.message || err}`);
      } finally {
        this.isGenerating = false;
        this.render();
      }
    });
  }
}
