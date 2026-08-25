import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import {
  CONVENIENCE_STORE_SPECS,
  ConvenienceStoreEngine,
  type ConveniencePrintSpec
} from '../core/convenience-store';

/**
 * 🏪 7-ELEVEN ibon & 全家 FamiPort 超商列印檔案產生器
 *
 * There is no real pickup-code/QR order feature here — this app has no access to 7-11/FamiPort's
 * order systems. What it actually does: generates a correctly-sized 300 DPI file for the chosen
 * paper spec, and links to the store's real official upload website (where you get a real pickup
 * code from them). An earlier version fabricated an 8-digit PIN and a QR image from Math.random()
 * — neither was ever submitted anywhere or scannable — that's been removed.
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
            <div class="pm-conv-desc-text">
              ${spec.description}
            </div>
            <div class="pm-conv-rec-tag">
              💡 推薦：${spec.recommendedFor}
            </div>
          </div>
        `;
      })
      .join('');

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-conv-dialog" style="max-width: 680px;">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">🏪 超商列印檔案產生器</span>
            <span class="pm-modal-subtitle">自動符合超商列印規範，產生專屬 300 DPI 實體出機檔</span>
          </div>
          <button class="pm-modal-close" id="btnConvClose">✕</button>
        </div>

        <div class="pm-conv-body" style="padding: 16px 20px;">
          ${storeTabsHtml}

          <div class="pm-conv-section">
            <label class="pm-pricing-label">選擇列印紙材規格：</label>
            <div class="pm-conv-specs-grid">
              ${specCardsHtml}
            </div>
          </div>

          <!-- Summary & Download Direct Print File -->
          <div class="pm-conv-summary-box" style="margin-top: 14px;">
            <div class="pm-summary-left">
              <div class="pm-summary-price-row">
                <span class="pm-summary-total-label">實體單張費用：</span>
                <span class="pm-summary-total-price">NT$ ${currentSpec.priceNTD}</span>
              </div>
            </div>

            <div class="pm-summary-right-actions">
              <button id="btnDownloadConvFile" class="pm-btn pm-btn-artisan pm-btn-lg" ${this.isGenerating ? 'disabled' : ''}>
                <span>${this.isGenerating ? '⏳' : '📥'}</span>
                <span>${this.isGenerating ? '正在生成 300 DPI 專用圖...' : '下載超商專用列印檔 (JPG)'}</span>
              </button>
            </div>
          </div>

          <!-- Honest 2-Step Guide -->
          <div style="background: rgba(0, 0, 0, 0.02); border: 1px dashed var(--pm-border-subtle); border-radius: 12px; padding: 14px; margin-top: 14px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--pm-text-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>💡</span> 怎麼實際印出來？
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; font-size: 0.76rem; color: var(--pm-text-secondary); line-height: 1.45;">
              <div style="background: #ffffff; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--pm-border-light); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <strong style="color: var(--pm-text-primary); display: block; margin-bottom: 3px;">① 下載檔案</strong>
                點上方按鈕下載已排版好的 300 DPI JPG
              </div>
              <div style="background: #ffffff; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--pm-border-light); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <strong style="color: var(--pm-text-primary); display: block; margin-bottom: 3px;">② 用官方管道上傳</strong>
                前往下方 ${currentSpec.storeName} 官方雲端上傳頁面上傳此檔案，取得真正的取件碼；或存到隨身碟直接插入機台選擇上傳
              </div>
            </div>
            <div style="font-size: 0.68rem; color: var(--pm-text-muted); margin-top: 8px;">
              本工具不會、也無法幫你送出訂單或產生取件碼——取件碼一定要透過 ${currentSpec.storeName} 自己的網站/App 才能拿到。
            </div>
          </div>

          <!-- Direct Upload Gateway Buttons -->
          <div class="pm-conv-gateways" style="margin-top: 14px;">
            <a href="${currentSpec.uploadUrl}" target="_blank" rel="noopener noreferrer" class="pm-btn pm-btn-secondary pm-btn-md">
              <span>🚀</span> 前往 ${currentSpec.storeName} 官方雲端上傳頁面 ➔
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

        Toast.success(`✓ ${currentSpec.storeName} 專用圖檔下載完成！`);
      } catch (err: any) {
        Toast.error(`生成失敗: ${err?.message || err}`);
      } finally {
        this.isGenerating = false;
        this.render();
      }
    });
  }
}
