import type { AppState } from './state';

/**
 * PrintPass™ Pre-press Diagnostic Certificate Component
 * Apple Minimalist Progressive Disclosure Design
 */
export class DiagnosticCard {
  private container: HTMLElement;
  private onDirectPrintClick?: () => void;
  private onExportPdfClick?: () => void;
  private onOpenPipelineMatrix?: () => void;
  private onOpenTextInspectorClick?: () => void;
  private isDetailsExpanded = false;

  constructor(
    containerId: string,
    onDirectPrintClick?: () => void,
    onExportPdfClick?: () => void,
    onOpenPipelineMatrix?: () => void,
    onOpenTextInspectorClick?: () => void
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Diagnostic card #${containerId} not found`);
    this.container = el;
    this.onDirectPrintClick = onDirectPrintClick;
    this.onExportPdfClick = onExportPdfClick;
    this.onOpenPipelineMatrix = onOpenPipelineMatrix;
    this.onOpenTextInspectorClick = onOpenTextInspectorClick;
  }

  public render(state: AppState): void {
    const {
      scoreResult,
      originalScoreResult,
      dpiAnalysis,
      originalDpiAnalysis,
      inkAnalysis,
      originalInkAnalysis,
      currentPreset,
      appliedScale,
      uiMode,
      textInspectionResult
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

    const { breakdown, issues, recommendations } = scoreResult;
    const initialBreakdown = originalScoreResult ? originalScoreResult.breakdown : breakdown;

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

    // TAC comparison text
    const initTac = originalInkAnalysis ? originalInkAnalysis.maxTotalInk : (inkAnalysis ? inkAnalysis.maxTotalInk : 300);
    const finalTac = inkAnalysis ? inkAnalysis.maxTotalInk : 300;
    const tacCompText = initTac !== finalTac
      ? `${initTac}% ➔ ${finalTac}%`
      : `${finalTac}%`;

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
            <span style="font-size: 1.1rem;">${isTypo ? '⚠️' : '📝'}</span>
            <div>
              <div style="font-weight: 700; font-size: 0.82rem; color: var(--pm-text-primary);">
                ${isTypo ? `發現 ${textInspectionResult.typoCount} 處文字疑似異常` : '文字拼寫與排版檢驗通過'}
              </div>
              <div style="font-size: 0.72rem; color: var(--pm-text-secondary);">
                ${textInspectionResult.summary}
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
            <span style="font-size: 1.1rem;">🔍</span>
            <div>
              <div style="font-weight: 700; font-size: 0.82rem; color: var(--pm-text-primary);">AI 智慧文字檢查</div>
              <div style="font-size: 0.72rem; color: var(--pm-text-secondary);">點擊一鍵檢查圖片中是否有錯字或 AI 亂碼</div>
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
      this.container.innerHTML = `
        <div class="pm-card pm-diagnostic-panel pm-panel-simple">
          <!-- 1. Hero Score Header -->
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
                <div class="pm-score-verdict ${levelClass}">✨ ${scoreResult.verdict}</div>
              </div>
            </div>
          </div>

          <!-- 2. Plain Language 3-Pillar Quality Upgrade Cards -->
          <div class="pm-simple-upgrades-grid">
            <div class="pm-upgrade-card">
              <div class="pm-upgrade-icon">🌟</div>
              <div class="pm-upgrade-content">
                <div class="pm-upgrade-title">畫質超解析度升級</div>
                <div class="pm-upgrade-desc">自動由 72 DPI 提升至 <strong>${finalDpi} DPI 印刷級超高清晰度</strong>，細節銳利無鋸齒。</div>
              </div>
            </div>

            <div class="pm-upgrade-card">
              <div class="pm-upgrade-icon">📐</div>
              <div class="pm-upgrade-content">
                <div class="pm-upgrade-title">3mm 出血防裁切保護</div>
                <div class="pm-upgrade-desc">已適配 <strong>${currentPreset.nameZh} (${physicalSizeText})</strong>，保證重要內容不被切掉。</div>
              </div>
            </div>

            <div class="pm-upgrade-card">
              <div class="pm-upgrade-icon">🎨</div>
              <div class="pm-upgrade-content">
                <div class="pm-upgrade-title">印刷墨量色彩安全校正</div>
                <div class="pm-upgrade-desc">墨量安全壓制至 <strong>${finalTac}%</strong>，防吸墨過重背印沾黏，顏色自然還原。</div>
              </div>
            </div>
          </div>

          <!-- 3. Text Inspection Banner -->
          ${textInspectHtml}

          <!-- Beginner Peace of Mind Banner (消除新手送印恐慌) -->
          <div style="background: rgba(0, 113, 227, 0.05); border: 1px solid rgba(0, 113, 227, 0.15); border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: var(--pm-text-secondary); line-height: 1.4;">
            <span style="font-size: 1rem;">🛡️</span>
            <span><strong>零退件品質保證：</strong>檔案已內嵌標準向量裁切標記、CMYK 色彩與安全墨量，直接傳給任何印刷廠或超商機台即可安心出機！</span>
          </div>

          <!-- 4. Big Action Buttons -->
          <div class="pm-diag-hero-actions">
            <button class="pm-btn pm-btn-primary pm-btn-lg btn-diag-export-pdf" style="font-size: 0.95rem; font-weight: 700; width: 100%; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);" title="一鍵下載最高畫質印刷標準檔">
              <span>🌟</span> 一鍵下載標準印刷檔 (PDF)
            </button>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
              <button class="pm-btn pm-btn-secondary pm-btn-md btn-diag-export-png" title="下載 300 DPI 高解析度 PNG 影像檔">
                <span>📥</span> 下載高清 PNG
              </button>
              <button class="pm-btn pm-btn-secondary pm-btn-md" id="btnSimpleOpenConvPrint" title="7-11 / 全家超商雲端 30 秒下樓立印">
                <span>🏪</span> 超商 30 秒立印
              </button>
            </div>
          </div>

          <!-- 5. Progressive Disclosure: Toggle Technical Specs -->
          <div class="pm-diag-accordion-wrapper" style="margin-top: 14px;">
            <button class="pm-diag-accordion-toggle" id="btnToggleDiagAccordion" type="button">
              <span class="pm-accordion-title">
                <span>📊</span>
                <span>${this.isDetailsExpanded ? '收合詳細檢驗數據' : '查看 7 項專業印前檢測指標詳情'}</span>
              </span>
              <span class="pm-accordion-icon">${this.isDetailsExpanded ? '▲' : '▼'}</span>
            </button>

            <div class="pm-diag-accordion-content" style="display: ${this.isDetailsExpanded ? 'block' : 'none'};">
              <div class="pm-weighted-section">
                <div class="pm-metrics-grid">
                  ${this.renderWeightedRow('解析度適配', '35%', initialBreakdown.resolution, breakdown.resolution, 'Lanczos-3 重採樣補足 300 DPI')}
                  ${this.renderWeightedRow('長寬比契合', '15%', initialBreakdown.aspectRatio, breakdown.aspectRatio, '3mm 出血與安全框裁切保護')}
                  ${this.renderWeightedRow('總墨量安全', '10%', initialBreakdown.inkSafety, breakdown.inkSafety, 'TAC ≤300% 防吸墨背印沾黏')}
                  ${this.renderWeightedRow('微細邊緣銳度', '10%', initialBreakdown.sharpness, breakdown.sharpness, 'USM 印刷微細邊緣銳化補償')}
                  ${this.renderWeightedRow('亮部與暗階', '10%', initialBreakdown.brightness, breakdown.brightness, '階調校正防止印刷暗沉')}
                  ${this.renderWeightedRow('色彩飽和度', '10%', initialBreakdown.saturation, breakdown.saturation, 'CMYK 印刷色域適配軟打樣')}
                  ${this.renderWeightedRow('反差與層次', '10%', initialBreakdown.contrast, breakdown.contrast, '動態對比度增強')}
                </div>
              </div>
              ${this.renderDiagnostics(issues, recommendations, appliedScale)}
            </div>
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
            <div class="pm-spec-item">
              <span class="pm-spec-label">總墨量 TAC</span>
              <span class="pm-spec-val">${tacCompText}</span>
            </div>
          </div>

          <!-- Text Inspection Banner -->
          ${textInspectHtml}

          <!-- 3. Key Hero Action Buttons (Standard PDF & High-Res PNG & Pipeline Customizer) -->
          <div class="pm-diag-hero-actions">
            <button class="pm-btn pm-btn-primary pm-btn-lg btn-diag-export-pdf" style="width: 100%; font-weight: 700; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);" title="下載含裁切十字、色條與出血之標準印刷 PDF">
              <span>📄</span> 下載標準印刷 PDF (含出血)
            </button>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
              <button class="pm-btn pm-btn-secondary pm-btn-md btn-diag-export-png" title="下載 300 DPI 高解析度 PNG 影像檔">
                <span>📥</span> 下載高清 PNG
              </button>
              <button class="pm-btn pm-btn-secondary pm-btn-md btn-diag-open-pipeline" style="background: rgba(88, 86, 214, 0.08); color: #5856d6; border-color: rgba(88, 86, 214, 0.25);" title="🎛️ 專家管線自訂：逐項開關自訂 AI 放大、銳化、控墨與階調處理 (測試版免費開放)">
                <span>🎛️</span> 專家管線自訂
              </button>
            </div>
          </div>

          <!-- 4. Progressive Disclosure Accordion: Deep Technical Indicators -->
          <div class="pm-diag-accordion-wrapper">
            <button class="pm-diag-accordion-toggle" id="btnToggleDiagAccordion" type="button">
              <span class="pm-accordion-title">
                <span>📊</span>
                <span>${this.isDetailsExpanded ? '收合印前詳細檢驗數據' : '查看 7 項專業印前指標與自動優化詳情'}</span>
              </span>
              <span class="pm-accordion-icon">${this.isDetailsExpanded ? '▲' : '▼'}</span>
            </button>

            <div class="pm-diag-accordion-content" style="display: ${this.isDetailsExpanded ? 'block' : 'none'};">
              <!-- 7-Factor Weighted Indicator Comparison Table -->
              <div class="pm-weighted-section">
                <div class="pm-metrics-grid">
                  ${this.renderWeightedRow('解析度適配', '35%', initialBreakdown.resolution, breakdown.resolution, 'Lanczos-3 重採樣補足 300 DPI')}
                  ${this.renderWeightedRow('長寬比契合', '15%', initialBreakdown.aspectRatio, breakdown.aspectRatio, '3mm 出血與安全框裁切保護')}
                  ${this.renderWeightedRow('總墨量安全', '10%', initialBreakdown.inkSafety, breakdown.inkSafety, 'TAC ≤300% 防吸墨背印沾黏')}
                  ${this.renderWeightedRow('微細邊緣銳度', '10%', initialBreakdown.sharpness, breakdown.sharpness, 'USM 印刷微細邊緣銳化補償')}
                  ${this.renderWeightedRow('亮部與暗階', '10%', initialBreakdown.brightness, breakdown.brightness, '階調校正防止印刷暗沉')}
                  ${this.renderWeightedRow('色彩飽和度', '10%', initialBreakdown.saturation, breakdown.saturation, 'CMYK 印刷色域適配軟打樣')}
                  ${this.renderWeightedRow('反差與層次', '10%', initialBreakdown.contrast, breakdown.contrast, '動態對比度增強')}
                </div>
              </div>

              <!-- Auto Process Actions & Diagnostics -->
              ${this.renderDiagnostics(issues, recommendations, appliedScale)}
            </div>
          </div>
        </div>
      `;
    }

    // Event Bindings
    this.bindEvents(state);
  }

