import { MultiFormatExporter, type ExportFormatType } from '../engines/multi-format-exporter';
import { store } from './state';
import { SoundEffects } from '../core/sound-effects';

export class ExportModal {
  private modalEl: HTMLElement | null = null;

  constructor() {
    this.createModalElement();
  }

  private createModalElement(): void {
    let el = document.getElementById('exportFormatModal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'exportFormatModal';
      el.className = 'pm-modal';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    this.modalEl = el;
  }

  public open(): void {
    if (!this.modalEl) return;
    const state = store.getState();
    const preset = state.currentPreset;
    const baseName = MultiFormatExporter.getBaseFilename(state);

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 620px; width: 94vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">🖨️</span>
            <div>
              <h3 class="pm-modal-title">商業印刷多格式出機中心</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                符合各大印刷廠（健豪、卡之屋、經典、藍格）與大圖輸出之規範
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseExportModal">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Format Selection Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- 1. PDF/X-1a -->
            <button class="pm-export-choice-card" data-format="pdf" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.3rem;">📄</span>
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(0,113,227,0.1); color: var(--pm-accent-blue); padding: 2px 6px; border-radius: 4px;">合版廠首選</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">標準印刷 PDF (.pdf)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                內嵌 3mm 出血、裁切標記與對位規矩線（RGB 內容，印刷廠仍需自行做 CMYK 分色）。
              </div>
            </button>

            <!-- 2. TIFF -->
            <button class="pm-export-choice-card" data-format="tiff" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.3rem;">🖨️</span>
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(52,199,89,0.12); color: #34c759; padding: 2px 6px; border-radius: 4px;">大圖無損</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">工業級無損 TIFF (.tif)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                300 DPI 無壓縮點陣檔，無失真、分色清晰，傳統製版與大圖輸出必備。
              </div>
            </button>

            <!-- 3. High-Res PNG -->
            <button class="pm-export-choice-card" data-format="png" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.3rem;">📥</span>
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(88,86,214,0.1); color: #5856d6; padding: 2px 6px; border-radius: 4px;">透明通道</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">高清點陣 PNG (.png)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                300 DPI 保留 Alpha 透明背景，貼紙割型、壓克力立牌直接預覽。
              </div>
            </button>

            <!-- 4. High-Quality JPG -->
            <button class="pm-export-choice-card" data-format="jpg" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.3rem;">🖼️</span>
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(255,149,0,0.1); color: #ff9500; padding: 2px 6px; border-radius: 4px;">相片沖洗</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">商用高畫質 JPG (.jpg)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                300 DPI 100% 最高畫質 JPEG，相片沖印、快速傳圖送印無阻礙。
              </div>
            </button>

            <!-- 5. SVG Dieline -->
            <button class="pm-export-choice-card" data-format="svg" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.3rem;">✂️</span>
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(255,45,85,0.1); color: #ff2d55; padding: 2px 6px; border-radius: 4px;">激光刀模</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">向量刀模/白墨 SVG (.svg)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                100% Magenta 專色裁切割字線與 0.2mm 內縮白墨打底層。
              </div>
            </button>

            <!-- 6. Full Production ZIP Bundle -->
            <button class="pm-export-choice-card" data-format="zip" style="background: linear-gradient(135deg, rgba(0,113,227,0.06) 0%, rgba(88,86,214,0.08) 100%); border: 1.5px solid var(--pm-accent-blue); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.3rem;">📦</span>
                <span style="font-size: 0.68rem; font-weight: 800; background: var(--pm-accent-blue); color: #ffffff; padding: 2px 6px; border-radius: 4px;">一鍵全打包</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-accent-blue);">印刷廠出機全套包 (.zip)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-secondary); line-height: 1.3;">
                內含 PDF + TIFF + PNG + JPG + 刀模 SVG + PrintPass 品質合格報告書！
              </div>
            </button>
          </div>

          <!-- Spec Footer -->
          <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--pm-border-subtle); border-radius: 8px; padding: 10px 12px; font-size: 0.73rem; color: var(--pm-text-secondary); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>目前檔案規格：</strong>${preset.nameZh} (${preset.widthMm} × ${preset.heightMm} mm · 含 3mm 出血)
            </div>
            <div style="font-family: monospace; color: var(--pm-text-muted);">${baseName}</div>
          </div>
        </div>
      </div>
    `;

    this.modalEl.style.display = 'flex';

    // Wire events
    document.getElementById('btnCloseExportModal')?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    this.modalEl.querySelectorAll('.pm-export-choice-card').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const format = btn.getAttribute('data-format') as ExportFormatType;
        if (format) {
          this.close();
          await MultiFormatExporter.exportFormat(format, store.getState());
        }
      });
    });
  }

  public close(): void {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
      SoundEffects.sliderTick();
    }
  }
}
