import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { VectorOverlayEngine } from '../core/vector-overlay';

/**
 * ✒️ K100 純黑字與向量 Logo 浮層編輯器
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

  public open(): void {
    const state = store.getState();
    if (!state.processedDataUrl && !state.originalDataUrl) {
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
    const items = this.engine.getTextItems();

    const itemsListHtml = items.length === 0
      ? `<div class="pm-conv-desc-text" style="text-align:center; padding:20px;">尚無浮層文字，請於下方輸入並點擊「＋ 添加 K100 純黑字」</div>`
      : items
          .map((item) => `
            <div class="pm-conv-spec-card" style="flex-direction:row; align-items:center; justify-content:space-between;">
              <div>
                <span class="pm-conv-paper-title">${item.text}</span>
                <div class="pm-conv-size-text">
                  字級：${item.fontSizePx}px · ${item.isK100 ? '🛡️ K100 純黑防糊' : item.color}
                </div>
              </div>
              <button class="pm-btn pm-btn-secondary pm-btn-xs" data-del-text="${item.id}">✕ 刪除</button>
            </div>
          `)
          .join('');

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-overlay-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">✒️ K100 純黑字 & 向量標誌疊印層 (Anti-Blur)</span>
            <span class="pm-modal-subtitle">防止 AI 小字四色混黑 (C60 M50 Y50 K100) 套印糊邊！以單色 K100 純黑向量疊印，字體保證針尖般銳利</span>
          </div>
          <button class="pm-modal-close" id="btnOverlayClose">✕</button>
        </div>

        <div class="pm-conv-body">
          <!-- Text Input Form -->
          <div class="pm-conv-section">
            <label class="pm-pricing-label">添加文字 (支援品牌名、電話、網址、版權標記)</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <input type="text" id="inputOverlayText" class="pm-input-field" placeholder="例如：BRAND STUDIO / TEL: 02-1234-5678" style="flex:2; min-width:220px;" />
              <select id="selectOverlaySize" class="pm-select-field" style="width:110px;">
                <option value="28">28px (小標)</option>
                <option value="42" selected>42px (中標)</option>
                <option value="64">64px (大標)</option>
              </select>
              <button id="btnAddTextItem" class="pm-btn pm-btn-artisan pm-btn-md">
                <span>＋</span> 添加 K100 純黑字
              </button>
            </div>
          </div>

          <!-- Current Items List -->
          <div class="pm-conv-section">
            <label class="pm-pricing-label">已添加之向量圖層 (${items.length})</label>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto;">
              ${itemsListHtml}
            </div>
          </div>

          <!-- Quick Templates -->
          <div class="pm-conv-section">
            <label class="pm-pricing-label">✨ 設計師一鍵公版文字：</label>
            <div class="pm-sample-pills">
              <button class="pm-sample-pill-btn" data-tmpl="brand">🏢 品牌主標</button>
              <button class="pm-sample-pill-btn" data-tmpl="contact">📱 業務聯絡電話</button>
              <button class="pm-sample-pill-btn" data-tmpl="web">🌐 官網與社群帳號</button>
              <button class="pm-sample-pill-btn" data-tmpl="copyright">© 2026 版權所有</button>
            </div>
          </div>

          <!-- Actions -->
          <div class="pm-summary-right-actions" style="justify-content:flex-end; padding-top:10px;">
            <button id="btnApplyOverlay" class="pm-btn pm-btn-artisan pm-btn-lg">
              <span>✓</span> 套用並即時渲染於畫布
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

    // Add text button
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
}
