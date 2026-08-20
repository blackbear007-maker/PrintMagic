import type { DetectedTextRegion, TextInspectionResult } from '../types';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';

/**
 * AI Text & Typo Inspection Modal Component
 * Apple Minimalist Frosted Glass Interactive Inspector
 */
export class TextInspectionModal {
  private overlay: HTMLElement;
  private onFixWithVectorOverlay?: (suggestedText: string) => void;
  private currentResult: TextInspectionResult | null = null;
  private currentImageDataUrl: string | null = null;
  private selectedRegionId: string | null = null;

  constructor(onFixWithVectorOverlay?: (suggestedText: string) => void) {
    this.onFixWithVectorOverlay = onFixWithVectorOverlay;
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
    this.render();
    this.overlay.style.display = 'flex';
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

    const statusBadgeClass = typoCount > 0 ? 'pm-badge-warning' : 'pm-badge-success';
    const statusBadgeText = typoCount > 0 ? `⚠️ 發現 ${typoCount} 處需注意` : '✅ 拼寫與排版皆正常';

    this.overlay.innerHTML = `
      <div class="pm-modal pm-modal-lg pm-text-inspect-modal" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="pm-modal-icon-badge" style="background: rgba(0, 113, 227, 0.1); color: var(--pm-accent-blue);">📝</div>
            <div>
              <h2 class="pm-modal-title">AI 智慧文字辨識與錯字檢查</h2>
              <p class="pm-modal-desc">
                自動辨識圖中文字，檢查 AI 繪圖常見的英文拼寫錯誤、無意義亂碼、重複字母與邊緣模糊問題
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseTextInspect" title="關閉視窗">✕</button>
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
                   <div style="font-size: 2rem; margin-bottom: 8px;">✨</div>
                   <div style="font-weight: 700; color: var(--pm-text-primary);">未偵測到明顯文字</div>
                   <div style="font-size: 0.8rem; color: var(--pm-text-tertiary); margin-top: 4px;">本圖為純插畫/無字視覺，無錯字風險，可安心送印！</div>
                 </div>`
              : regions.map(reg => this.renderRegionCard(reg)).join('')
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="pm-modal-footer">
          <div style="font-size: 0.78rem; color: var(--pm-text-secondary); display: flex; align-items: center; gap: 6px;">
            <span>💡 印刷小秘訣：AI 生成的小字容易糊邊，建議點擊「K100 純黑文字」覆蓋清晰向量字！</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="pm-btn pm-btn-ghost" id="btnCancelTextInspect">關閉</button>
            <button class="pm-btn pm-btn-primary" id="btnInspectFixWithK100">
              <span>🔤</span> 使用 K100 純黑文字修復 ➔
            </button>
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
             title="${reg.text} (${reg.isTypo ? '疑似錯字' : '正常'})">
          <span class="pm-bbox-tag">${reg.isTypo ? '⚠️ 錯字' : reg.isBlurry ? '🔍 模糊' : '✅ 正常'}</span>
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
              ? `<span class="pm-status-pill pm-status-warning">⚠️ 疑似異常</span>`
              : reg.isBlurry
              ? `<span class="pm-status-pill pm-status-info">🔍 邊緣偏軟</span>`
              : `<span class="pm-status-pill pm-status-success">✅ 正常</span>`
            }
          </div>
        </div>

        ${reg.typoReason ? `
          <div class="pm-text-card-issue">
            <span class="pm-issue-icon">⚠️</span>
            <span class="pm-issue-text">${reg.typoReason}</span>
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
                  📋 複製
                </button>
                <button class="pm-btn pm-btn-xs pm-btn-primary btn-apply-k100-single" data-text="${this.escapeHtml(reg.suggestion)}" title="直接載入 K100 純黑文字覆蓋此字">
                  🔤 向量修復
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

    // Fix with K100
    this.overlay.querySelector('#btnInspectFixWithK100')?.addEventListener('click', () => {
      const typoWithSuggestion = this.currentResult?.regions.find(r => r.suggestion);
      const defaultText = typoWithSuggestion?.suggestion || this.currentResult?.regions[0]?.text || 'PrintMagic';
      this.close();
      if (this.onFixWithVectorOverlay) {
        this.onFixWithVectorOverlay(defaultText);
      }
    });

    // Single fix with K100
    this.overlay.querySelectorAll<HTMLButtonElement>('.btn-apply-k100-single').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.dataset.text || '';
        this.close();
        if (this.onFixWithVectorOverlay) {
          this.onFixWithVectorOverlay(text);
        }
      });
    });

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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
