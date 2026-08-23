import { store } from './state';
import { SoundEffects } from '../core/sound-effects';
import type { BatchItem } from '../types';

export type BatchActionCallback = {
  onAddFiles: (files: FileList | File[]) => void;
  onBatchOptimize: () => void;
  onBatchExportPdf: () => void;
};

/**
 * Batch Studio Gallery Filmstrip Bar Component
 */
export class BatchBar {
  private container: HTMLElement;
  private callbacks: BatchActionCallback;
  private fileInput: HTMLInputElement;

  constructor(containerId: string, callbacks: BatchActionCallback) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Batch container #${containerId} not found`);
    this.container = el;
    this.callbacks = callbacks;

    // Create hidden multi-file input for batch adding
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.multiple = true;
    this.fileInput.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/gif,image/heic,image/avif';
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        this.callbacks.onAddFiles(target.files);
        this.fileInput.value = '';
      }
    });

    this.subscribeState();
  }

  private subscribeState(): void {
    store.subscribe((state) => {
      this.render(state.batchItems, state.activeBatchId);
    });
  }

  public render(items: BatchItem[], activeId: string | null): void {
    if (items.length === 0) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';

    const itemsHtml = items
      .map((item, idx) => {
        const isActive = item.id === activeId;
        const score = item.scoreResult?.score;
        let scoreBadge = '';

        if (score !== undefined) {
          const badgeClass = score >= 88 ? 'pm-badge-success' : score >= 70 ? 'pm-badge-warning' : 'pm-badge-danger';
          scoreBadge = `<span class="pm-film-score ${badgeClass}">${score}分</span>`;
        }

        const thumbSrc = item.processedDataUrl || item.originalDataUrl;
        const isProcessing = item.status === 'processing';

        const safeName = this.escape(item.name);
        return `
          <div class="pm-film-item ${isActive ? 'active' : ''}" data-id="${item.id}" title="${safeName}">
            <div class="pm-film-thumb-wrap">
              <img src="${thumbSrc}" alt="${safeName}" class="pm-film-thumb" />
              ${isProcessing ? '<div class="pm-film-spinner"><div class="pm-mini-spinner"></div></div>' : ''}
              ${scoreBadge}
              <button class="pm-film-remove" data-remove-id="${item.id}" title="移除此作品">✕</button>
            </div>
            <div class="pm-film-meta">
              <span class="pm-film-num">#${idx + 1}</span>
              <span class="pm-film-name">${safeName}</span>
            </div>
          </div>
        `;
      })
      .join('');

    this.container.innerHTML = `
      <div class="pm-batch-bar-inner">
        <div class="pm-batch-header">
          <div class="pm-batch-title-group">
            <span class="pm-batch-icon">🎞️</span>
            <span class="pm-batch-title">畫廊工作台</span>
            <span class="pm-batch-count">(${items.length}/20 張作品)</span>
          </div>

          <div class="pm-batch-actions">
            <button id="btnBatchAdd" class="pm-btn pm-btn-ghost pm-btn-sm" ${items.length >= 20 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} title="${items.length >= 20 ? '已達批次處理上限 (最多 20 張)' : '加入更多圖片 (最多 20 張)'}">
              <span>＋</span> ${items.length >= 20 ? '已達上限 (20/20)' : '加入圖片'}
            </button>
            <button id="btnBatchOptimize" class="pm-btn pm-btn-artisan pm-btn-sm" title="一鍵將全部作品自動分析並套用印刷優化">
              <span>⚡</span> 批次全優化
            </button>
            <button id="btnBatchExportPdf" class="pm-btn pm-btn-primary pm-btn-sm" title="一鍵將全部作品連續匯出標準印刷 PDF">
              <span>📦</span> 批次匯出全部
            </button>
          </div>
        </div>

        <div class="pm-filmstrip" id="filmstripScroll">
          ${itemsHtml}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Select item
    this.container.querySelectorAll<HTMLElement>('.pm-film-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        // Prevent click if clicking remove button
        if ((e.target as HTMLElement).closest('.pm-film-remove')) return;

        const id = el.dataset.id;
        if (id) {
          store.selectBatchItem(id);
          SoundEffects.sliderTick();
        }
      });
    });

    // Remove item
    this.container.querySelectorAll<HTMLElement>('.pm-film-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.removeId;
        if (id) {
          store.removeBatchItem(id);
          SoundEffects.paperDrop();
        }
      });
    });

    // Add button
    this.container.querySelector('#btnBatchAdd')?.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Batch optimize button
    this.container.querySelector('#btnBatchOptimize')?.addEventListener('click', () => {
      this.callbacks.onBatchOptimize();
    });

    // Batch export PDF button
    this.container.querySelector('#btnBatchExportPdf')?.addEventListener('click', () => {
      this.callbacks.onBatchExportPdf();
    });
  }

  private escape(str: string): string {
    return str.replace(/[&<>"']/g, (m) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[m];
    });
  }
}
