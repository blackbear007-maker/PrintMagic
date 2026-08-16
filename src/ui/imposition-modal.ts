import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { ImpositionEngine, type ImpositionLayout } from '../core/imposition-engine';

/**
 * 🧩 智慧自動拼模 (A4/A3 Gang-Run Imposition) 互動彈窗
 */
export class ImpositionModal {
  private modalEl: HTMLElement;
  private sheetPreset: 'A4' | 'A3' = 'A4';
  private isRepeatSingle = true;
  private layout: ImpositionLayout | null = null;
  private currentCanvas: HTMLCanvasElement | null = null;
  private isGenerating = false;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.id = 'impositionModal';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  public async open(): Promise<void> {
    const state = store.getState();
    const activeImg = state.processedImageData || state.originalImageData;
    if (!activeImg) {
      Toast.error('請先上傳圖片');
      return;
    }

    SoundEffects.sliderTick();
    this.modalEl.style.display = 'flex';
    await this.updateAndRender();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }

  private async updateAndRender(): Promise<void> {
    const state = store.getState();
    const preset = state.currentPreset;

    const itemWMm = preset.widthMm > 0 ? preset.widthMm : 90;
    const itemHMm = preset.heightMm > 0 ? preset.heightMm : 54;

    this.layout = ImpositionEngine.calculateLayout(itemWMm, itemHMm, this.sheetPreset);

    const items: ImageData[] = [];
    if (!this.isRepeatSingle && state.batchItems.length > 1) {
      state.batchItems.forEach((b) => {
        if (b.processedImageData || b.originalImageData) {
          items.push(b.processedImageData || b.originalImageData!);
        }
      });
    } else {
      const active = state.processedImageData || state.originalImageData;
      if (active) items.push(active);
    }

    this.currentCanvas = await ImpositionEngine.generateImpositionCanvas(
      items,
      this.layout,
      this.isRepeatSingle
    );

    this.render();
  }

  private render(): void {
    if (!this.layout || !this.currentCanvas) return;

    const previewDataUrl = this.currentCanvas.toDataURL('image/jpeg', 0.85);

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-imposition-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">🧩 智慧自動拼模引擎 (A4 / A3 拼版)</span>
            <span class="pm-modal-subtitle">將名片、貼紙或明信片自動排列鋪滿一張紙，印一張抵多張，現省高達 ${this.layout.costSavingsPercent}% 印刷費！</span>
          </div>
          <button class="pm-modal-close" id="btnImpositionClose">✕</button>
        </div>

        <div class="pm-imposition-body">
          <!-- Controls Row -->
          <div class="pm-imposition-controls-bar">
            <!-- Sheet Size Selector -->
            <div class="pm-toggle-group">
              <span class="pm-preset-label">拼版紙張：</span>
              <button class="pm-tool-btn ${this.sheetPreset === 'A4' ? 'active' : ''}" data-sheet="A4">
                📄 A4 紙張 (210×297mm)
              </button>
              <button class="pm-tool-btn ${this.sheetPreset === 'A3' ? 'active' : ''}" data-sheet="A3">
                🖼️ A3 大紙 (297×420mm)
              </button>
            </div>

            <!-- Mode Selector -->
            <div class="pm-toggle-group">
              <span class="pm-preset-label">拼排模式：</span>
              <button class="pm-tool-btn ${this.isRepeatSingle ? 'active' : ''}" data-mode="single">
                🔁 單圖自動鋪滿 (${this.layout.totalCells} 模)
              </button>
              <button class="pm-tool-btn ${!this.isRepeatSingle ? 'active' : ''}" data-mode="multi">
                📚 批次多圖混拼
              </button>
            </div>
          </div>

          <!-- Live Sheet Preview -->
          <div class="pm-imposition-preview-stage">
            <img src="${previewDataUrl}" alt="拼模預覽" class="pm-imposition-sheet-img" />
          </div>

          <!-- Bottom Action Summary Card -->
          <div class="pm-pricing-summary-card">
            <div class="pm-summary-left">
              <div class="pm-summary-price-group">
                <span class="pm-summary-currency">一張 ${this.layout.sheetPreset} 可拼</span>
                <span class="pm-summary-amount">${this.layout.totalCells}</span>
                <span class="pm-summary-tax">模 (${this.layout.cols} 列 × ${this.layout.rows} 行)</span>
              </div>
              <div class="pm-summary-unit-price">
                ✓ 包含 0.1mm 裁切十字線與 3mm 安全間距 · 印刷成本立省 <strong>${this.layout.costSavingsPercent}%</strong>！
              </div>
            </div>

            <div class="pm-summary-right-actions">
              <button id="btnDownloadImpositionPdf" class="pm-btn pm-btn-artisan pm-btn-lg" ${this.isGenerating ? 'disabled' : ''}>
                <span>${this.isGenerating ? '⏳' : '📄'}</span>
                <span>${this.isGenerating ? '正在輸出 PDF...' : `下載 ${this.layout.sheetPreset} 拼模標準 PDF`}</span>
              </button>
              <button id="btnDownloadImpositionPng" class="pm-btn pm-btn-secondary pm-btn-md">
                <span>📥</span> 下載 300 DPI 拼模圖 (PNG)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Close button
    this.modalEl.querySelector('#btnImpositionClose')?.addEventListener('click', () => {
      this.close();
    });

    // Sheet switch
    this.modalEl.querySelectorAll('[data-sheet]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sheet = (btn as HTMLElement).dataset.sheet as 'A4' | 'A3';
        if (sheet && sheet !== this.sheetPreset) {
          this.sheetPreset = sheet;
          SoundEffects.sliderTick();
          await this.updateAndRender();
        }
      });
    });

    // Mode switch
    this.modalEl.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mode = (btn as HTMLElement).dataset.mode;
        const isSingle = mode === 'single';
        if (isSingle !== this.isRepeatSingle) {
          this.isRepeatSingle = isSingle;
          SoundEffects.sliderTick();
          await this.updateAndRender();
        }
      });
    });

    // Download PDF
    this.modalEl.querySelector('#btnDownloadImpositionPdf')?.addEventListener('click', async () => {
      if (!this.currentCanvas || !this.layout) return;
      this.isGenerating = true;
      this.render();

      try {
        SoundEffects.shutterClick();
        Toast.info(`🔄 正在匯出 ${this.layout.sheetPreset} 拼模標準 PDF...`);

        const pdfBlob = await ImpositionEngine.generateImpositionPdf(this.currentCanvas, this.sheetPreset);
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.download = `PrintMagic_Imposition_${this.sheetPreset}_${this.layout.totalCells}Cells_${Date.now()}.pdf`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        Toast.success(`✓ ${this.layout.sheetPreset} 拼模標準 PDF 已下載完成！`);
      } catch (err: any) {
        Toast.error(`匯出 PDF 失敗: ${err?.message || err}`);
      } finally {
        this.isGenerating = false;
        this.render();
      }
    });

    // Download PNG
    this.modalEl.querySelector('#btnDownloadImpositionPng')?.addEventListener('click', () => {
      if (!this.currentCanvas || !this.layout) return;
      SoundEffects.shutterClick();
      const url = this.currentCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `PrintMagic_Imposition_${this.sheetPreset}_${this.layout.totalCells}Cells_${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      Toast.success('✓ 300 DPI 拼模 PNG 檔案已下載！');
    });
  }
}
