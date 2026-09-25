import type { DetectedTextRegion, TextInspectionResult } from '../types';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';

/**
 * AI Text & Typo Inspection Modal Component
 * Apple Minimalist Frosted Glass Interactive Inspector
 */
export class TextInspectionModal {
  private overlay: HTMLElement;
  private currentResult: TextInspectionResult | null = null;
  private currentImageDataUrl: string | null = null;
  private selectedRegionId: string | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pm-modal-overlay pm-text-inspect-overlay';
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
  }

  public open(result: TextInspectionResult, imageDataUrl: string): void {
    this.currentResult = result;
    this.currentImageDataUrl = imageDataUrl;
    this.selectedRegionId = result.regions.length > 0 ? result.regions[0].id : null;
    SoundEffects.sliderTick();
    // ⚠️ 2026-08-29 修正：原本先 render() 再把 overlay 設成 display:flex。render() 內部
    // bindEvents() 若偵測到 <img> 已經是瀏覽器快取（img.complete 立即為 true，常見於
    // 使用者已經看過同一張圖），會「同步、立即」呼叫 adjustBoundingBoxPositions()，
    // 但此時 overlay 祖先元素還是 display:none，任何子元素的 clientWidth/clientHeight
    // 都會讀到 0。雖然程式碼有 `|| naturalW` 的 fallback，但這只是讓 scaleX/scaleY
    // 都變成剛好 1，等於把標註框座標當成「圖片以原生像素 1:1 顯示」來定位——
    // 但圖片實際上是被 CSS 縮小顯示在彈窗裡的，導致標註框整個跑位到畫面外或錯誤位置。
    // 改成先讓 overlay 變成可見（display:flex）再呼叫 render()，這樣 bindEvents() 執行時
    // clientWidth/clientHeight 就能讀到真實、已經套用 CSS 縮放後的顯示尺寸。
    this.overlay.style.display = 'flex';
    this.render();
    document.body.style.overflow = 'hidden';
  }

  public close(): void {
    SoundEffects.sliderTick();
    this.overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  private render(): void {
    if (!this.currentResult) return;
    const { regions, totalWords, typoCount, summary, executionTimeMs } = this.currentResult;

    // Text is read by local OCR (free-ocr-client) and checked against a small list of common English
    // typos plus a dictionary — a clean result means "nothing on that list matched", not "verified".
    const statusBadgeClass = typoCount > 0 ? 'pm-badge-warning' : 'pm-badge-success';
    const statusBadgeText = typoCount > 0
      ? `<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 發現 ${typoCount} 處需注意`
      : '<img src="icons/shared/info.webp" alt="" class="pm-icon-img" /> 未比對到常見錯字';

    this.overlay.innerHTML = `
      <div class="pm-modal pm-modal-lg pm-text-inspect-modal" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="pm-modal-icon-badge" style="background: rgba(60, 30, 140, 0.1); color: var(--pm-accent-blue);"><img src="icons/header/text-inspect.webp" alt="" class="pm-icon-img" /></div>
            <div>
              <h2 class="pm-modal-title">文字辨識與錯字檢查</h2>
              <p class="pm-modal-desc">
                找出圖中的文字位置，用本機 OCR 讀出內容，再比對常見英文拼錯與字典；中文與專有名詞請自行確認
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseTextInspect" title="關閉視窗"><img src="icons/shared/close.webp" alt="" class="pm-icon-img" /></button>
        </div>

        <!-- Summary Bar -->
        <div class="pm-text-inspect-summary-bar">
          <div class="pm-summary-stat">
            <span class="pm-summary-stat-label">檢驗區塊</span>
            <span class="pm-summary-stat-val">${totalWords} 處</span>
          </div>
          <div class="pm-summary-stat">
            <span class="pm-summary-stat-label">檢測結果</span>
            <span class="pm-badge ${statusBadgeClass}">${statusBadgeText}</span>
          </div>
          <div class="pm-summary-stat">
            <span class="pm-summary-stat-label">檢測耗時</span>
            <span class="pm-summary-stat-val">${executionTimeMs} ms</span>
          </div>
          <div class="pm-summary-stat" style="flex: 1; text-align: right;">
            <span class="pm-summary-note">${summary}</span>
          </div>
        </div>

        <!-- Body: Split Left Preview Canvas + Right Region Details List -->
        <div class="pm-text-inspect-body">
          <!-- Left: Visual Image Annotation Box -->
          <div class="pm-text-inspect-canvas-wrapper">
            <div class="pm-text-inspect-canvas-box" id="inspectCanvasBox">
              <img src="${this.currentImageDataUrl || ''}" alt="檢驗原圖" id="inspectImg" />
              <!-- Bounding Box Overlays -->
              <div class="pm-inspect-bbox-layer" id="inspectBboxLayer">
                ${this.renderBoundingBoxes(regions)}
              </div>
            </div>
            <div class="pm-inspect-canvas-hint">
              <span>💡 點擊圖中標註框或右側字卡，可精準對照各文字位置</span>
            </div>
          </div>

          <!-- Right: Text Regions List -->
          <div class="pm-text-inspect-list">
            ${regions.length === 0
              ? `<div class="pm-empty-text-state">
                   <div style="font-size: 2rem; margin-bottom: 8px;"><img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" style="width: 32px; height: 30px;" /></div>
                   <div style="font-weight: 700; color: var(--pm-text-primary);">未偵測到明顯文字</div>
                   <div style="font-size: 0.8rem; color: var(--pm-text-tertiary); margin-top: 4px;">偵測不到文字不代表圖上沒有字（直書、很淡或很小的字可能漏掉），送印前仍請自己看過一次。</div>
                 </div>`
              : regions.map(reg => this.renderRegionCard(reg)).join('')
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="pm-modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.78rem; color: var(--pm-text-secondary); display: flex; align-items: center; gap: 6px;">
            <span>💡 錯字檢查只比對一份常見英文錯字表與字典，抓不到的錯字仍可能存在。</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="pm-btn pm-btn-ghost" id="btnCancelTextInspect">關閉</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderBoundingBoxes(regions: DetectedTextRegion[]): string {
    return regions.map((reg) => {
      const isSelected = reg.id === this.selectedRegionId;
      const borderClass = reg.isTypo ? 'pm-bbox-typo' : reg.isBlurry ? 'pm-bbox-blur' : 'pm-bbox-valid';
      const selectedClass = isSelected ? 'pm-bbox-selected' : '';

      return `
        <div class="pm-inspect-bbox ${borderClass} ${selectedClass}"
             data-region-id="${reg.id}"
             title="${this.escapeHtml(reg.text)} (${reg.isTypo ? '疑似錯字' : '正常'})">
          <span class="pm-bbox-tag">${reg.isTypo ? '<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 錯字' : reg.isBlurry ? '<img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" /> 模糊' : '<img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 正常'}</span>
        </div>
      `;
    }).join('');
  }

  private renderRegionCard(reg: DetectedTextRegion): string {
    const isSelected = reg.id === this.selectedRegionId;
    const cardBorder = reg.isTypo ? 'pm-text-card-typo' : reg.isBlurry ? 'pm-text-card-blur' : 'pm-text-card-valid';
    const activeClass = isSelected ? 'pm-text-card-active' : '';

    return `
      <div class="pm-text-region-card ${cardBorder} ${activeClass}" data-region-id="${reg.id}">
        <div class="pm-text-card-header">
          <div class="pm-text-card-title-group">
            <span class="pm-text-card-text">"${this.escapeHtml(reg.text)}"</span>
            <span class="pm-text-card-conf">${Math.round(reg.confidence * 100)}% 辨識度</span>
          </div>
          <div>
            ${reg.isTypo
              ? `<span class="pm-status-pill pm-status-warning"><img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 疑似異常</span>`
              : reg.isBlurry
              ? `<span class="pm-status-pill pm-status-info"><img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" /> 邊緣偏軟</span>`
              : `<span class="pm-status-pill pm-status-success"><img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 正常</span>`
            }
          </div>
        </div>

        ${reg.typoReason ? `
          <div class="pm-text-card-issue">
            <span class="pm-issue-icon"><img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /></span>
            <span class="pm-issue-text">${this.escapeHtml(reg.typoReason)}</span>
          </div>
        ` : ''}

        ${reg.suggestion ? `
          <div class="pm-text-card-suggestion">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.78rem; color: var(--pm-text-secondary);">
                💡 建議修正：<strong style="color: var(--pm-accent-blue); font-size: 0.85rem;">${this.escapeHtml(reg.suggestion)}</strong>
              </span>
              <div style="display: flex; gap: 6px;">
                <button class="pm-btn pm-btn-xs pm-btn-ghost btn-copy-suggest" data-text="${this.escapeHtml(reg.suggestion)}" title="複製建議文字">
                  <img src="icons/shared/clipboard.webp" alt="" class="pm-icon-img" /> 複製
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private bindEvents(): void {
    // Close buttons
    this.overlay.querySelector('#btnCloseTextInspect')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('#btnCancelTextInspect')?.addEventListener('click', () => this.close());

    // Copy suggestion
    this.overlay.querySelectorAll<HTMLButtonElement>('.btn-copy-suggest').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = btn.dataset.text || '';
        try {
          await navigator.clipboard.writeText(text);
          Toast.show(`已複製建議文字「${text}」到剪貼簿！`, 'success');
        } catch {
          Toast.show(`已選擇「${text}」`, 'info');
        }
      });
    });

    // Region selection (Card click & Bounding box click)
    this.overlay.querySelectorAll<HTMLElement>('.pm-text-region-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.regionId;
        if (id) {
          this.selectRegion(id);
        }
      });
    });

    this.overlay.querySelectorAll<HTMLElement>('.pm-inspect-bbox').forEach((bbox) => {
      bbox.addEventListener('click', () => {
        const id = bbox.dataset.regionId;
        if (id) {
          this.selectRegion(id);
        }
      });
    });

    // Reposition bounding boxes relative to displayed image dimensions
    const img = this.overlay.querySelector('#inspectImg') as HTMLImageElement;
    if (img) {
      if (img.complete) {
        this.adjustBoundingBoxPositions(img);
      } else {
        img.onload = () => this.adjustBoundingBoxPositions(img);
      }
    }
  }

  private adjustBoundingBoxPositions(img: HTMLImageElement): void {
    if (!this.currentResult) return;
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;
    const displayW = img.clientWidth || naturalW;
    const displayH = img.clientHeight || naturalH;

    const scaleX = displayW / naturalW;
    const scaleY = displayH / naturalH;

    this.currentResult.regions.forEach((reg) => {
      const el = this.overlay.querySelector(`.pm-inspect-bbox[data-region-id="${reg.id}"]`) as HTMLElement;
      if (el) {
        el.style.left = `${Math.round(reg.x * scaleX)}px`;
        el.style.top = `${Math.round(reg.y * scaleY)}px`;
        el.style.width = `${Math.max(24, Math.round(reg.width * scaleX))}px`;
        el.style.height = `${Math.max(16, Math.round(reg.height * scaleY))}px`;
      }
    });
  }

  private selectRegion(id: string): void {
    this.selectedRegionId = id;
    SoundEffects.sliderTick();

    // Update active card
    this.overlay.querySelectorAll('.pm-text-region-card').forEach((card) => {
      if (card.getAttribute('data-region-id') === id) {
        card.classList.add('pm-text-card-active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.classList.remove('pm-text-card-active');
      }
    });

    // Update active bbox
    this.overlay.querySelectorAll('.pm-inspect-bbox').forEach((bbox) => {
      if (bbox.getAttribute('data-region-id') === id) {
        bbox.classList.add('pm-bbox-selected');
      } else {
        bbox.classList.remove('pm-bbox-selected');
      }
    });
  }

  private escapeHtml(text: string): string {
    // 需一併跳脫引號：結果會被放進 title / data-text 等雙引號屬性
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
