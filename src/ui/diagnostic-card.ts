import type { AppState } from './state';

/**
 * Pre-press Diagnostic Card Component (Apple Pro System Health Style)
 */
export class DiagnosticCard {
  private container: HTMLElement;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Diagnostic card #${containerId} not found`);
    this.container = el;
  }

  public render(state: AppState): void {
    const { scoreResult, dpiAnalysis, inkAnalysis, currentPreset, appliedScale } = state;

    if (!scoreResult || !dpiAnalysis) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';

    const score = scoreResult.score;
    const levelClass = score >= 88 ? 'pm-score-high' : score >= 70 ? 'pm-score-mid' : 'pm-score-low';
    const levelColor = score >= 88 ? '#30d158' : score >= 70 ? '#ff9f0a' : '#ff453a';

    const { breakdown, issues, recommendations } = scoreResult;

    // Physical millimeter text
    const physicalSizeText = currentPreset.widthMm > 0
      ? `${currentPreset.widthMm} × ${currentPreset.heightMm} mm`
      : `${dpiAnalysis.targetWidthPx} × ${dpiAnalysis.targetHeightPx} px`;

    // TAC display
    const tacText = inkAnalysis
      ? `${inkAnalysis.maxTotalInk}% (上限 ${inkAnalysis.limitThreshold}%)`
      : '300%';

    const tacClass = inkAnalysis && inkAnalysis.hasOverflow ? 'pm-badge-warning' : 'pm-badge-success';

    this.container.innerHTML = `
      <div class="pm-card pm-diagnostic-panel">
        <!-- Header -->
        <div class="pm-diagnostic-header">
          <div class="pm-score-circle ${levelClass}">
            <svg viewBox="0 0 36 36" class="pm-circular-chart">
              <path class="pm-circle-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path class="pm-circle-fill"
                stroke="${levelColor}"
                stroke-dasharray="${score}, 100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" class="pm-circle-text">${score}</text>
            </svg>
            <div class="pm-score-meta">
              <div class="pm-score-title">印刷適合度評分</div>
              <div class="pm-score-verdict ${levelClass}">${scoreResult.verdict}</div>
            </div>
          </div>

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
              <span class="pm-spec-label">解析度 (DPI)</span>
              <span class="pm-spec-val ${dpiAnalysis.needsUpscale ? 'pm-text-warning' : 'pm-text-success'}">
                ${dpiAnalysis.currentDpi} / ${dpiAnalysis.targetDpi} DPI
              </span>
            </div>
            <div class="pm-spec-item">
              <span class="pm-spec-label">總墨量 TAC</span>
              <span class="pm-spec-val ${tacClass}">${tacText}</span>
            </div>
          </div>
        </div>

        <!-- 7-Factor Metrics Progress Track Grid -->
        <div class="pm-metrics-grid">
          ${this.renderMetricBar('解析度適配', breakdown.resolution, 'DPI 像素密度')}
          ${this.renderMetricBar('長寬比契合', breakdown.aspectRatio, '出血無裁切')}
          ${this.renderMetricBar('亮部與暗階', breakdown.brightness, '防吸墨暗沉')}
          ${this.renderMetricBar('色彩飽和度', breakdown.saturation, 'CMYK 色域')}
          ${this.renderMetricBar('微細邊緣銳度', breakdown.sharpness, '網點清晰度')}
          ${this.renderMetricBar('總墨量安全', breakdown.inkSafety, '防背印沾黏')}
        </div>

        <!-- Issues & Recommendations List -->
        ${this.renderDiagnostics(issues, recommendations, appliedScale)}
      </div>
    `;
  }

  private renderMetricBar(label: string, score: number, hint: string): string {
    const color = score >= 85 ? '#30d158' : score >= 65 ? '#ff9f0a' : '#ff453a';
    return `
      <div class="pm-metric-item">
        <div class="pm-metric-header">
          <span class="pm-metric-name">${label} <small>(${hint})</small></span>
          <span class="pm-metric-score" style="color: ${color}">${score}%</span>
        </div>
        <div class="pm-metric-track">
          <div class="pm-metric-fill" style="width: ${score}%; background-color: ${color}"></div>
        </div>
      </div>
    `;
  }

  private renderDiagnostics(
    issues: string[],
    recommendations: string[],
    appliedScale: number
  ): string {
    if (issues.length === 0 && recommendations.length === 0) {
      return `
        <div class="pm-diagnostic-clean">
          <span class="pm-clean-icon">✓</span>
          <span>各項印刷指標皆符合商業印刷出圖規範，可放心輸出！</span>
        </div>
      `;
    }

    let itemsHtml = '';
    for (const issue of issues) {
      itemsHtml += `<li class="pm-diag-issue"><span>⚠️</span> ${issue}</li>`;
    }
    for (const rec of recommendations) {
      itemsHtml += `<li class="pm-diag-rec"><span>💡</span> ${rec}</li>`;
    }

    const scaleNotice = appliedScale > 1
      ? `<div class="pm-scale-badge">🔍 已自動執行 ${appliedScale}x Lanczos-3 印刷級超解析度放大</div>`
      : '';

    return `
      <div class="pm-diagnostic-details">
        <div class="pm-diag-title">專家檢驗報告與優化建議：</div>
        <ul class="pm-diag-list">
          ${itemsHtml}
        </ul>
        ${scaleNotice}
      </div>
    `;
  }
}
