import { SoundEffects } from '../core/sound-effects';
import type { DpiAnalysis, PrintScoreResult } from '../types';

/**
 * 60fps Ultra-smooth Split-View Comparison Slider
 * Precision visual diffing with non-clipped badges and side-by-side weighted metric comparison card
 */
export class CompareSlider {
  private container: HTMLElement;
  private beforeImg: HTMLImageElement;
  private afterImg: HTMLImageElement;
  private divider: HTMLElement;
  private beforeTag: HTMLElement;
  private afterTag: HTMLElement;
  private metricsListEl: HTMLElement;
  private beforeScoreEl: HTMLElement;
  private afterScoreEl: HTMLElement;
  private scoreDeltaEl: HTMLElement;
  private complianceBadgeEl: HTMLElement;
  private isDragging = false;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Compare container #${containerId} not found`);
    this.container = el;

    this.render();
    this.beforeImg = this.container.querySelector('.pm-compare-before-img')!;
    this.afterImg = this.container.querySelector('.pm-compare-after-img')!;
    this.divider = this.container.querySelector('.pm-compare-divider')!;
    this.beforeTag = this.container.querySelector('.pm-compare-tag-before')!;
    this.afterTag = this.container.querySelector('.pm-compare-tag-after')!;
    this.metricsListEl = this.container.querySelector('#compareMetricsList')!;
    this.beforeScoreEl = this.container.querySelector('#cmpBeforeScore')!;
    this.afterScoreEl = this.container.querySelector('#cmpAfterScore')!;
    this.scoreDeltaEl = this.container.querySelector('#cmpScoreDelta')!;
    this.complianceBadgeEl = this.container.querySelector('#cmpComplianceBadge')!;

    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="pm-compare-container">
        <!-- Top Instruction Breadcrumb Hint -->
        <div class="pm-compare-header-hint">
          <span class="pm-compare-pill-badge pm-pill-before">◂ 原始原圖 (左側)</span>
          <span class="pm-compare-hint-text">拖曳中間白色滑桿即時比對 · 側邊檢視 7 大各項指標加權評分提升</span>
          <span class="pm-compare-pill-badge pm-pill-after">印刷準備優化 (右側) ▸</span>
        </div>

        <div class="pm-compare-main-layout">
          <!-- Left: Precision Split-View Image Comparison Slider -->
          <div class="pm-compare-wrapper">
            <!-- Base Layer: Processed (Right Side) -->
            <div class="pm-compare-layer pm-compare-after-layer">
              <img class="pm-compare-after-img" src="" alt="印刷準備優化" />
            </div>

            <!-- Overlay Layer: Original (Left Side, Clipped) -->
            <div class="pm-compare-layer pm-compare-before-layer">
              <img class="pm-compare-before-img" src="" alt="原始圖檔" />
            </div>

            <!-- High-Contrast Floating Badges (Fixed directly on Artwork, Never Clipped) -->
            <div class="pm-compare-overlay-tags">
              <div class="pm-compare-tag pm-compare-tag-before" title="左側畫面：原始上傳圖檔 (未超解析/未控墨)">
                <span class="pm-tag-dot pm-dot-before"></span>
                <span class="pm-tag-title"><img src="icons/shared/camera.webp" alt="" class="pm-icon-img" /> 原始原圖</span>
                <span class="pm-tag-desc">低解析 / 未校色</span>
              </div>
              <div class="pm-compare-tag pm-compare-tag-after" title="右側畫面：處理後結果">
                <span class="pm-tag-dot pm-dot-after"></span>
                <span class="pm-tag-title"><img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 印刷準備優化</span>
                <span class="pm-tag-desc">處理後</span>
              </div>
            </div>

            <!-- Central Drag Divider -->
            <div class="pm-compare-divider">
              <div class="pm-compare-handle" title="左右拖動滑桿比對">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
                </svg>
                <div class="pm-compare-handle-label">
                  <span>◂ 原圖</span>
                  <span class="pm-handle-sep">|</span>
                  <span>優化 ▸</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Side-by-Side 7-Metric Weighted Benchmark Score Panel -->
          <div class="pm-compare-metrics-card" id="compareMetricsCard">
            <div class="pm-cmp-card-header">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 1rem;"><img src="icons/shared/bar-chart.webp" alt="" class="pm-icon-img" /></span>
                <span style="font-weight: 700; font-size: 0.84rem; color: var(--pm-text-primary);">各項指標加權評分對照</span>
              </div>
              <span style="font-size: 0.65rem; color: var(--pm-text-muted); font-weight: 600;">印刷廠直出標準</span>
            </div>

