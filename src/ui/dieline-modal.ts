import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { DielineEngine, type DielineOutput } from '../core/dieline-engine';

/**
 * ✂️ 智慧造型刀模 (CutContour) 與白墨層 (White Ink Choke) 互動彈窗
 */
export class DielineModal {
  private modalEl: HTMLElement;
  private currentOutput: DielineOutput | null = null;
  private activeView: 'composite' | 'white' | 'cut' | 'cmyk' = 'composite';

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.id = 'dielineModal';
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
    const imgData = state.processedImageData || state.originalImageData;
    if (!imgData) {
      Toast.error('請先上傳圖片');
      return;
    }

    SoundEffects.sliderTick();
    this.currentOutput = DielineEngine.generateLayers(imgData);
    this.render();
    this.modalEl.style.display = 'flex';
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }

  private render(): void {
    if (!this.currentOutput) return;

    let activeDataUrl = '';
    if (this.activeView === 'composite') {
      activeDataUrl = this.currentOutput.compositeCanvas.toDataURL('image/png');
    } else if (this.activeView === 'white') {
      activeDataUrl = this.currentOutput.whiteInkCanvas.toDataURL('image/png');
    } else if (this.activeView === 'cut') {
      activeDataUrl = this.currentOutput.cutContourCanvas.toDataURL('image/png');
    } else {
      activeDataUrl = this.currentOutput.cmykCanvas.toDataURL('image/png');
    }

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-dieline-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">✂️ 智慧造型刀模 & 白墨專色層生成器</span>
            <span class="pm-modal-subtitle">透明貼紙、雷射貼紙、壓克力專用：自動生成 0.2mm 內縮白墨防溢底層與 2mm 洋紅外擴向量刀模線</span>
          </div>
          <button class="pm-modal-close" id="btnDielineClose">✕</button>
        </div>

        <div class="pm-dieline-body">
          <!-- Layer View Tabs -->
          <div class="pm-toggle-group">
            <button class="pm-tool-btn ${this.activeView === 'composite' ? 'active' : ''}" data-view="composite">
              👁️ 三層合成效果打樣
            </button>
            <button class="pm-tool-btn ${this.activeView === 'white' ? 'active' : ''}" data-view="white">
              ⬜ 白墨專色層 (0.2mm 內縮防溢)
            </button>
            <button class="pm-tool-btn ${this.activeView === 'cut' ? 'active' : ''}" data-view="cut">
              ✂️ 向量刀模線 (2mm 外擴洋紅)
            </button>
            <button class="pm-tool-btn ${this.activeView === 'cmyk' ? 'active' : ''}" data-view="cmyk">
              🎨 CMYK 彩色印刷層
            </button>
          </div>

          <!-- Preview Stage -->
          <div class="pm-dieline-preview-stage">
            <img src="${activeDataUrl}" alt="刀模預覽" class="pm-dieline-preview-img" />
          </div>

          <!-- Summary & Download Bar -->
          <div class="pm-pricing-summary-card">
            <div class="pm-summary-left">
              <div class="pm-summary-price-group">
                <span class="pm-summary-currency">白墨與刀模</span>
                <span class="pm-summary-amount">3</span>
                <span class="pm-summary-tax">層分離式印刷封包</span>
              </div>
              <div class="pm-summary-unit-price">
                ✓ 包含 100% 遮蔽率白墨層、0.2mm 內縮防溢白、100% Magenta 1pt 刀模路徑 · 符合健豪/卡之屋透明模切規範
              </div>
            </div>

            <div class="pm-summary-right-actions">
              <button id="btnDownloadWhiteInkPng" class="pm-btn pm-btn-artisan pm-btn-lg">
                <span>📥</span> 下載白墨專色層 (K100 PNG)
              </button>
              <button id="btnDownloadCutContourPng" class="pm-btn pm-btn-secondary pm-btn-md">
                <span>✂️</span> 下載向量刀模線 (PNG)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.modalEl.querySelector('#btnDielineClose')?.addEventListener('click', () => {
      this.close();
    });

    this.modalEl.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = (btn as HTMLElement).dataset.view as any;
        if (view && view !== this.activeView) {
          this.activeView = view;
          SoundEffects.sliderTick();
          this.render();
        }
      });
    });

    this.modalEl.querySelector('#btnDownloadWhiteInkPng')?.addEventListener('click', () => {
      if (!this.currentOutput) return;
      SoundEffects.shutterClick();
      const url = this.currentOutput.whiteInkCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `PrintMagic_WhiteInk_K100_${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      Toast.success('✓ 白墨專色層 (K100 純黑底版) 下載完成！');
    });

    this.modalEl.querySelector('#btnDownloadCutContourPng')?.addEventListener('click', () => {
      if (!this.currentOutput) return;
      SoundEffects.shutterClick();
      const url = this.currentOutput.cutContourCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `PrintMagic_CutContour_2mm_${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      Toast.success('✓ 2mm 造型刀模線 (Magenta) 下載完成！');
    });
  }
}