  private bindEvents(state: AppState): void {
    // 1. Direct Print CTA
    this.container.querySelector('.btn-diag-direct-print')?.addEventListener('click', () => {
      if (this.onDirectPrintClick) {
        this.onDirectPrintClick();
      }
    });

    // 2. Export PDF CTA
    this.container.querySelector('.btn-diag-export-pdf')?.addEventListener('click', () => {
      if (this.onExportPdfClick) {
        this.onExportPdfClick();
      }
    });

    // 2b. Export PNG CTA
    this.container.querySelector('.btn-diag-export-png')?.addEventListener('click', () => {
      document.getElementById('btnExportPng')?.click();
    });

    // 3. Pipeline Matrix Customizer CTA
    this.container.querySelector('.btn-diag-open-pipeline')?.addEventListener('click', () => {
      if (this.onOpenPipelineMatrix) {
        this.onOpenPipelineMatrix();
      }
    });

    // 4. Text Inspection CTA
    this.container.querySelector('#btnOpenTextInspectFromCard')?.addEventListener('click', () => {
      if (this.onOpenTextInspectorClick) {
        this.onOpenTextInspectorClick();
      }
    });

    // 5. Simple mode convenience print button
    this.container.querySelector('#btnSimpleOpenConvPrint')?.addEventListener('click', () => {
      document.getElementById('btnOpenConvPrint')?.click();
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
        <div class="pm-metric-action-hint">💡 ${actionDesc}</div>
      </div>
    `;
  }

  private renderDiagnostics(
    issues: string[],
    recommendations: string[],
    appliedScale: number
  ): string {
    const autoActions: string[] = [];

    if (appliedScale > 1) {
      autoActions.push(`✓ 已執行 ${appliedScale}x Lanczos-3 印刷級超解析度重採樣放大`);
    }
    autoActions.push('✓ 已套用 USM 微細邊緣銳化補償');
    autoActions.push('✓ 已檢測並壓制總墨量 TAC ≤ 300% 避免印刷背印');
    autoActions.push('✓ 已自動計算 3mm 標準出血與安全裁切框');

    const autoActionsHtml = autoActions
      .map((act) => `<li class="pm-auto-act-item">${act}</li>`)
      .join('');

    let issuesHtml = '';
    for (const issue of issues) {
      issuesHtml += `<li class="pm-diag-issue"><span>⚠️</span> ${issue}</li>`;
    }
    let recommendationsHtml = '';
    for (const rec of recommendations) {
      recommendationsHtml += `<li class="pm-diag-rec"><span>💡</span> ${rec}</li>`;
    }

    return `
      <div class="pm-diagnostic-details">
        <div class="pm-diag-title">⚡ 系統已自動完成處理項目：</div>
        <ul class="pm-auto-act-list">
          ${autoActionsHtml}
        </ul>

        ${issues.length > 0 || recommendations.length > 0 ? `
          <div class="pm-diag-title" style="margin-top: 12px;">送印前提醒：</div>
          <ul class="pm-diag-list">
            ${issuesHtml}
            ${recommendationsHtml}
          </ul>
        ` : `
          <div class="pm-diagnostic-clean" style="margin-top: 10px;">
            <span class="pm-clean-icon">✓</span>
            <span>各項指標已全數達到印刷廠出圖標準，可直接輸出 PDF！</span>
          </div>
        `}
      </div>
    `;
  }
}