            <!-- Total Score Transition Box -->
            <div class="pm-cmp-score-banner">
              <div class="pm-cmp-score-block pm-cmp-before">
                <span class="pm-cmp-score-label"><img src="icons/shared/camera.webp" alt="" class="pm-icon-img" /> 原圖總分</span>
                <span class="pm-cmp-score-num" id="cmpBeforeScore">--</span>
              </div>
              <div class="pm-cmp-arrow-box">
                <span class="pm-cmp-arrow">➔</span>
                <span class="pm-cmp-delta-pill" id="cmpScoreDelta">+0 分</span>
              </div>
              <div class="pm-cmp-score-block pm-cmp-after">
                <span class="pm-cmp-score-label"><img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 優化後總分</span>
                <span class="pm-cmp-score-num" id="cmpAfterScore">--</span>
              </div>
            </div>

            <!-- 7 Metrics Breakdown List -->
            <div class="pm-cmp-metrics-list" id="compareMetricsList">
              <div style="font-size: 0.74rem; color: var(--pm-text-muted); text-align: center; padding: 20px 0;">
                正在計算各項指標加權評分...
              </div>
            </div>

            <!-- Bottom Note -->
            <div class="pm-cmp-card-footer">
              <span id="cmpComplianceBadge"><img src="icons/shared/shield.webp" alt="" class="pm-icon-img" /> 檔案已符合本機印前檢查標準（尺寸/出血/DPI/墨量）</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  public setImages(
    beforeSrc: string,
    afterSrc: string,
    beforeScore?: PrintScoreResult,
    afterScore?: PrintScoreResult,
    beforeDpi?: DpiAnalysis,
    afterDpi?: DpiAnalysis
  ): void {
    this.beforeImg.src = beforeSrc;
    this.afterImg.src = afterSrc;
    this.setPosition(50);
    this.updateAfterTag(afterDpi);

    if (beforeScore && afterScore) {
      this.renderMetricsBreakdown(beforeScore, afterScore, beforeDpi, afterDpi);
    }
  }

  /** 依實際分析值更新右側標籤，不寫死倍率 / DPI */
  private updateAfterTag(afterDpi?: DpiAnalysis): void {
    if (!this.afterTag) return;
    const parts: string[] = [];
    if (afterDpi) parts.push(`${afterDpi.currentDpi} DPI`);
    const desc = this.afterTag.querySelector('.pm-tag-desc');
    if (desc) desc.textContent = parts.length ? parts.join(' / ') : '處理後';
    this.afterTag.title = parts.length ? `右側畫面：處理後結果（${parts.join('、')}）` : '右側畫面：處理後結果';
  }

