import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import {
  CONVENIENCE_STORE_SPECS,
  ConvenienceStoreEngine,
  type ConveniencePrintSpec,
  type ConvenienceCloudOrder
} from '../core/convenience-store';

/**
 * 🏪 7-ELEVEN ibon & 全家 FamiPort 雲端立印互動彈窗 (支援一鍵取件碼 & QR 產生)
 */
export class ConveniencePrintModal {
  private modalEl: HTMLElement;
  private selectedStore: '7-11' | 'familymart' = '7-11';
  private selectedSpecId: string = '711-photo-4x6';
  private isGenerating = false;
  private currentCloudOrder: ConvenienceCloudOrder | null = null;

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

    const currentSpec = CONVENIENCE_STORE_SPECS.find((s) => s.id === this.selectedSpecId) || CONVENIENCE_STORE_SPECS[0];
    this.currentCloudOrder = ConvenienceStoreEngine.generateCloudOrder(currentSpec);

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

    if (!this.currentCloudOrder || this.currentCloudOrder.spec.id !== currentSpec.id) {
      this.currentCloudOrder = ConvenienceStoreEngine.generateCloudOrder(currentSpec);
    }

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

    const order = this.currentCloudOrder;

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-conv-dialog" style="max-width: 680px;">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">🏪 超商雲端 30 秒立印中心</span>
            <span class="pm-modal-subtitle">自動符合超商列印規範，支援 8 碼取件碼與專屬 300 DPI 實體出機</span>
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

          <!-- Live Cloud Ticket Box (即時取件小卡) -->
          <div style="margin-top: 14px; background: linear-gradient(135deg, rgba(0, 113, 227, 0.06) 0%, rgba(52, 199, 89, 0.06) 100%); border: 1.5px solid rgba(0, 113, 227, 0.2); border-radius: 12px; padding: 14px 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
                <span>🎫</span> ${currentSpec.storeName} 即時取件憑證
              </span>
              <span style="font-size: 0.72rem; color: #0071e3; font-weight: 600; background: rgba(0,113,227,0.1); padding: 2px 8px; border-radius: 10px;">
                有效期限：${order?.expireTime || '72小時'}
              </span>
            </div>

            <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
              <!-- QR Code Thumbnail -->
              <div style="background: #ffffff; padding: 6px; border-radius: 10px; border: 1px solid var(--pm-border-subtle); display: flex; flex-direction: column; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <img src="${order?.qrDataUrl || ''}" alt="超商取件 QR Code" style="width: 100px; height: 100px; display: block;" />
                <span style="font-size: 0.65rem; color: var(--pm-text-muted); margin-top: 4px;">機台直接掃描</span>
              </div>

              <!-- Pickup Details -->
              <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: baseline; gap: 8px;">
                  <span style="font-size: 0.76rem; color: var(--pm-text-secondary);">8 碼取件碼：</span>
                  <strong style="font-size: 1.25rem; letter-spacing: 0.08em; color: var(--pm-text-primary); font-family: monospace;">${order?.pickupPin || ''}</strong>
                  <button id="btnCopyPin" class="pm-btn pm-btn-xs pm-btn-ghost" style="padding: 2px 6px; font-size: 0.7rem;">📋 複製</button>
                </div>
                <div style="font-size: 0.75rem; color: var(--pm-text-secondary); line-height: 1.4;">
                  項目：<strong>${currentSpec.paperType}</strong> · 費用：<strong>NT$ ${currentSpec.priceNTD}</strong>
                </div>
                <div style="font-size: 0.72rem; color: var(--pm-text-muted);">
                  💡 下樓到任何一家 ${currentSpec.storeName} 機台，點「列印」輸入代碼或掃描即可。
                </div>
              </div>
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

          <!-- Physical Machine 3-Step Guide -->
          <div style="background: rgba(0, 0, 0, 0.02); border: 1px dashed var(--pm-border-subtle); border-radius: 12px; padding: 14px; margin-top: 14px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--pm-text-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>💡</span> 到了超商機台前怎麼印？（新手 30 秒 3 步操作圖解）
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; font-size: 0.76rem; color: var(--pm-text-secondary); line-height: 1.45;">
              <div style="background: #ffffff; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--pm-border-light); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <strong style="color: var(--pm-text-primary); display: block; margin-bottom: 3px;">① 點選機台首頁</strong>
                在機台螢幕首頁點選<strong>「列印 / 掃描」</strong>按鈕
              </div>
              <div style="background: #ffffff; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--pm-border-light); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <strong style="color: var(--pm-text-primary); display: block; margin-bottom: 3px;">② 選擇雲端列印</strong>
                點選<strong>「${this.selectedStore === '7-11' ? 'ibon 文件列印' : 'FamiPort 雲端列印'}」</strong>
              </div>
              <div style="background: #ffffff; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--pm-border-light); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <strong style="color: var(--pm-text-primary); display: block; margin-bottom: 3px;">③ 掃描或輸入代碼</strong>
                對準條碼掃描器<strong>掃描上方 QR Code</strong>（或輸入 8 位數取件碼），投幣即印！
              </div>
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

    // Copy PIN button
    this.modalEl.querySelector('#btnCopyPin')?.addEventListener('click', () => {
      if (this.currentCloudOrder?.pickupPin && navigator.clipboard) {
        void navigator.clipboard.writeText(this.currentCloudOrder.pickupPin.replace('-', ''));
        SoundEffects.sliderTick();
        Toast.success(`✓ 已複製取件碼 ${this.currentCloudOrder.pickupPin}！`);
      }
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
