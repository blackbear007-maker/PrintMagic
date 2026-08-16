import type { AppState } from './state';

/**
 * Pre-press Diagnostic Card Component (Before vs After Weighted Indicators Comparison)
 */
export class DiagnosticCard {
  private container: HTMLElement;
  private onDirectPrintClick?: () => void;

  constructor(containerId: string, onDirectPrintClick?: () => void) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Diagnostic card #${containerId} not found`);
    this.container = el;
    this.onDirectPrintClick = onDirectPrintClick;
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
      appliedScale
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
    const levelColor = currentScore >= 88 ? '#30d158' : currentScore >= 70 ? '#ff9f0a' : '#ff453a';

    const { breakdown, issues, recommendations } = scoreResult;
    const initialBreakdown = originalScoreResult ? originalScoreResult.breakdown : breakdown;

    // Physical millimeter text
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

    const tacClass = inkAnalysis && inkAnalysis.hasOverflow ? 'pm-badge-warning' : 'pm-badge-success';

    // Delta badge
    const deltaBadge = deltaScore > 0
      ? `<span class="pm-score-delta-badge">+${deltaScore} 分提升</span>`
      : deltaScore === 0
      ? `<span class="pm-score-delta-badge pm-delta-neutral">最佳化維持</span>`
      : '';

    this.container.innerHTML = `
      <div class="pm-card pm-diagnostic-panel">
        <!-- Before vs After Total Score Header -->
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

        <!-- Target Print Specs Grid -->
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
              <span class="pm-spec-val ${tacClass}">${tacCompText}</span>
            </div>
          </div>
        </div>

        <!-- 7-Factor Weighted Indicator Comparison Table -->
        <div class="pm-weighted-section">
          <div class="pm-section-title-row">
            <span class="pm-section-title">📊 各項指標加權評分對比表</span>
            <span class="pm-section-sub">原圖 ➔ 自動處理後</span>
          </div>

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
    `;

    // Bind Direct Print Button
    this.container.querySelector('.btn-diag-direct-print')?.addEventListener('click', () => {
      if (this.onDirectPrintClick) {
        this.onDirectPrintClick();
      }
    });
  }

  private renderWeightedRow(
    label: string,
    weight: string,
    beforeScore: number,
    afterScore: number,
    actionDesc: string
  ): string {
    const beforeColor = beforeScore >= 85 ? '#30d158' : beforeScore >= 65 ? '#ff9f0a' : '#ff453a';
    const afterColor = afterScore >= 85 ? '#30d158' : afterScore >= 65 ? '#ff9f0a' : '#ff453a';
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
    autoActions.push('✓ 已套用 USM (Unsharp Mask) 微細邊緣銳化補償');
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

        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
          <button class="pm-btn pm-btn-artisan pm-btn-sm btn-diag-direct-print" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #ff6b35, #e0481d); color: #fff; font-weight: 700; box-shadow: 0 4px 14px rgba(255, 107, 53, 0.35); padding: 10px 16px; font-size: 0.88rem;" title="一鍵即時試算健豪、卡之屋等台灣在地四大印刷廠價格並打包送印工單">
            <span>🏭</span> 台灣四大印刷廠一鍵估價 & 直通送印 ➔
          </button>
        </div>
      </div>
    `;
  }
}