  private renderMetricsBreakdown(
    beforeScore: PrintScoreResult,
    afterScore: PrintScoreResult,
    beforeDpi?: DpiAnalysis,
    afterDpi?: DpiAnalysis
  ): void {
    const bScore = Math.round(beforeScore.score);
    const aScore = Math.round(afterScore.score);
    const delta = aScore - bScore;

    this.beforeScoreEl.textContent = `${bScore}分`;
    this.afterScoreEl.textContent = `${aScore}分`;
    this.scoreDeltaEl.innerHTML = delta >= 0 ? `+${delta} 分 <img src="icons/shared/rocket.webp" alt="" class="pm-icon-img" />` : `${delta} 分`;
    this.scoreDeltaEl.className = `pm-cmp-delta-pill ${delta > 0 ? 'pm-delta-up' : ''}`;

    if (afterScore.issues.length === 0) {
      this.complianceBadgeEl.innerHTML = '<img src="icons/shared/shield.webp" alt="" class="pm-icon-img" /> 檔案已符合本機印前檢查標準（尺寸/出血/DPI/墨量）';
    } else {
      this.complianceBadgeEl.innerHTML = `<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 仍有 ${afterScore.issues.length} 項待改善：${afterScore.issues[0]}`;
    }

    const b = beforeScore.breakdown;
    const a = afterScore.breakdown;
    // After an upscale the pixel DPI overstates detail; the score uses effectiveDpi (see print-score.ts).
    const afterDetailDpi = afterScore.effectiveDpi ?? afterDpi?.currentDpi;
    const resolutionAfterSub = !afterDpi || afterDetailDpi === undefined
      ? '—'
      : afterDetailDpi < afterDpi.currentDpi
        ? `像素 ${afterDpi.currentDpi} DPI・細節約 ${afterDetailDpi} DPI ${afterDetailDpi >= afterDpi.targetDpi ? '(達標)' : '(未達標)'}`
        : `${afterDpi.currentDpi} DPI ${afterDpi.currentDpi >= afterDpi.targetDpi ? '(達標)' : '(未達標)'}`;

    const metricsConfig = [
      {
        id: 'resolution',
        icon: '<img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" />',
        name: '實體解析度',
        weight: '40%',
        beforeVal: Math.round(b.resolution),
        afterVal: Math.round(a.resolution),
        beforeSub: beforeDpi ? `${beforeDpi.currentDpi} DPI` : '',
        afterSub: resolutionAfterSub
      },
      {
        id: 'aspectRatio',
        icon: '<img src="icons/shared/ruler-vector.webp" alt="" class="pm-icon-img" />',
        name: '長寬比例適配',
        weight: '15%',
        beforeVal: Math.round(b.aspectRatio),
        afterVal: Math.round(a.aspectRatio),
        beforeSub: '原始比例',
        afterSub: '自動出血適配'
      },
      {
        id: 'sharpness',
        icon: '<img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" />',
        name: '邊緣銳利度',
        weight: '15%',
        beforeVal: Math.round(b.sharpness),
        afterVal: Math.round(a.sharpness),
        beforeSub: '原始細節',
        afterSub: 'USM 微米銳化'
      },
      {
        id: 'contrast',
        icon: '<img src="icons/shared/contrast.webp" alt="" class="pm-icon-img" />',
        name: '暗階對比度',
        weight: '10%',
        beforeVal: Math.round(b.contrast),
        afterVal: Math.round(a.contrast),
        beforeSub: '原始階調',
        afterSub: '暗部浮起補償'
      },
      {
        id: 'saturation',
        icon: '<img src="icons/shared/rainbow-gamut.webp" alt="" class="pm-icon-img" />',
        name: '色彩飽和度',
        weight: '10%',
        beforeVal: Math.round(b.saturation),
        afterVal: Math.round(a.saturation),
        beforeSub: 'sRGB 色彩',
        afterSub: 'CMYK 色域映射'
      },
      {
        id: 'brightness',
        icon: '<img src="icons/header/guide.webp" alt="" class="pm-icon-img" />',
        name: '明暗分佈',
        weight: '10%',
        beforeVal: Math.round(b.brightness),
        afterVal: Math.round(a.brightness),
        beforeSub: '原始亮度',
        afterSub: '動態平衡'
      }
    ];

    this.metricsListEl.innerHTML = metricsConfig
      .map((m) => {
        const itemDelta = m.afterVal - m.beforeVal;
        return `
        <div class="pm-cmp-metric-row">
          <div class="pm-cmp-metric-left">
            <span class="pm-cmp-metric-icon">${m.icon}</span>
            <div class="pm-cmp-metric-info">
              <div style="display: flex; align-items: center; gap: 4px;">
                <span class="pm-cmp-metric-name">${m.name}</span>
                <span class="pm-cmp-metric-weight">${m.weight}</span>
              </div>
              <div class="pm-cmp-metric-sub">
                <span class="pm-sub-before">${m.beforeSub}</span>
                <span style="opacity: 0.4;">➔</span>
                <span class="pm-sub-after">${m.afterSub}</span>
              </div>
            </div>
          </div>

          <div class="pm-cmp-metric-right">
            <div class="pm-cmp-score-tags">
              <span class="pm-score-before">${m.beforeVal}</span>
              <span class="pm-score-arrow">➔</span>
              <span class="pm-score-after">${m.afterVal}</span>
            </div>
            ${
              itemDelta > 0
                ? `<span class="pm-cmp-item-delta">+${itemDelta}</span>`
                : `<span class="pm-cmp-item-delta pm-delta-flat">維持</span>`
            }
          </div>
        </div>
      `;
      })
      .join('');
  }

  private bindEvents(): void {
    const wrapper = this.container.querySelector('.pm-compare-wrapper') as HTMLElement;
    if (!wrapper) return;

    const startDrag = (e: MouseEvent | TouchEvent) => {
      this.isDragging = true;
      wrapper.classList.add('pm-compare-active');
      SoundEffects.sliderTick();
      this.updatePositionFromEvent(e, wrapper);
    };

    const stopDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        wrapper.classList.remove('pm-compare-active');
      }
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      this.updatePositionFromEvent(e, wrapper);
    };

    // Mouse Events
    wrapper.addEventListener('mousedown', startDrag);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('mousemove', onMove);

    // Touch Events
    wrapper.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchend', stopDrag);
    window.addEventListener('touchcancel', stopDrag);
    window.addEventListener('touchmove', onMove, { passive: true });
  }

  private updatePositionFromEvent(e: MouseEvent | TouchEvent, wrapper: HTMLElement): void {
    const rect = wrapper.getBoundingClientRect();
    let clientX: number;
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return;
      clientX = t.clientX;
    } else {
      clientX = e.clientX;
    }
    const offsetX = clientX - rect.left;
    let percent = (offsetX / rect.width) * 100;
    percent = Math.max(0, Math.min(100, percent));
    this.setPosition(percent);
  }

  public setPosition(percent: number): void {
    const beforeLayer = this.container.querySelector('.pm-compare-before-layer') as HTMLElement;
    if (beforeLayer && this.divider) {
      beforeLayer.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
      this.divider.style.left = `${percent}%`;

      // Smart badge opacity based on divider overlap
      if (this.beforeTag && this.afterTag) {
        this.beforeTag.style.opacity = percent < 15 ? '0.25' : '1';
        this.afterTag.style.opacity = percent > 85 ? '0.25' : '1';
      }
    }
  }
}
