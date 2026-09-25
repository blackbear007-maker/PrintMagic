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
      el.className = 'pm-modal-backdrop';
      el.style.display = 'none';
      document.body.appendChild(el);
      // ⚠️ 2026-08-29 修正：backdrop 點擊監聽器要綁在「第一次建立」這個分支，只綁一次。
      // 原本綁在 open() 裡，每次開啟都會對同一個 this.modalEl 節點（innerHTML 只會換掉其
      // 子節點，modalEl 本身不會被換掉）疊加一個新的 click 監聽器，永遠不會被移除——
      // 開過 N 次之後，點一下背景會連續呼叫 N 次 close()（疊加音效與副作用）。
      el.addEventListener('click', (e) => {
        if (e.target === this.modalEl) this.close();
      });
    }
    this.modalEl = el;
  }

  private static readonly OPTIONAL_ENHANCEMENTS: {
    key: keyof ReturnType<typeof store.getState>['manualEnhancementsApplied'];
    icon: string;
    label: string;
    hint: string;
    buttonId: string;
  }[] = [
    {
      key: 'descreen',
      icon: 'icons/shared/spiral-descreen.webp',
      label: '去網紋',
      hint: '翻拍/掃描印刷品才會有的網點干涉紋',
      buttonId: 'btnDescreen'
    },
    {
      key: 'jpegDeblock',
      icon: 'icons/shared/puzzle.webp',
      label: '去區塊',
      hint: '截圖/多次轉傳壓縮過的圖片才需要',
      buttonId: 'btnJpegDeblock'
    },
    {
      key: 'vectorize',
      icon: 'icons/shared/pen-nib.webp',
      label: '轉真向量',
      hint: '線稿/貼紙轉成無限放大不糊邊的 SVG',
      buttonId: 'btnAiVectorizer'
    }
  ];

  public open(): void {
    if (!this.modalEl) return;
    const state = store.getState();
    const preset = state.currentPreset;
    const baseName = MultiFormatExporter.getBaseFilename(state);
    const notApplied = ExportModal.OPTIONAL_ENHANCEMENTS.filter(
      (item) => !state.manualEnhancementsApplied[item.key]
    );

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 620px; width: 94vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="icons/shared/printer.webp" alt="" class="pm-icon-img" />
            <div>
              <h3 class="pm-modal-title">商業印刷多格式出機中心</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                一次下載各種格式的印刷檔
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseExportModal"><img src="icons/shared/close.webp" alt="" class="pm-icon-img" /></button>
        </div>

        <div class="pm-modal-body" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Format Selection Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- 1. PDF/X-1a -->
            <button class="pm-export-choice-card" data-format="pdf" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <img src="icons/shared/document-page.webp" alt="" class="pm-icon-img" />
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(60,30,140,0.1); color: var(--pm-accent-blue); padding: 2px 6px; border-radius: 4px;">合版廠首選</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">標準印刷 PDF (.pdf)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                依規格內嵌出血、裁切標記與對位規矩線；分色服務可用時依色彩描述檔輸出 CMYK，否則輸出 RGB 並在小抄註明。
              </div>
            </button>

            <!-- 2. TIFF -->
            <button class="pm-export-choice-card" data-format="tiff" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <img src="icons/shared/printer.webp" alt="" class="pm-icon-img" />
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(52,199,89,0.12); color: #34c759; padding: 2px 6px; border-radius: 4px;">大圖無損</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">工業級無損 TIFF (.tif)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                300 DPI 無損點陣檔（RGB，不含出血與裁切標記）</div>
            </button>

            <!-- 3. High-Res PNG -->
            <button class="pm-export-choice-card" data-format="png" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <img src="icons/shared/download.webp" alt="" class="pm-icon-img" />
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(88,86,214,0.1); color: #4b2aa8; padding: 2px 6px; border-radius: 4px;">透明通道</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">高清點陣 PNG (.png)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                300 DPI 保留 Alpha 透明背景，貼紙割型、壓克力立牌直接預覽。
              </div>
            </button>

            <!-- 4. High-Quality JPG -->
            <button class="pm-export-choice-card" data-format="jpg" style="background: #ffffff; border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <img src="icons/shared/picture.webp" alt="" class="pm-icon-img" />
                <span style="font-size: 0.68rem; font-weight: 700; background: rgba(255,149,0,0.1); color: #ff9500; padding: 2px 6px; border-radius: 4px;">相片沖洗</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-text-primary);">商用高畫質 JPG (.jpg)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-muted); line-height: 1.3;">
                300 DPI 100% 最高畫質 JPEG，相片沖印、快速傳圖送印無阻礙。
              </div>
            </button>

            <!-- 6. Full Production ZIP Bundle -->
            <button class="pm-export-choice-card" data-format="zip" style="background: linear-gradient(135deg, rgba(60,30,140,0.06) 0%, rgba(88,86,214,0.08) 100%); border: 1.5px solid var(--pm-accent-blue); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <img src="icons/shared/package-box.webp" alt="" class="pm-icon-img" />
                <span style="font-size: 0.68rem; font-weight: 800; background: var(--pm-accent-blue); color: #ffffff; padding: 2px 6px; border-radius: 4px;">一鍵全打包</span>
              </div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--pm-accent-blue);">印刷廠出機全套包 (.zip)</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-secondary); line-height: 1.3;">
                內含 PDF + TIFF + PNG + JPG，以及一份本機檢查清單
              </div>
            </button>
          </div>

          ${notApplied.length > 0 ? `
          <!-- Optional manual enhancements reminder — these stay opt-in on purpose (see
               pipeline-orchestrator.ts's step 3.6/3.7 comment), so surface them here once,
               right before the user commits to a file, instead of leaving them undiscoverable. -->
          <div style="background: rgba(88, 86, 214, 0.05); border: 1px solid rgba(88, 86, 214, 0.2); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 0.74rem; font-weight: 700; color: var(--pm-text-primary);">還有幾個選用加強功能沒套用，需要的話可以自己開啟：</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${notApplied.map((item) => `
                <button class="pm-tool-btn pm-enhancement-reminder-btn" data-jump-to="${item.buttonId}" style="background: #ffffff; border: 1px solid var(--pm-border-subtle);" title="${item.hint}">
                  <img src="${item.icon}" alt="" class="pm-icon-img" /> ${item.label}
                </button>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- Spec Footer -->
          <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--pm-border-subtle); border-radius: 8px; padding: 10px 12px; font-size: 0.73rem; color: var(--pm-text-secondary); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>目前檔案規格：</strong>${preset.nameZh} (${preset.widthMm} × ${preset.heightMm} mm · ${preset.bleedMm > 0 ? `含 ${preset.bleedMm}mm 出血` : '無出血（數位用途）'})
            </div>
            <div style="font-family: monospace; color: var(--pm-text-muted);">${baseName}</div>
          </div>
        </div>
      </div>
    `;

    this.modalEl.style.display = 'flex';

    // Wire events (safe to re-bind every open(): these elements are freshly created by innerHTML= above)
    document.getElementById('btnCloseExportModal')?.addEventListener('click', () => this.close());

    this.modalEl.querySelectorAll('.pm-export-choice-card').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const format = btn.getAttribute('data-format') as ExportFormatType;
        if (format) {
          this.close();
          await MultiFormatExporter.exportFormat(format, store.getState());
        }
      });
    });

    this.modalEl.querySelectorAll('.pm-enhancement-reminder-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-jump-to');
        this.close();
        if (targetId) document.getElementById(targetId)?.click();
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
