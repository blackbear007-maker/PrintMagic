import type { AppState } from './state';
import { renderPipelineSwitchList, bindPipelineSwitchList } from './pipeline-matrix-modal';

/**
 * PrintPass™ Pre-press Diagnostic Certificate Component
 * Apple Minimalist Progressive Disclosure Design
 */
export class DiagnosticCard {
  private container: HTMLElement;
  private onExportPdfClick?: () => void;
  private onOpenTextInspectorClick?: () => void;
  private onOpenExportCenterClick?: () => void;
  private onPipelineOptionsChange?: () => void;
  private isDetailsExpanded = false;

  constructor(
    containerId: string,
    onExportPdfClick?: () => void,
    onPipelineOptionsChange?: () => void,
    onOpenTextInspectorClick?: () => void,
    onOpenExportCenterClick?: () => void
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Diagnostic card #${containerId} not found`);
    this.container = el;
    this.onExportPdfClick = onExportPdfClick;
    this.onOpenTextInspectorClick = onOpenTextInspectorClick;
    this.onOpenExportCenterClick = onOpenExportCenterClick;
    this.onPipelineOptionsChange = onPipelineOptionsChange;
  }

  public render(state: AppState): void {
    const {
      scoreResult,
      originalScoreResult,
      dpiAnalysis,
      originalDpiAnalysis,
      currentPreset,
      uiMode,
      textInspectionResult,
      pipelineOptions
    } = state;

    if (!scoreResult || !dpiAnalysis) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';

    const currentScore = scoreResult.score;
    const initialScore = originalScoreResult ? originalScoreResult.score : currentScore;
    const deltaScore = currentScore - initialScore;

    const levelClass = currentScore >= 88 ? 'pm-score-high' : currentScore >= 70 ? 'pm-score-mid' : 'pm-score-low';
    const levelColor = currentScore >= 88 ? '#34c759' : currentScore >= 70 ? '#ff9500' : '#ff3b30';

    const { breakdown, issues } = scoreResult;
    const initialBreakdown = originalScoreResult ? originalScoreResult.breakdown : breakdown;

    // 出血依實際規格（部分預設為 1.5 / 2 / 0 mm），且出血是在匯出 PDF 時才加上
    const bleedMm = currentPreset.bleedMm ?? 0;
    const bleedText = bleedMm > 0 ? `${bleedMm}mm 出血` : '此規格無出血';

    // Millimeter dimensions
    const physicalSizeText = currentPreset.widthMm > 0
      ? `${currentPreset.widthMm} × ${currentPreset.heightMm} mm`
      : `${dpiAnalysis.targetWidthPx} × ${dpiAnalysis.targetHeightPx} px`;

    // DPI comparison text
    const initDpi = originalDpiAnalysis ? originalDpiAnalysis.currentDpi : dpiAnalysis.currentDpi;
    const finalDpi = dpiAnalysis.currentDpi;
    const dpiCompText = initDpi !== finalDpi
      ? `${initDpi} ➔ ${finalDpi} DPI`
      : `${finalDpi} DPI`;

    // 2026-09-24：進階模式可以逐項開關處理步驟，所以下面的說明文字一律依「實際開關狀態」產生，不再寫死
    // 「已套用 USM 銳化」這類字——使用者關掉對應開關後就會變成假的。
    const targetDpi = dpiAnalysis.targetDpi;
    const upscaled = finalDpi > initDpi;
    const detailDpi = scoreResult.effectiveDpi;
    const detailNote = detailDpi !== undefined && detailDpi < finalDpi
      ? `，但放大補不出原圖沒有的細節，清晰度約相當於 <strong>${detailDpi} DPI</strong>`
      : '';
    const resolutionDesc = upscaled
      ? `已放大到 <strong>${finalDpi} DPI</strong>（目標 ${targetDpi} DPI）${detailNote}`
      : !originalDpiAnalysis?.needsUpscale
        ? `原圖已有 <strong>${finalDpi} DPI</strong>，不需放大`
        : pipelineOptions.enableUpscale
          ? `目前 <strong>${finalDpi} DPI</strong>，低於目標 ${targetDpi} DPI`
          : `放大已關閉：目前 <strong>${finalDpi} DPI</strong>，低於目標 ${targetDpi} DPI`;
    const bleedDesc = bleedMm <= 0
      ? '此規格無出血（數位用途）'
      : pipelineOptions.enableBleedExpand
        ? `四邊已鏡像延伸 <strong>${bleedMm}mm 出血</strong>，降低裁切偏差露白邊的風險`
        : `自動補出血已關閉：PDF 仍保留 ${bleedMm}mm 出血區，但圖片會被拉伸填滿，邊緣內容會被裁掉`;
    const toneSteps = [
      pipelineOptions.enableSharpening ? 'USM 銳化' : '',
      pipelineOptions.enableShadowLift ? '暗部提亮' : '',
      pipelineOptions.enableAntiBanding ? '漸層防斷階' : ''
    ].filter(Boolean);
    const toneDesc = `${toneSteps.length > 0 ? `已套用 ${toneSteps.join('、')}` : '未套用銳化與階調調整'}。下載 PDF 時會依所選色彩描述檔分色成 CMYK；分色服務無法使用時改輸出 RGB，由印刷廠轉檔`;

    // Delta badge
    const deltaBadge = deltaScore > 0
      ? `<span class="pm-score-delta-badge">+${deltaScore} 分升級</span>`
      : deltaScore === 0
      ? `<span class="pm-score-delta-badge pm-delta-neutral">最佳化維持</span>`
      : '';

    // Text Inspection Status Badge
    let textInspectHtml = '';
    if (textInspectionResult) {
      const isTypo = textInspectionResult.typoCount > 0;
      textInspectHtml = `
        <div class="pm-diag-text-inspect-banner ${isTypo ? 'pm-banner-warning' : 'pm-banner-success'}" id="btnOpenTextInspectFromCard">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.1rem;">${isTypo ? '<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" />' : '<img src="icons/header/text-inspect.webp" alt="" class="pm-icon-img" />'}</span>
            <div>
              <div style="font-weight: 700; font-size: 0.82rem; color: var(--pm-text-primary);">
                ${isTypo
                  ? `發現 ${textInspectionResult.typoCount} 處文字疑似異常`
                  : textInspectionResult.regions.length === 0
                    ? '沒有偵測到文字區塊'
                    : `偵測到 ${textInspectionResult.regions.length} 處文字區塊`}
              </div>
              <div style="font-size: 0.72rem; color: var(--pm-text-secondary);">
                ${textInspectionResult.regions.length === 0 && !isTypo
                  ? '偵測可能漏掉大字或藝術字；圖中若有文字，錯字請自行確認。'
                  : textInspectionResult.summary}
              </div>
            </div>
          </div>
          <button class="pm-btn pm-btn-xs ${isTypo ? 'pm-btn-artisan' : 'pm-btn-ghost'}" type="button">
            ${isTypo ? '點擊糾錯 ➔' : '查看詳情'}
          </button>
        </div>
      `;
    } else {
      textInspectHtml = `
        <div class="pm-diag-text-inspect-banner" id="btnOpenTextInspectFromCard" style="cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.1rem;"><img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" /></span>
            <div>
              <div style="font-weight: 700; font-size: 0.82rem; color: var(--pm-text-primary);">文字區域偵測</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-secondary);">點擊偵測圖片中的文字位置（不讀取內容，錯字需自行確認）</div>
            </div>
          </div>
          <button class="pm-btn pm-btn-xs pm-btn-ghost" type="button">
            立即檢查 ➔
          </button>
        </div>
      `;
    }

    // Render depending on uiMode (Simple vs Advanced)
    if (uiMode === 'simple') {
      // 簡易模式：使用者不需要知道系統改了什麼，只看修正前後評分，然後下載。
      // 處理項目開關、規格、更多格式都在「進階」模式，同一個畫面、同一張圖。
      this.container.innerHTML = `
        <div class="pm-card pm-diagnostic-panel pm-panel-simple">
          <div class="pm-simple-score">
            <div class="pm-simple-score-col">
              <span class="pm-simple-score-label">修正前</span>
              <span class="pm-simple-score-num">${initialScore}</span>
            </div>
            <span class="pm-simple-score-arrow" aria-hidden="true">→</span>
            <div class="pm-simple-score-col">
              <span class="pm-simple-score-label">修正後</span>
              <span class="pm-simple-score-num pm-simple-score-after" style="color: ${levelColor};">${currentScore}</span>
            </div>
          </div>

          <div class="pm-diag-hero-actions">
            <button class="pm-btn pm-btn-primary pm-btn-lg btn-diag-export-pdf" style="font-size: 0.95rem; font-weight: 700; width: 100%; box-shadow: 0 4px 14px rgba(60, 30, 140, 0.35);" title="下載含出血與裁切線的印刷用 PDF">
              下載印刷檔 (PDF)
            </button>
          </div>

        </div>
      `;
    } else {
      // Advanced Mode UI
      this.container.innerHTML = `
        <div class="pm-card pm-diagnostic-panel pm-panel-advanced">
          <!-- 1. Hero Certificate Header -->
          <div class="pm-diagnostic-header">
            <div class="pm-score-summary-box">
              <div class="pm-score-circle" style="border-color: ${levelColor}">
                <span class="pm-score-value" style="color: ${levelColor}">${currentScore}</span>
                <span class="pm-score-max">/100分</span>
              </div>

              <div class="pm-score-meta">
                <div class="pm-score-flow-row">
                  <span class="pm-score-stage-tag">原圖 ${initialScore}分</span>
                  <span class="pm-score-arrow">➔</span>
                  <span class="pm-score-stage-tag pm-stage-after">優化後 ${currentScore}分</span>
                  ${deltaBadge}
                </div>
                <div class="pm-score-verdict ${levelClass}">${scoreResult.verdict}</div>
              </div>
            </div>
          </div>

          <!-- 1b. Processing switches: the same steps simple mode applies silently, now user-selectable.
               Each toggle re-runs the pipeline on the current image immediately. -->
          <div class="pm-adv-switches">
            <div class="pm-adv-switches-title">處理項目 · 切換後立即重新處理</div>
            <div class="pm-adv-switches-list" id="diagPipelineSwitches">
              ${renderPipelineSwitchList(true)}
            </div>
          </div>

          <!-- 2. Clean Specs Pills -->
          <div class="pm-target-specs">
            <div class="pm-spec-item">
              <span class="pm-spec-label">目標規格</span>
              <span class="pm-spec-val">${currentPreset.nameZh}</span>
            </div>
            <div class="pm-spec-item">
              <span class="pm-spec-label">物理尺寸</span>
              <span class="pm-spec-val">${physicalSizeText}</span>
            </div>
            <div class="pm-spec-item">
              <span class="pm-spec-label">實體解析度</span>
              <span class="pm-spec-val ${dpiAnalysis.needsUpscale ? 'pm-text-warning' : 'pm-text-success'}">
                ${dpiCompText}
              </span>
            </div>
          </div>

          <!-- Text Inspection Banner -->
          ${textInspectHtml}

          <!-- 3. Key Hero Action Buttons (Standard PDF & High-Res PNG & Pipeline Customizer) -->
          <div class="pm-diag-hero-actions">
            <button class="pm-btn pm-btn-primary pm-btn-lg btn-diag-export-pdf" style="width: 100%; font-weight: 700; box-shadow: 0 4px 14px rgba(60, 30, 140, 0.35);" title="下載含裁切十字、色條與出血之標準印刷 PDF">
              <span><img src="icons/shared/document-page.webp" alt="" class="pm-icon-img" /></span> 下載印刷 PDF${bleedMm > 0 ? ' (含出血)' : ''}
            </button>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
              <button class="pm-btn pm-btn-secondary pm-btn-md btn-diag-export-png" title="下載 300 DPI 高解析度 PNG 影像檔">
                <span><img src="icons/shared/download.webp" alt="" class="pm-icon-img" /></span> 下載高清 PNG
              </button>
              <button class="pm-btn pm-btn-secondary pm-btn-md btn-diag-open-export" title="選擇輸出 TIFF / JPG / 向量刀模 SVG 或一鍵全打包出機 ZIP">
                <span><img src="icons/shared/printer.webp" alt="" class="pm-icon-img" /></span> 更多格式
              </button>
            </div>
          </div>

          <!-- 4. Modern 4-Pillar Visual Print Safety Cards (2x2 Grid) -->
          <div class="pm-diag-accordion-wrapper" style="margin-top: 14px;">
            <div class="pm-safety-tiles-grid">
              <!-- Tile 1: Resolution -->
              <div class="pm-safety-tile">
                <div class="pm-safety-tile-top">
                  <div class="pm-safety-tile-title">
                    <span class="pm-safety-tile-icon"><img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" /></span>
                    <span class="pm-safety-tile-name">畫質解析度</span>
                  </div>
                  <span class="pm-safety-badge ${breakdown.resolution >= 90 ? 'pm-badge-pass' : 'pm-badge-warn'}">
                    ${breakdown.resolution >= 90 ? '<img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 足夠' : '<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 不足'} · ${breakdown.resolution}分
                  </span>
                </div>
                <div class="pm-safety-tile-desc">
                  ${resolutionDesc}
                </div>
              </div>

              <!-- Tile 2: Bleed & Safety Crop -->
              <div class="pm-safety-tile">
                <div class="pm-safety-tile-top">
                  <div class="pm-safety-tile-title">
                    <span class="pm-safety-tile-icon"><img src="icons/shared/ruler-vector.webp" alt="" class="pm-icon-img" /></span>
                    <span class="pm-safety-tile-name">出血與防裁切</span>
                  </div>
                  <span class="pm-safety-badge ${breakdown.aspectRatio >= 90 ? 'pm-badge-pass' : 'pm-badge-warn'}">
                    ${breakdown.aspectRatio >= 90 ? '<img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 安全防切' : '<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 需檢查裁切'} · ${breakdown.aspectRatio}分
                  </span>
                </div>
                <div class="pm-safety-tile-desc">
                  ${bleedDesc}
                </div>
              </div>

              <!-- Tile 4: Color & Tone -->
              <div class="pm-safety-tile">
                <div class="pm-safety-tile-top">
                  <div class="pm-safety-tile-title">
                    <span class="pm-safety-tile-icon"><img src="icons/shared/palette.webp" alt="" class="pm-icon-img" /></span>
                    <span class="pm-safety-tile-name">色彩與階調</span>
                  </div>
                  <span class="pm-safety-badge ${breakdown.saturation >= 90 ? 'pm-badge-pass' : 'pm-badge-warn'}">
                    ${breakdown.saturation >= 90 ? '<img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 正常' : '<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 需留意'} · ${breakdown.saturation}分
                  </span>
                </div>
                <div class="pm-safety-tile-desc">
                  ${toneDesc}
                </div>
              </div>
            </div>

            <!-- Open issues. (The old "系統已自動完成" tag list claimed every step ran regardless of the
                 switches above, which now show exactly what's on.) -->
            ${issues.length > 0 ? `
              <div class="pm-auto-summary-box">
                ${issues.map((issue) => `
                  <div class="pm-diag-warning-inline">
                    <span><img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /></span> ${issue}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Optional Collapsible Deep Metrics Toggle -->
            <button class="pm-diag-accordion-toggle" id="btnToggleDiagAccordion" type="button" style="margin-top: 10px; padding: 6px 10px; font-size: 0.72rem;">
              <span class="pm-accordion-title">
                <span><img src="icons/shared/bar-chart.webp" alt="" class="pm-icon-img" /></span>
                <span>${this.isDetailsExpanded ? '收合 7 項詳細數值對比' : '展開 7 項詳細數值對比'}</span>
              </span>
              <span class="pm-accordion-icon">${this.isDetailsExpanded ? '▲' : '▼'}</span>
            </button>

            <div class="pm-diag-accordion-content" style="display: ${this.isDetailsExpanded ? 'block' : 'none'};">
              <!-- Weighted factor comparison table -->
              <div class="pm-weighted-section">
                <div class="pm-metrics-grid">
                  ${this.renderWeightedRow('解析度適配', '40%', initialBreakdown.resolution, breakdown.resolution, `目標 ${targetDpi} DPI`)}
                  ${this.renderWeightedRow('長寬比契合', '15%', initialBreakdown.aspectRatio, breakdown.aspectRatio, `${bleedText}與安全框裁切保護`)}
                  ${this.renderWeightedRow('微細邊緣銳度', '15%', initialBreakdown.sharpness, breakdown.sharpness, '邊緣與小字的清晰程度')}
                  ${this.renderWeightedRow('亮部與暗階', '10%', initialBreakdown.brightness, breakdown.brightness, '暗部是否會印得太黑')}
                  ${this.renderWeightedRow('色彩飽和度', '10%', initialBreakdown.saturation, breakdown.saturation, '色彩飽和程度')}
                  ${this.renderWeightedRow('反差與層次', '10%', initialBreakdown.contrast, breakdown.contrast, '明暗層次')}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Event Bindings
    this.bindEvents(state);
  }

  private bindEvents(state: AppState): void {
    // 2. Export PDF CTA
    this.container.querySelector('.btn-diag-export-pdf')?.addEventListener('click', () => {
      if (this.onExportPdfClick) {
        this.onExportPdfClick();
      }
    });

    // 2b. Export Multi-Format CTA (TIFF, PNG, JPG, SVG, ZIP)
    this.container.querySelectorAll('.btn-diag-open-export').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.onOpenExportCenterClick) {
          this.onOpenExportCenterClick();
        } else {
          document.getElementById('btnExportAllFormats')?.click();
        }
      });
    });

    // 2c. Export PNG CTA
    this.container.querySelector('.btn-diag-export-png')?.addEventListener('click', () => {
      document.getElementById('btnExportPng')?.click();
    });

    // 2d. Advanced-mode inline processing switches
    const switches = this.container.querySelector<HTMLElement>('#diagPipelineSwitches');
    if (switches) {
      bindPipelineSwitchList(switches, () => this.onPipelineOptionsChange?.(), true);
    }

    // 4. Text Inspection CTA
    this.container.querySelector('#btnOpenTextInspectFromCard')?.addEventListener('click', () => {
      if (this.onOpenTextInspectorClick) {
        this.onOpenTextInspectorClick();
      }
    });

    // 6. Accordion Toggle
    const accordionBtn = this.container.querySelector('#btnToggleDiagAccordion');
    accordionBtn?.addEventListener('click', () => {
      this.isDetailsExpanded = !this.isDetailsExpanded;
      this.render(state);
    });
  }

  private renderWeightedRow(
    label: string,
    weight: string,
    beforeScore: number,
    afterScore: number,
    actionDesc: string
  ): string {
    const beforeColor = beforeScore >= 85 ? '#34c759' : beforeScore >= 65 ? '#ff9500' : '#ff3b30';
    const afterColor = afterScore >= 85 ? '#34c759' : afterScore >= 65 ? '#ff9500' : '#ff3b30';
    const delta = afterScore - beforeScore;
    const deltaStr = delta > 0 ? `+${delta}` : delta === 0 ? '±0' : `${delta}`;
    const deltaClass = delta > 0 ? 'pm-val-up' : 'pm-val-same';

    return `
      <div class="pm-weighted-row">
        <div class="pm-metric-header">
          <div class="pm-metric-label-group">
            <span class="pm-metric-name">${label}</span>
            <span class="pm-metric-weight">權重 ${weight}</span>
          </div>

          <div class="pm-metric-scores-compare">
            <span class="pm-score-before" style="color: ${beforeColor}">${beforeScore}分</span>
            <span class="pm-score-sep">➔</span>
            <span class="pm-score-after" style="color: ${afterColor}">${afterScore}分</span>
            <span class="pm-score-delta-chip ${deltaClass}">${deltaStr}</span>
          </div>
        </div>

        <div class="pm-metric-track">
          <div class="pm-metric-fill" style="width: ${afterScore}%; background-color: ${afterColor}"></div>
        </div>
        <div class="pm-metric-action-hint"><img src="icons/header/guide.webp" alt="" class="pm-icon-img" /> ${actionDesc}</div>
      </div>
    `;
  }
}
