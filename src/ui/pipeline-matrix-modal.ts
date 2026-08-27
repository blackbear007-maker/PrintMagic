import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { store } from './state';
import type { PipelineOptions } from '../types';

/**
 * 🎛️ 專家級印前管線自訂控制器 (Expert Pipeline Matrix Modal)
 * Apple HIG Frosted Glass Switch Matrix for Non-Destructive Selective Optimization
 */
export class PipelineMatrixModal {
  private modalEl: HTMLElement;
  private onApplyChanges?: () => void;

  constructor(onApplyChanges?: () => void, _onOpenPricing?: () => void) {
    this.onApplyChanges = onApplyChanges;

    this.modalEl = document.createElement('div');
    this.modalEl.id = 'pipelineMatrixModal';
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    const opts = store.getState().pipelineOptions;

    const pipelineItems: {
      key: keyof PipelineOptions;
      icon: string;
      title: string;
      desc: string;
      defaultHint: string;
      offHint: string;
    }[] = [
      {
        key: 'enableUpscale',
        icon: '🔍',
        title: '8x 金字塔超解析度放大',
        desc: '將低解析原圖透過 Lanczos-3 或邊緣強化演算法放大至 300+ DPI 印刷標準（本機決定性演算法，非神經網路）。',
        defaultHint: '開：自動補足解析度',
        offHint: '關：維持原始像素尺寸'
      },
      {
        key: 'enableSharpening',
        icon: '✨',
        title: 'USM 印刷微米級邊緣銳化補償',
        desc: '抵消合版印刷網點擴大（Dot Gain）造成的字體模糊與線條柔化。',
        defaultHint: '開：銳化微細輪廓',
        offHint: '關：保留原始顆粒/柔邊'
      },
      {
        key: 'enableInkLimiting',
        icon: '🎨',
        title: 'TAC 300% 總墨量強制壓制保護',
        desc: '防止暗部 CMYK 4 色油墨總和超過 300%，避免油墨未乾拖花與背印污損。',
        defaultHint: '開：限制最高 300%',
        offHint: '關：允許原始油墨直出'
      },
      {
        key: 'enableShadowLift',
        icon: '🌓',
        title: '暗部階調浮起與動態反差補償',
        desc: '針對紙張吸墨特性微調暗階，防止畫面在實體印刷時暗沉死黑。',
        defaultHint: '開：動態範圍校正',
        offHint: '關：維持原圖暗度'
      },
      {
        key: 'enableBleedExpand',
        icon: '📐',
        title: '3mm 智慧出血自動補足與鏡像延伸',
        desc: '自動為周圍邊界鏡像延伸 3mm 出血區，徹底解決裁刀誤差白邊問題。',
        defaultHint: '開：自動補齊 3mm',
        offHint: '關：原始邊界裁切'
      },
      {
        key: 'enableColorProofing',
        icon: '🌈',
        title: '國際 ICC 描述檔色彩映射軟打樣',
        desc: '套用 Japan Color 2001 或 ISO Coated v2 CMYK 實體印刷打樣校色。',
        defaultHint: '開：精確色域映射',
        offHint: '關：維持 sRGB 原色'
      },
      {
        key: 'enableDehaze',
        icon: '🌫️',
        title: '去霧（戶外風景灰濛/霧霾清除）',
        desc: '套用本機大氣散射模型演算法（古典 Dark Channel Prior 去霧公式，非神經網路）。曾評估過改用 DehazeFormer-T 模型，但去霧只對霧霾戶外遠景照片有幫助，跟本站證件照/名片/貼紙等典型使用情境重疊度低，2026-08-27 評估後決定不採用，詳見 docs/SPEC.md。預設關閉，因為只對有霧霾/灰濛的戶外照片有幫助，一般照片開啟可能反而使色調偏移。',
        defaultHint: '開：套用去霧演算法',
        offHint: '關：維持原圖（預設，建議僅霧霾照片手動開啟）'
      }
    ];

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 720px; width: 92vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">🎛️</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 class="pm-modal-title">專家級印前管線自訂控制器</h3>
                <span class="pm-plan-tag" style="background: rgba(52, 199, 89, 0.15); color: #248a3d; border: 1px solid rgba(52, 199, 89, 0.3); font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 12px;">
                  ✨ 測試版全開放
                </span>
              </div>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                非破壞性逐項開關：自由掌控超解析放大、控墨、銳化與色彩映射流程
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnClosePipelineMatrix">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 16px 24px; max-height: 70vh; overflow-y: auto;">
          <div style="background: rgba(52, 199, 89, 0.08); border: 1px solid rgba(52, 199, 89, 0.25); border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
            <span style="color: #34c759; font-size: 1.1rem;">✓</span>
            <span style="font-size: 0.78rem; color: #248a3d; font-weight: 600;">測試版已全面開放所有專家印前管線開關自由調整權限，調整後儲存即時生效。</span>
          </div>

          <!-- Switches List -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${pipelineItems
              .map((item) => {
                const isChecked = opts[item.key];
                return `
                <div class="pm-pipeline-switch-card" data-key="${item.key}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #ffffff; border: 1.5px solid ${isChecked ? 'rgba(0, 113, 227, 0.4)' : 'var(--pm-border-subtle)'}; border-radius: 12px; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);">
                  <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; padding-right: 12px;">
                    <span style="font-size: 1.3rem; line-height: 1;">${item.icon}</span>
                    <div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.88rem; font-weight: 700; color: var(--pm-text-primary);">${item.title}</span>
                        <span style="font-size: 0.68rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${isChecked ? 'rgba(0, 113, 227, 0.1)' : '#f0f0f2'}; color: ${isChecked ? '#0071e3' : 'var(--pm-text-muted)'};">
                          ${isChecked ? item.defaultHint : item.offHint}
                        </span>
                      </div>
                      <div style="font-size: 0.75rem; color: var(--pm-text-muted); margin-top: 3px; line-height: 1.35;">${item.desc}</div>
                    </div>
                  </div>

                  <!-- Apple iOS Style Toggle Switch -->
                  <label class="pm-apple-switch" style="position: relative; display: inline-block; width: 44px; height: 26px; flex-shrink: 0; cursor: pointer;">
                    <input type="checkbox" class="pipeline-checkbox" data-key="${item.key}" ${isChecked ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;" />
                    <span class="pm-switch-slider ${isChecked ? 'pm-switch-on' : ''}" style="position: absolute; inset: 0; background-color: ${isChecked ? '#34c759' : '#e5e5ea'}; border-radius: 26px; transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
                      <span class="pm-switch-knob" style="position: absolute; height: 22px; width: 22px; left: ${isChecked ? '20px' : '2px'}; bottom: 2px; background-color: white; border-radius: 50%; transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"></span>
                    </span>
                  </label>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <div class="pm-modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <button class="pm-btn pm-btn-ghost pm-btn-sm" id="btnResetPipelineDefaults" style="font-size: 0.78rem; color: var(--pm-text-secondary);">
            🔄 重置為全自動預設值
          </button>
          <div style="display: flex; gap: 10px;">
            <button class="pm-btn pm-btn-secondary" id="btnCancelPipelineMatrix">關閉</button>
            <button class="pm-btn pm-btn-primary" id="btnApplyPipelineChanges">儲存並立即套用</button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const close = () => this.close();

    this.modalEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (
        target.id === 'btnClosePipelineMatrix' ||
        target.id === 'btnCancelPipelineMatrix' ||
        target.id === 'pipelineMatrixModal'
      ) {
        close();
      }

      if (target.id === 'btnResetPipelineDefaults') {
        store.resetPipelineOptions();
        SoundEffects.sliderTick();
        this.render();
        Toast.info('✓ 已重置為全自動預設管線');
      }

      if (target.id === 'btnApplyPipelineChanges') {
        SoundEffects.purityChime();
        Toast.success('✓ 專家管線設定已儲存！');
        this.close();
        if (this.onApplyChanges) this.onApplyChanges();
      }
    });

    this.modalEl.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('pipeline-checkbox')) {
        const key = target.dataset.key as keyof PipelineOptions;
        if (key) {
          store.setPipelineOption(key, target.checked);
          SoundEffects.sliderTick();
          this.render();
        }
      }
    });
  }

  public open(): void {
    this.render();
    this.modalEl.style.display = 'flex';
    this.modalEl.classList.add('pm-modal-open');
    SoundEffects.sliderTick();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
    this.modalEl.classList.remove('pm-modal-open');
  }
}
