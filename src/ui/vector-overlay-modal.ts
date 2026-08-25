import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { VectorOverlayEngine } from '../core/vector-overlay';
import { TextInspector } from '../core/text-inspector';

/**
 * ✒️ K100 純黑字與向量 Logo 浮層編輯器 (支援一鍵全圖自動偵測文字區域)
 */
export class VectorOverlayModal {
  private modalEl: HTMLElement;
  public engine: VectorOverlayEngine;
  private onApplyCallback: () => void;

  constructor(engine: VectorOverlayEngine, onApply: () => void) {
    this.engine = engine;
    this.onApplyCallback = onApply;
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.id = 'vectorOverlayModal';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  public open(prefillText?: string): void {
    const state = store.getState();
    if (!state.processedDataUrl && !state.originalDataUrl) {
      Toast.error('請先上傳圖片');
      return;
    }

    // Auto-detect and populate if empty
    if (this.engine.getTextItems().length === 0) {
      this.autoDetectFromCurrentState(false);
    }

    SoundEffects.sliderTick();
    this.render();
    if (prefillText) {
      const input = this.modalEl.querySelector('#inputOverlayText') as HTMLInputElement;
      if (input) {
        input.value = prefillText;
      }
    }
    this.modalEl.style.display = 'flex';
  }

  public close(): void {
    this.modalEl.style.display = 'none';
  }

  public autoDetectFromCurrentState(applyImmediately: boolean = false): boolean {
    const state = store.getState();
    const imgData = state.processedImageData || state.originalImageData;
    if (!imgData) {
      Toast.error('尚未載入圖片資料');
      return false;
    }

    const detected = TextInspector.autoDetectTextLayers(imgData);
    if (detected.length === 0) {
      if (!applyImmediately) {
        Toast.info('未偵測到明顯文字區塊');
      }
      return false;
    }

    this.engine.clear();
    this.engine.addTextItems(detected);

    if (applyImmediately) {
      SoundEffects.shutterClick();
      this.onApplyCallback();
      this.close();
      Toast.success(`✓ 已自動辨識全部 ${detected.length} 處文字，並以 K100 向量層清晰渲染！`);
    } else {
      SoundEffects.sliderTick();
      Toast.success(`✨ 已自動偵測並載入 ${detected.length} 處文字區域！`);
      this.render();
    }
    return true;
  }

  private render(): void {
    const items = this.engine.getTextItems();

    const itemsListHtml = items.length === 0
      ? `<div class="pm-conv-desc-text" style="text-align:center; padding:20px;">尚無浮層文字，請點擊上方「一鍵自動偵測文字區域」或於下方手動添加</div>`
      : items
          .map((item) => `
            <div class="pm-conv-spec-card" style="flex-direction:row; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.7); border-radius:10px; margin-bottom:6px; border:1px solid rgba(0,0,0,0.06);">
              <div style="display:flex; flex-direction:column; gap:2px;">
                <span class="pm-conv-paper-title" style="font-weight:700; color:var(--pm-text-primary); font-size:0.92rem;">${this.escapeHtml(item.text)}</span>
                <div class="pm-conv-size-text" style="font-size:0.75rem; color:var(--pm-text-tertiary);">
                  位置：(${item.xPercent}%, ${item.yPercent}%) · 字級：${item.fontSizePx}px · ${item.isK100 ? '🛡️ K100 純黑防糊' : item.color}
                </div>
              </div>
              <button class="pm-btn pm-btn-secondary pm-btn-xs" data-del-text="${item.id}" style="padding:4px 8px; font-size:0.75rem;">✕ 刪除</button>
            </div>
          `)
          .join('');

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-overlay-dialog" style="max-width: 620px;">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">✒️ 文字清晰防糊 & 銳利字體層</span>
            <span class="pm-modal-subtitle">自動將圖中文字轉為「純黑清晰向量字」，印出來字體像刀鋒般銳利、完全不發虛模糊</span>
          </div>
          <button class="pm-modal-close" id="btnOverlayClose">✕</button>
        </div>

        <div class="pm-conv-body" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Plain Language Explanation & One-Click Auto-Detect Hero Banner -->
          <div style="background: linear-gradient(135deg, rgba(0, 113, 227, 0.08) 0%, rgba(52, 199, 89, 0.08) 100%); border: 1px solid rgba(0, 113, 227, 0.2); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.25rem;">✨</span>
                <strong style="font-size: 0.95rem; color: var(--pm-text-primary);">自動偵測文字區域（免手動輸入）</strong>
              </div>
              <span style="font-size: 0.75rem; color: var(--pm-status-success); font-weight: 600; background: rgba(52,199,89,0.12); padding: 2px 8px; border-radius: 12px;">
                ⚡ 即時偵測
              </span>
            </div>

            <div style="font-size: 0.78rem; color: var(--pm-text-secondary); line-height: 1.45; background: rgba(255,255,255,0.6); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.04);">
              💡 <strong>為什麼小字容易模糊？</strong> 名片與海報上的文字若用多種彩色油墨混印，容易因為印刷機微震造成邊緣發虛。轉成「單色純黑（K100）」後，印表機單色直出，字體絕對針尖般清晰！
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button id="btnAutoDetectAndApply" class="pm-btn pm-btn-artisan pm-btn-md" style="flex: 1; min-width: 190px; background: linear-gradient(135deg, #0071e3 0%, #0051a8 100%); color: #fff; font-weight: 700;">
                <span>⚡</span> 一鍵自動修復全圖文字 (立即變清晰)
              </button>
              <button id="btnAutoDetectOnly" class="pm-btn pm-btn-secondary pm-btn-md" style="font-weight: 600;">
                <span>🤖</span> 重新自動掃描
              </button>
              ${items.length > 0 ? `<button id="btnClearAllItems" class="pm-btn pm-btn-ghost pm-btn-md" style="color: var(--pm-text-tertiary);">🗑️ 清空</button>` : ''}
            </div>
          </div>

          <!-- Current Items List -->
          <div class="pm-conv-section" style="margin-top: 2px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="pm-pricing-label" style="margin: 0;">已自動抓取之文字 (${items.length})</label>
              <span style="font-size: 0.75rem; color: var(--pm-text-tertiary);">可自由增刪或修改</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; max-height:190px; overflow-y:auto; background:rgba(0,0,0,0.02); padding:8px; border-radius:10px; border:1px solid rgba(0,0,0,0.05);">
              ${itemsListHtml}
            </div>
          </div>

          <!-- Manual Text Input Form (Optional) -->
          <details style="background: rgba(0,0,0,0.015); border-radius: 10px; padding: 8px 12px; border: 1px dashed rgba(0,0,0,0.1);">
            <summary style="font-size: 0.8rem; font-weight: 600; color: var(--pm-text-secondary); cursor: pointer;">
              ➕ 自訂手動添加其他文字 (選用)
            </summary>
            <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <input type="text" id="inputOverlayText" class="pm-input-field" placeholder="例如：BRAND STUDIO / TEL: 02-1234-5678" style="flex:2; min-width:200px;" />
                <select id="selectOverlaySize" class="pm-select-field" style="width:110px;">
                  <option value="28">28px (小標/聯絡資訊)</option>
                  <option value="42" selected>42px (中標/姓名)</option>
                  <option value="64">64px (大標/公司名)</option>
                </select>
                <button id="btnAddTextItem" class="pm-btn pm-btn-secondary pm-btn-md">
                  <span>＋</span> 添加文字
                </button>
              </div>

              <!-- Quick Templates -->
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                <span style="font-size: 0.75rem; color: var(--pm-text-tertiary);">常見範本：</span>
                <button class="pm-sample-pill-btn" data-tmpl="brand" style="font-size: 0.72rem; padding: 2px 6px;">🏢 品牌主標</button>
                <button class="pm-sample-pill-btn" data-tmpl="contact" style="font-size: 0.72rem; padding: 2px 6px;">📱 業務電話</button>
                <button class="pm-sample-pill-btn" data-tmpl="web" style="font-size: 0.72rem; padding: 2px 6px;">🌐 官方網站</button>
                <button class="pm-sample-pill-btn" data-tmpl="copyright" style="font-size: 0.72rem; padding: 2px 6px;">© 2026 版權所有</button>
              </div>
            </div>
          </details>

          <!-- Actions -->
          <div class="pm-summary-right-actions" style="justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid rgba(0,0,0,0.06);">
            <span style="font-size: 0.78rem; color: var(--pm-text-secondary);">
              💡 提示：套用後直接點擊「下載標準印刷 PDF」，印出來字體就是頂級清晰度！
            </span>
            <button id="btnApplyOverlay" class="pm-btn pm-btn-artisan pm-btn-lg" style="min-width: 150px;">
              <span>✓</span> 套用並渲染於畫布
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.modalEl.querySelector('#btnOverlayClose')?.addEventListener('click', () => {
      this.close();
    });

    // One-Click Auto-Detect and Apply
    this.modalEl.querySelector('#btnAutoDetectAndApply')?.addEventListener('click', () => {
      this.autoDetectFromCurrentState(true);
    });

    // Auto-Detect Only
    this.modalEl.querySelector('#btnAutoDetectOnly')?.addEventListener('click', () => {
      this.autoDetectFromCurrentState(false);
    });

    // Clear All
    this.modalEl.querySelector('#btnClearAllItems')?.addEventListener('click', () => {
      this.engine.clear();
      SoundEffects.sliderTick();
      Toast.info('已清空浮層文字');
      this.render();
    });

    // Add manual text button
    this.modalEl.querySelector('#btnAddTextItem')?.addEventListener('click', () => {
      const input = this.modalEl.querySelector('#inputOverlayText') as HTMLInputElement;
      const selectSize = this.modalEl.querySelector('#selectOverlaySize') as HTMLSelectElement;
      const text = input?.value?.trim();
      if (!text) {
        Toast.error('請輸入文字內容');
        return;
      }

      this.engine.addText({
        text,
        xPercent: 10,
        yPercent: 85,
        fontSizePx: parseInt(selectSize?.value || '42', 10),
        fontFamily: 'sans-serif',
        isK100: true,
        color: '#000000',
        isOverprint: true
      });

      SoundEffects.sliderTick();
      Toast.success('✓ 已添加 K100% 純黑向量文字');
      input.value = '';
      this.render();
    });

    // Delete item buttons
    this.modalEl.querySelectorAll('[data-del-text]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.delText;
        if (id) {
          this.engine.removeText(id);
          SoundEffects.sliderTick();
          this.render();
        }
      });
    });

    // Quick templates
    this.modalEl.querySelectorAll('[data-tmpl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tmpl = (btn as HTMLElement).dataset.tmpl;
        let text = '';
        if (tmpl === 'brand') text = 'CREATIVE DESIGN STUDIO';
        else if (tmpl === 'contact') text = 'TEL: +886 912-345-678';
        else if (tmpl === 'web') text = 'https://www.example.com';
        else if (tmpl === 'copyright') text = '© 2026 All Rights Reserved.';

        this.engine.addText({
          text,
          xPercent: 10,
          yPercent: 88,
          fontSizePx: 36,
          fontFamily: 'sans-serif',
          isK100: true,
          color: '#000000',
          isOverprint: true
        });

        SoundEffects.sliderTick();
        Toast.success(`✓ 已載入【${text}】K100 純黑字`);
        this.render();
      });
    });

    // Apply button
    this.modalEl.querySelector('#btnApplyOverlay')?.addEventListener('click', () => {
      SoundEffects.shutterClick();
      this.onApplyCallback();
      this.close();
      Toast.success('✓ 向量文字浮層已成功渲染於畫布！');
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

