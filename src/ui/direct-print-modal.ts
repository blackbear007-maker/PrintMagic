import {
  VENDOR_PRINT_SHOPS,
  COMMERCIAL_PAPER_OPTIONS,
  STANDARD_QUANTITY_TIERS,
  PrintPricingEngine,
  type PrintQuoteResult
} from '../core/print-pricing';
import { OrderPackageGenerator } from '../core/order-package';
import { PdfExporter } from '../engines/pdf-exporter';
import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';

export class DirectPrintModal {
  private modalEl: HTMLElement;
  private selectedShopId = 'gainhow';
  private selectedPaperId = '250g-matte';
  private selectedQuantity = 50;
  private isPackaging = false;
  private onOpenShopsMap?: () => void;

  constructor(onOpenShopsMap?: () => void) {
    this.onOpenShopsMap = onOpenShopsMap;
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);

    this.bindEvents();
  }

  public open(): void {
    const state = store.getState();
    if (!state.originalDataUrl && !state.processedDataUrl) {
      Toast.info('💡 請先上傳圖片後再進行送印估價');
      return;
    }

    this.render();
    this.modalEl.style.display = 'flex';
    requestAnimationFrame(() => this.modalEl.classList.add('pm-modal-open'));
    SoundEffects.sliderTick();
  }

  public hide(): void {
    this.modalEl.classList.remove('pm-modal-open');
    setTimeout(() => {
      this.modalEl.style.display = 'none';
    }, 250);
  }

  private getCurrentQuote(): PrintQuoteResult {
    const state = store.getState();
    return PrintPricingEngine.calculateQuote(
      this.selectedShopId,
      state.currentPreset.id,
      this.selectedPaperId,
      this.selectedQuantity
    );
  }

  private render(): void {
    const state = store.getState();
    const preset = state.currentPreset;
    const quote = this.getCurrentQuote();
    const currentShop = VENDOR_PRINT_SHOPS.find((s) => s.id === this.selectedShopId) || VENDOR_PRINT_SHOPS[0];

    // 1. Shop Tabs
    const shopTabsHtml = VENDOR_PRINT_SHOPS.map((shop) => {
      const active = shop.id === this.selectedShopId ? 'active' : '';
      return `
        <button class="pm-pricing-shop-tab ${active}" data-shop-id="${shop.id}">
          <span class="pm-shop-tab-title">${shop.shortName}</span>
          <span class="pm-shop-tab-tag">${shop.brandTag}</span>
        </button>
      `;
    }).join('');

    // 2. Paper Options
    const paperCardsHtml = COMMERCIAL_PAPER_OPTIONS.map((paper) => {
      const active = paper.id === this.selectedPaperId ? 'active' : '';
      const popBadge = paper.isPopular ? '<span class="pm-paper-pop-badge">★ 設計師推薦</span>' : '';
      return `
        <div class="pm-pricing-paper-card ${active}" data-paper-id="${paper.id}">
          <div class="pm-paper-card-header">
            <span class="pm-paper-card-name">${paper.name}</span>
            ${popBadge}
          </div>
          <p class="pm-paper-card-tactile">${paper.tactileDesc}</p>
          <div class="pm-paper-card-best">${paper.bestFor}</div>
        </div>
      `;
    }).join('');

    // 3. Quantity Tiers
    const quantityButtonsHtml = STANDARD_QUANTITY_TIERS.map((qty) => {
      const active = qty === this.selectedQuantity ? 'active' : '';
      const bestValueBadge = (qty === 100 || qty === 500) ? '<span class="pm-qty-badge">超值</span>' : '';
      return `
        <button class="pm-pricing-qty-btn ${active}" data-qty="${qty}">
          <span>${qty} 張</span>
          ${bestValueBadge}
        </button>
      `;
    }).join('');

    // 4. Notes
    const notesHtml = quote.notes.map((n) => `<li>• ${n}</li>`).join('');

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-direct-print-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">🏭 台灣在地印刷廠一鍵估價與直通送印</span>
            <span class="pm-modal-subtitle">已整合【${preset.nameZh}】標準規格，估算四大合版廠參考價格並打包標準工單（估價公式，非即時串接廠商報價）</span>
          </div>
          <button class="pm-modal-close" id="btnDirectPrintClose">✕</button>
        </div>

        <!-- 3-Step Beginner Guide -->
        <div class="pm-print-guide-steps">
          <div class="pm-guide-step-item">
            <span class="pm-guide-num">①</span>
            <span class="pm-guide-txt">挑選印廠與數量</span>
          </div>
          <div class="pm-guide-arrow">➔</div>
          <div class="pm-guide-step-item">
            <span class="pm-guide-num">②</span>
            <span class="pm-guide-txt">下載送印封包 (ZIP)</span>
          </div>
          <div class="pm-guide-arrow">➔</div>
          <div class="pm-guide-step-item">
            <span class="pm-guide-num">③</span>
            <span class="pm-guide-txt">前往印廠線上傳檔</span>
          </div>
        </div>

        <div class="pm-pricing-body">
          <!-- Step 1: Shop Selection -->
          <div class="pm-pricing-section">
            <label class="pm-pricing-label">
              <span class="pm-step-badge">1</span> 選擇指定送印廠商
            </label>
            <div class="pm-pricing-shops-grid">
              ${shopTabsHtml}
            </div>
            <div class="pm-pricing-shop-desc">
              ℹ️ <strong>${currentShop.name}</strong>：${currentShop.description}
            </div>
          </div>

          <!-- Step 2: Paper Selection -->
          <div class="pm-pricing-section">
            <label class="pm-pricing-label">
              <span class="pm-step-badge">2</span> 選擇印製紙材與後加工
            </label>
            <div class="pm-pricing-papers-grid">
              ${paperCardsHtml}
            </div>
          </div>

          <!-- Step 3: Quantity Selection -->
          <div class="pm-pricing-section">
            <label class="pm-pricing-label">
              <span class="pm-step-badge">3</span> 選擇印製數量
            </label>
            <div class="pm-pricing-qty-row">
              ${quantityButtonsHtml}
            </div>
          </div>

          <!-- Live Price Summary Card -->
          <div class="pm-pricing-summary-card">
            <div class="pm-summary-left">
              <div class="pm-summary-price-group">
                <span class="pm-summary-currency">NT$</span>
                <span class="pm-summary-amount">${quote.totalPriceNTD}</span>
                <span class="pm-summary-tax">元 (含稅預估)</span>
              </div>
              <div class="pm-summary-unit-price">
                平均每張約 <strong>NT$ ${quote.unitPriceNTD}</strong> 元 · 預計交期：<strong>${quote.leadTimeFormatted}</strong>
              </div>
              ${notesHtml ? `<ul class="pm-summary-notes">${notesHtml}</ul>` : ''}
            </div>

            <div class="pm-summary-right-actions">
              <button id="btnDownloadOrderPackage" class="pm-btn pm-btn-artisan pm-btn-lg" ${this.isPackaging ? 'disabled' : ''}>
                <span>${this.isPackaging ? '⏳' : '📦'}</span>
                <span>${this.isPackaging ? '正在打包工單封包中...' : '一鍵打包送印工單 (ZIP)'}</span>
              </button>
            </div>
          </div>

          <!-- Secondary Action Bar -->
          <div class="pm-pricing-secondary-bar">
            <button id="btnCopyPrintSpec" class="pm-btn pm-btn-ghost pm-btn-sm" title="複製完整規格備註，直接貼在店家下單備註或 LINE 官方帳號">
              <span>📋</span> 複製送印備註 (LINE/官網專用)
            </button>
            <a href="${currentShop.onlineUploadUrl}" target="_blank" rel="noopener noreferrer" class="pm-btn pm-btn-secondary pm-btn-sm" title="前往該印刷廠官網線上傳檔系統">
              <span>🌐</span> 直通【${currentShop.shortName}】官網傳檔 ↗
            </a>
            <button id="btnOpenNearbyShops" class="pm-btn pm-btn-ghost pm-btn-sm" title="查看周邊門市 Google Maps 導航">
              <span>📍</span> 查詢全台門市地圖
            </button>
          </div>
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnDirectPrintDone">關閉</button>
        </div>
      </div>
    `;

    this.bindDynamicEvents();
  }

  private bindEvents(): void {
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });
  }

  private bindDynamicEvents(): void {
    this.modalEl.querySelector('#btnDirectPrintClose')?.addEventListener('click', () => this.hide());
    this.modalEl.querySelector('#btnDirectPrintDone')?.addEventListener('click', () => this.hide());

    // 1. Shop Tabs Click
    this.modalEl.querySelectorAll<HTMLButtonElement>('.pm-pricing-shop-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.dataset.shopId;
        if (id) {
          this.selectedShopId = id;
          SoundEffects.sliderTick();
          this.render();
        }
      });
    });

    // 2. Paper Card Click
    this.modalEl.querySelectorAll<HTMLElement>('.pm-pricing-paper-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.paperId;
        if (id) {
          this.selectedPaperId = id;
          SoundEffects.paperDrop();
          this.render();
        }
      });
    });

    // 3. Quantity Button Click
    this.modalEl.querySelectorAll<HTMLButtonElement>('.pm-pricing-qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qty = parseInt(btn.dataset.qty || '50', 10);
        this.selectedQuantity = qty;
        SoundEffects.sliderTick();
        this.render();
      });
    });

    // 4. Download Order Package ZIP
    this.modalEl.querySelector('#btnDownloadOrderPackage')?.addEventListener('click', async () => {
      await this.handleDownloadPackage();
    });

    // 5. Copy Spec Text
    this.modalEl.querySelector('#btnCopyPrintSpec')?.addEventListener('click', () => {
      const state = store.getState();
      const quote = this.getCurrentQuote();
      const specText = OrderPackageGenerator.generateCopyableSpec(state, quote);

      navigator.clipboard.writeText(specText).then(() => {
        Toast.success('✓ 已成功複製送印備註小抄！可直接貼於店家官網或 LINE 官方帳號');
        SoundEffects.shutterClick();
      }).catch(() => {
        Toast.info(specText);
      });
    });

    // 6. Open Nearby Shops Map
    this.modalEl.querySelector('#btnOpenNearbyShops')?.addEventListener('click', () => {
      this.hide();
      if (this.onOpenShopsMap) {
        this.onOpenShopsMap();
      }
    });
  }

  private async handleDownloadPackage(): Promise<void> {
    const state = store.getState();
    const dataUrl = state.processedDataUrl || state.originalDataUrl;
    if (!dataUrl) {
      Toast.error('未找到可匯出之圖像資料');
      return;
    }

    this.isPackaging = true;
    this.render();

    try {
      Toast.info('📦 正在生成標準印刷 PDF 並打包工單封包...');

      // 1. Generate PDF Data Url
      const activeBatch = state.batchItems.find((b) => b.id === state.activeBatchId);
      const artworkName = activeBatch ? activeBatch.name : 'Artwork';
      const dummyFilename = `temp_${Date.now()}.pdf`;

      const pdfDataUrl = await PdfExporter.exportToDataUrl(
        dataUrl,
        state.currentPreset,
        dummyFilename,
        state.cropAnchor
      );

      // 2. Build ZIP Package
      const quote = this.getCurrentQuote();
      const packageResult = await OrderPackageGenerator.createOrderZip(
        pdfDataUrl,
        state,
        quote,
        artworkName
      );

      // 3. Trigger Download
      const url = URL.createObjectURL(packageResult.zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = packageResult.zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      SoundEffects.purityChime();
      Toast.success(`✓ 已成功下載【${quote.shopName}】專屬送印封包 (${packageResult.zipFilename})！內含標準 PDF 與 PrintPass 檢驗護照。`);
    } catch (err: any) {
      console.error('Package download error:', err);
      Toast.error(`工單打包失敗: ${err?.message || '未知錯誤'}`);
    } finally {
      this.isPackaging = false;
      this.render();
    }
  }
}
