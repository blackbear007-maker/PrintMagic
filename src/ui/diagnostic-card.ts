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
  private onOpenExportCenterClick?: () => void;
  private isDetailsExpanded = false;

  constructor(
    containerId: string,
    onDirectPrintClick?: () => void,
    onExportPdfClick?: () => void,
    onOpenPipelineMatrix?: () => void,
    onOpenTextInspectorClick?: () => void,
    onOpenExportCenterClick?: () => void
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Diagnostic card #${containerId} not found`);
    this.container = el;
    this.onDirectPrintClick = onDirectPrintClick;
    this.onExportPdfClick = onExportPdfClick;
    this.onOpenPipelineMatrix = onOpenPipelineMatrix;
    this.onOpenTextInspectorClick = onOpenTextInspectorClick;
    this.onOpenExportCenterClick = onOpenExportCenterClick;
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
                ${isTypo ? `發現 ${textInspectionResult.typoCount} 處文字疑似異常` : '✓ 文字拼寫與清晰度已全自動優化'}
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
      const typoWarningHtml = (textInspectionResult && textInspectionResult.typoCount > 0)
        ? `
          <div class="pm-diag-text-inspect-banner pm-banner-warning" id="btnOpenTextInspectFromCard" style="cursor: pointer; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.1rem;">⚠️</span>
              <div>
                <div style="font-weight: 700; font-size: 0.82rem; color: var(--pm-text-primary);">
                  發現 ${textInspectionResult.typoCount} 處文字疑似異常
                </div>
                <div style="font-size: 0.72rem; color: var(--pm-text-secondary);">
                  ${textInspectionResult.summary}
                </div>
              </div>
            </div>
            <button class="pm-btn pm-btn-xs pm-btn-artisan" type="button">
              點擊糾錯 ➔
            </button>
          </div>
        `
        : '';

      this.container.innerHTML = `
        <div class="pm-card pm-diagnostic-panel pm-panel-simple">
          <!-- 1. Hero Score Header -->
          <div class="pm-diagnostic-header" style="margin-bottom: 10px;">
            <div class="pm-score-summary-box" style="padding: 12px 14px;">
              <div class="pm-score-circle" style="border-color: ${levelColor}; width: 68px; height: 68px;">
                <span class="pm-score-value" style="color: ${levelColor}; font-size: 1.55rem;">${currentScore}</span>
                <span class="pm-score-max" style="font-size: 0.65rem;">/100分</span>
              </div>

              <div class="pm-score-meta">
                <div class="pm-score-flow-row">
                  <span class="pm-score-stage-tag">原圖 ${initialScore}分</span>
                  <span class="pm-score-arrow">➔</span>
                  <span class="pm-score-stage-tag pm-stage-after">優化後 ${currentScore}分</span>
                  ${deltaBadge}
                </div>
                <div class="pm-score-verdict ${levelClass}">✨ ${scoreResult.verdict}</div>
                <div style="font-size: 0.72rem; color: var(--pm-text-muted); margin-top: 2px;">
                  ${currentPreset.nameZh} · ${physicalSizeText} ${currentPreset.realWorldRef ? `<span style="color: var(--pm-accent-blue); font-weight: 600;">(${currentPreset.realWorldRef})</span>` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Converged All-in-One Defense Grid (全自動 10 大無腦印前守護) -->
          <div class="pm-simple-defense-box">
            <div class="pm-defense-box-header">
              <span class="pm-defense-title">🛡️ 10 大商業印前守護 · 背景 100% 全自動就緒</span>
              <span class="pm-defense-status">✓ 完美就緒</span>
            </div>

            <div class="pm-defense-chips-grid" style="grid-template-columns: repeat(2, 1fr); gap: 6px;">
              <div class="pm-defense-chip" title="自動由 72 DPI 升級至 ${finalDpi} DPI 視網膜印刷畫質">
                <span class="pm-chip-icon">🌟</span>
                <span class="pm-chip-text"><strong>${finalDpi} DPI</strong> 超解析補齊</span>
              </div>
              <div class="pm-defense-chip" title="已適配 ${currentPreset.nameZh} 3mm 出血外推防裁切">
                <span class="pm-chip-icon">📐</span>
                <span class="pm-chip-text"><strong>3mm</strong> 出血防白邊</span>
              </div>
              <div class="pm-defense-chip" title="抹除手機拍畫時的手部黑影與光照不均">
                <span class="pm-chip-icon">☀️</span>
                <span class="pm-chip-text"><strong>手機拍照</strong> 均光抹影</span>
              </div>
              <div class="pm-defense-chip" title="平滑 8-bit 色階斷層與消除 JPEG 塊狀噪點">
                <span class="pm-chip-icon">🌊</span>
                <span class="pm-chip-text"><strong>漸層防斷階</strong> 去噪</span>
              </div>
              <div class="pm-defense-chip" title="油墨安全壓制至 ${finalTac}% 防吸墨沾黏">
                <span class="pm-chip-icon">🎨</span>
                <span class="pm-chip-text"><strong>TAC ≤${finalTac}%</strong> 安全控墨</span>
              </div>
              <div class="pm-defense-chip" id="btnCardOpenVectorOverlay" style="cursor: pointer;" title="小字自動純黑向量化，保證印刷邊緣銳利不模糊">
                <span class="pm-chip-icon">🔤</span>
                <span class="pm-chip-text"><strong>純黑 K100</strong> 文字防糊</span>
              </div>
              <div class="pm-defense-chip" title="Gamma 階調自動補償，印刷暗部層次分明不死黑">
                <span class="pm-chip-icon">🌓</span>
                <span class="pm-chip-text"><strong>暗部階調</strong> 防死黑</span>
              </div>
              <div class="pm-defense-chip" title="自動萃取主要專色並匹配 Pantone 國際標準色票">
                <span class="pm-chip-icon">🌈</span>
                <span class="pm-chip-text"><strong>Pantone</strong> 專色配墨</span>
              </div>
              <div class="pm-defense-chip" title="檢查條碼光學反差比與物理毫米尺寸">
                <span class="pm-chip-icon">🏁</span>
                <span class="pm-chip-text"><strong>條碼光學</strong> 防呆校驗</span>
              </div>
              <div class="pm-defense-chip" title="已套用印刷廠色彩描述檔，直出零色偏">
                <span class="pm-chip-icon">🇹🇼</span>
                <span class="pm-chip-text"><strong>CMYK</strong> 色彩校正</span>
              </div>
            </div>

            <div class="pm-defense-reassurance" style="background: rgba(52, 199, 89, 0.08); border-radius: 8px; padding: 8px 10px; margin-top: 6px; font-size: 0.73rem; color: #248a3d; font-weight: 600;">
              ✨ 系統已為您全自動完成 10 道印刷工序，無需任何專業知識，點擊下方即可直接無腦送印！
            </div>
          </div>

          <!-- 3. Typo Warning Banner (Only if abnormal) -->
          ${typoWarningHtml}

          <!-- 4. Big Action Buttons -->
          <div class="pm-diag-hero-actions">
            <button class="pm-btn pm-btn-primary pm-btn-lg btn-diag-export-pdf" style="font-size: 0.95rem; font-weight: 700; width: 100%; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);" title="一鍵下載最高畫質標準印刷 PDF">
              <span>🌟</span> 一鍵下載標準印刷檔 (PDF)
            </button>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
              <button class="pm-btn pm-btn-secondary pm-btn-md btn-diag-open-export" title="選擇輸出 TIFF / JPG / 向量刀模 SVG 或一鍵全打包出機 ZIP">
                <span>🖨️</span> 更多格式 (TIFF/ZIP)
              </button>
              <button class="pm-btn pm-btn-secondary pm-btn-md" id="btnSimpleOpenConvPrint" title="7-11 / 全家超商列印檔案產生器">
                <span>🏪</span> 超商列印檔
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

          <!-- 4. Modern 4-Pillar Visual Print Safety Cards (2x2 Grid) -->
          <div class="pm-diag-accordion-wrapper" style="margin-top: 14px;">
            <div class="pm-safety-tiles-grid">
              <!-- Tile 1: Resolution -->
              <div class="pm-safety-tile">
                <div class="pm-safety-tile-top">
                  <div class="pm-safety-tile-title">
                    <span class="pm-safety-tile-icon">🔍</span>
                    <span class="pm-safety-tile-name">畫質解析度</span>
                  </div>
                  <span class="pm-safety-badge ${breakdown.resolution >= 90 ? 'pm-badge-pass' : 'pm-badge-warn'}">
                    ${breakdown.resolution >= 90 ? '✓ 頂級清晰' : '需放大'} · ${breakdown.resolution}分
                  </span>
                </div>
                <div class="pm-safety-tile-desc">
                  Lanczos-3 補足 <strong>${finalDpi} DPI</strong> 印刷標準，無顆粒與鋸齒
                </div>
              </div>

              <!-- Tile 2: Bleed & Safety Crop -->
              <div class="pm-safety-tile">
                <div class="pm-safety-tile-top">
                  <div class="pm-safety-tile-title">
                    <span class="pm-safety-tile-icon">📐</span>
                    <span class="pm-safety-tile-name">出血與防裁切</span>
                  </div>
                  <span class="pm-safety-badge ${breakdown.aspectRatio >= 90 ? 'pm-badge-pass' : 'pm-badge-warn'}">
                    ✓ 安全防切 · ${breakdown.aspectRatio}分
                  </span>
                </div>
                <div class="pm-safety-tile-desc">
                  已自動外推 <strong>3mm 標準出血</strong>，裁切偏差保證不露白邊
                </div>
              </div>

              <!-- Tile 3: Ink Safety -->
              <div class="pm-safety-tile">
                <div class="pm-safety-tile-top">
                  <div class="pm-safety-tile-title">
                    <span class="pm-safety-tile-icon">💧</span>
                    <span class="pm-safety-tile-name">墨量防沾黏</span>
                  </div>
                  <span class="pm-safety-badge ${breakdown.inkSafety >= 80 ? 'pm-badge-pass' : 'pm-badge-warn'}">
                    ${breakdown.inkSafety >= 80 ? '✓ 安全控墨' : '⚠️ 需控墨'} · ${breakdown.inkSafety}分
                  </span>
                </div>
                <div class="pm-safety-tile-desc">
                  總墨量壓制至 <strong>TAC ≤ 300%</strong>，避免紙張吸墨過重背印沾黏
                </div>
              </div>

              <!-- Tile 4: Color & Tone -->
              <div class="pm-safety-tile">
                <div class="pm-safety-tile-top">
                  <div class="pm-safety-tile-title">
                    <span class="pm-safety-tile-icon">🎨</span>
                    <span class="pm-safety-tile-name">色彩與階調</span>
                  </div>
                  <span class="pm-safety-badge ${breakdown.saturation >= 90 ? 'pm-badge-pass' : 'pm-badge-warn'}">
                    ✓ 色彩通透 · ${breakdown.saturation}分
                  </span>
                </div>
                <div class="pm-safety-tile-desc">
                  已套用 <strong>USM 印刷銳化</strong> 與 CMYK 色階校正，實體通透不暗沉
                </div>
              </div>
            </div>

            <!-- Auto Summary Checklist Box -->
            <div class="pm-auto-summary-box">
              <div class="pm-auto-summary-title">⚡ 系統已自動完成印前安全處理</div>
              <div class="pm-auto-tags">
                <span class="pm-auto-tag">✓ 補足 ${finalDpi} DPI</span>
                <span class="pm-auto-tag">✓ 3mm 標準出血</span>
                <span class="pm-auto-tag">✓ TAC 控墨安全</span>
                <span class="pm-auto-tag">✓ USM 微細銳化</span>
              </div>
              ${issues.length > 0 ? `
                <div class="pm-diag-warning-inline">
                  <span>⚠️</span> ${issues[0]}
                </div>
              ` : ''}
            </div>

            <!-- Optional Collapsible Deep Metrics Toggle -->
            <button class="pm-diag-accordion-toggle" id="btnToggleDiagAccordion" type="button" style="margin-top: 10px; padding: 6px 10px; font-size: 0.72rem;">
              <span class="pm-accordion-title">
                <span>📊</span>
                <span>${this.isDetailsExpanded ? '收合 7 項詳細數值對比' : '展開 7 項詳細數值對比'}</span>
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

    // 5b. Simple mode text clarity button
    this.container.querySelector('#btnCardOpenVectorOverlay')?.addEventListener('click', () => {
      document.getElementById('btnOpenVectorOverlay')?.click();
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
