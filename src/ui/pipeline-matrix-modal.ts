import { SoundEffects } from '../core/sound-effects';
import { store } from './state';
import type { PipelineOptions } from '../types';

export interface PipelineItemDef {
  key: keyof PipelineOptions;
  icon: string;
  title: string;
  desc: string;
  defaultHint: string;
  offHint: string;
}

export const PIPELINE_ITEMS: PipelineItemDef[] = [
  {
    key: 'enableUpscale',
    icon: '<img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" />',
    title: '8x 金字塔超解析度放大',
    desc: '把低解析原圖放大到目標 DPI：雲端模式用自建 Real-ESRGAN 模型，本機或離線時用 Lanczos-3／邊緣強化演算法。放大補不出原圖沒有的細節，評分會照實反映。',
    defaultHint: '開：自動補足解析度',
    offHint: '關：維持原始像素尺寸'
  },
  {
    key: 'enableSharpening',
    icon: '<img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" />',
    title: 'USM 印刷微米級邊緣銳化補償',
    desc: '抵消合版印刷網點擴大（Dot Gain）造成的字體模糊與線條柔化。',
    defaultHint: '開：銳化微細輪廓',
    offHint: '關：保留原始顆粒/柔邊'
  },
  {
    key: 'enableAntiBanding',
    icon: '<img src="icons/shared/wave-gradient.webp" alt="" class="pm-icon-img" />',
    title: '漸層防斷階',
    desc: '平滑 8-bit 漸層的色階斷層，避免天空、背景漸層印出一圈圈條紋。',
    defaultHint: '開：平滑漸層',
    offHint: '關：保留原始漸層'
  },
  {
    key: 'enableDeshadow',
    icon: '<img src="icons/shared/sun.webp" alt="" class="pm-icon-img" />',
    title: '手機翻拍光照均勻化',
    desc: '用手機拍紙本畫作時，抹平手影與光照不均。一般數位圖檔請保持關閉，否則會壓平原本刻意的明暗。',
    defaultHint: '開：均勻光照',
    offHint: '關：維持原始明暗'
  },
  {
    key: 'enableShadowLift',
    icon: '<img src="icons/shared/contrast.webp" alt="" class="pm-icon-img" />',
    title: '暗部階調浮起與動態反差補償',
    desc: '針對紙張吸墨特性微調暗階，防止畫面在實體印刷時暗沉死黑。',
    defaultHint: '開：動態範圍校正',
    offHint: '關：維持原圖暗度'
  },
  {
    key: 'enableBleedExpand',
    icon: '<img src="icons/shared/ruler-vector.webp" alt="" class="pm-icon-img" />',
    title: '依版型自動補出血',
    desc: '依目前版型的出血寬度（例如 A4 3mm、明信片 2mm）鏡像延伸四邊，降低裁刀誤差露白邊的風險。',
    defaultHint: '開：自動補出血',
    offHint: '關：原始邊界裁切'
  },
  // 2026-09-24：拿掉「enableColorProofing（ICC 色彩映射軟打樣）」開關——管線從未讀取這個旗標，
  // 切換它不會改變任何輸出，是一個假開關。軟打樣預覽另有畫布工具列的「軟打樣」按鈕。
  {
    key: 'enableAutoBgRemoval',
    icon: '<img src="icons/shared/scissors.webp" alt="" class="pm-icon-img" />',
    title: '模切貼紙自動去背',
    desc: '開啟後，選用「模切貼紙」規格時上傳即自動去背。預設關閉：接近正方形、1200px 以下的圖會被自動歸到貼紙規格，一般照片不該被偷偷去背。',
    defaultHint: '開：貼紙自動去背',
    offHint: '關：需手動點擊去背'
  }
];

/**
 * Pure markup for the switch list — shared by the header settings tab and
 * (compact: title + switch only, description moved to the tooltip) the advanced-mode score card.
 */
export function renderPipelineSwitchList(compact = false): string {
  const opts = store.getState().pipelineOptions;
  return PIPELINE_ITEMS.map((item) => {
    const isChecked = opts[item.key];
    if (compact) {
      return `
      <label class="pm-pipeline-switch-card" data-key="${item.key}" title="${item.desc}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; background: var(--pm-bg-elevated, #ffffff); border: 1px solid ${isChecked ? 'rgba(60, 30, 140, 0.35)' : 'var(--pm-border-subtle)'}; border-radius: 10px; cursor: pointer;">
        <span style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; color: var(--pm-text-primary);">${item.icon} ${item.title}</span>
        <span class="pm-apple-switch" style="position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0;">
          <input type="checkbox" class="pipeline-checkbox" data-key="${item.key}" ${isChecked ? 'checked' : ''} aria-label="${item.title}" style="opacity: 0; width: 0; height: 0;" />
          <span class="pm-switch-slider" style="position: absolute; inset: 0; background-color: ${isChecked ? '#34c759' : '#e5e5ea'}; border-radius: 22px; transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
            <span class="pm-switch-knob" style="position: absolute; height: 18px; width: 18px; left: ${isChecked ? '18px' : '2px'}; bottom: 2px; background-color: white; border-radius: 50%; transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"></span>
          </span>
        </span>
      </label>
    `;
    }
    return `
      <div class="pm-pipeline-switch-card" data-key="${item.key}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #ffffff; border: 1.5px solid ${isChecked ? 'rgba(60, 30, 140, 0.4)' : 'var(--pm-border-subtle)'}; border-radius: 12px; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);">
        <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; padding-right: 12px;">
          <span style="font-size: 1.3rem; line-height: 1;">${item.icon}</span>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.88rem; font-weight: 700; color: var(--pm-text-primary);">${item.title}</span>
              <span style="font-size: 0.68rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${isChecked ? 'rgba(60, 30, 140, 0.1)' : '#f0f0f2'}; color: ${isChecked ? '#3c1e8c' : 'var(--pm-text-muted)'};">
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
  }).join('');
}

/**
 * Wires a container that holds `renderPipelineSwitchList()`'s markup: every toggle applies to
 * the store immediately (no separate save step) and re-renders the list in place so the hint
 * badge/border color stay in sync. Bind once per container — re-rendering its innerHTML doesn't
 * lose this listener since it's delegated on the container itself, never the checkboxes.
 */
export function bindPipelineSwitchList(container: HTMLElement, onChange?: () => void, compact = false): void {
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('pipeline-checkbox')) return;
    const key = target.dataset.key as keyof PipelineOptions;
    if (!key) return;
    store.setPipelineOption(key, target.checked);
    SoundEffects.sliderTick();
    container.innerHTML = renderPipelineSwitchList(compact);
    if (onChange) onChange();
  });
}
