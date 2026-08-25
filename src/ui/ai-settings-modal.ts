import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { AI_MODELS, AiUpscaleClient, type AiModelType } from '../services/ai-upscale-client';
import { NetworkGuard } from '../services/network-guard';

/**
 * ⚙️ 引擎設定面板 — 誠實版
 *
 * 這裡曾經是一個模擬 24+ 個雲端 AI 供應商配額/品質路由的儀表板（進度條、額度百分比、自動切換徽章），
 * 但沒有一行程式碼真的呼叫過那些供應商 —— 全部是本機模擬的假帳本。已整個移除，改成如實呈現：
 * 3 項自建服務（Zero-DCE++、Tesseract OCR、VTracer）+ 一律會用到的本機決定性演算法。
 * 誠實現況（2026-08-25）：Tesseract 與 VTracer 是真正能建置、運作的服務；Zero-DCE++ 的網路架構
 * 程式碼是真的，但從未載入訓練權重（無 .pth 檔案、無 torch.load 呼叫），目前是用隨機初始化權重
 * 推論，輸出品質不代表真正訓練過的模型，詳見 docker/zero-dce/server.py 內的說明。
 */
export class AiSettingsModal {
  private modalEl: HTMLElement;
  private onModelChanged?: () => void;

  constructor(onModelChanged?: () => void) {
    this.onModelChanged = onModelChanged;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'aiSettingsModal';
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.render();
    document.body.appendChild(this.modalEl);
    this.bindEvents();
  }

  public render(): void {
    const currentModel = AiUpscaleClient.getStoredModel();
    const isPrivacyShieldActive = NetworkGuard.isPrivacyShieldActive();

    const realServices = [
      {
        icon: '☀️',
        name: 'Zero-DCE++ 低光照片提亮',
        desc: '⚠️ 網路架構是真的 Zero-DCE++，但從未載入訓練權重（隨機初始化），輸出品質不穩定。'
      },
      {
        icon: '🔤',
        name: 'Tesseract OCR 文字辨識',
        desc: '真實開源 OCR 引擎，支援繁中/英/日文字辨識。'
      },
      {
        icon: '📐',
        name: 'VTracer 點陣轉向量',
        desc: '真實開源 Rust 向量化工具，貝茲曲線擬合。'
      }
    ];

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog" style="max-width: 640px; width: 94vw;">
        <div class="pm-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">⚙️</span>
            <div>
              <h3 class="pm-modal-title">引擎設定</h3>
              <p style="font-size: 0.78rem; color: var(--pm-text-muted); margin: 2px 0 0 0;">
                誠實列出目前真正在運作的服務與演算法
              </p>
            </div>
          </div>
          <button class="pm-modal-close" id="btnCloseAiSettings">✕</button>
        </div>

        <div class="pm-modal-body" style="padding: 16px 20px; max-height: 76vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
          <!-- Privacy Shield -->
          <div style="background: ${isPrivacyShieldActive ? 'linear-gradient(135deg, rgba(88,86,214,0.12) 0%, rgba(0,113,227,0.08) 100%)' : 'rgba(0,0,0,0.02)'}; border: 1.5px solid ${isPrivacyShieldActive ? 'var(--pm-accent-purple, #5856d6)' : 'var(--pm-border-subtle)'}; border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem;">🔒</span>
              <div>
                <div style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary);">100% 本機模式</div>
                <div style="font-size: 0.72rem; color: var(--pm-text-muted); margin-top: 1px; max-width: 380px;">
                  ${isPrivacyShieldActive
                    ? '已開啟：圖片絕不離開你的裝置，完全跳過下方三項自建服務，只用本機演算法。'
                    : '關閉時，會優先嘗試下方三項自建服務以取得更好結果（品質較高，但圖片會傳到你部署的伺服器），離線時自動退回本機演算法。開啟後強制只用本機演算法。'}
                </div>
              </div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; margin-left: 12px; cursor: pointer; flex-shrink: 0;">
              <input type="checkbox" id="togglePrivacyShield" ${isPrivacyShieldActive ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;" />
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isPrivacyShieldActive ? '#34c759' : '#ccc'}; border-radius: 24px; transition: .3s;"></span>
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${isPrivacyShieldActive ? '23px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s;"></span>
            </label>
          </div>

          <!-- Real self-hosted services -->
          <div style="background: rgba(0, 0, 0, 0.02); border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary);">自建服務（3 項，詳見各項說明）</div>
            ${realServices.map((s) => `
              <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; ${s !== realServices[realServices.length - 1] ? 'border-bottom: 1px solid var(--pm-border-subtle);' : ''}">
                <span style="font-size: 1.1rem;">${s.icon}</span>
                <div>
                  <div style="font-size: 0.8rem; font-weight: 600; color: var(--pm-text-primary);">${s.name}</div>
                  <div style="font-size: 0.72rem; color: var(--pm-text-muted); margin-top: 1px;">${s.desc}</div>
                </div>
              </div>
            `).join('')}
            <div style="font-size: 0.7rem; color: var(--pm-text-muted); padding-top: 4px;">
              以上任一服務離線時，系統會自動退回本機決定性演算法（結果標籤會誠實標示「本機」，不會冒充雲端服務）。
            </div>
          </div>

          <!-- Local upscale presets -->
          <div style="background: rgba(0, 0, 0, 0.02); border: 1.5px solid var(--pm-border-subtle); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <label style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary); display: flex; align-items: center; gap: 6px;">
              <span>🌐</span> 放大演算法設定
            </label>
            <div style="font-size: 0.72rem; color: var(--pm-text-muted); margin-top: -4px;">
              以下都是同一套本機決定性演算法（雙線性插值 + 邊緣強化），差別只在放大倍率與銳化強度，不是不同的 AI 模型。
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${AI_MODELS.map(
                (m) => `
                <label style="display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1.5px solid ${currentModel === m.id ? 'var(--pm-accent-blue)' : 'var(--pm-border-subtle)'}; border-radius: var(--pm-radius-sm); cursor: pointer; transition: all 0.15s ease;">
                  <input type="radio" name="aiModelChoice" value="${m.id}" ${currentModel === m.id ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--pm-accent-blue);" />
                  <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 0.8rem; color: var(--pm-text-primary);">${m.name}</div>
                    <div style="font-size: 0.7rem; color: var(--pm-text-muted); margin-top: 1px; line-height: 1.25;">${m.desc}</div>
                  </div>
                </label>
              `
              ).join('')}
            </div>
          </div>
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnCancelAiSettings">取消</button>
          <button class="pm-btn pm-btn-primary" id="btnSaveAiSettings">儲存設定</button>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const close = () => this.close();
    this.modalEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.id === 'togglePrivacyShield') {
        const checkbox = target as HTMLInputElement;
        NetworkGuard.setPrivacyShield(checkbox.checked);
        SoundEffects.sliderTick();
        Toast.info(checkbox.checked ? '🔒 已開啟 100% 本機模式' : '🌐 已恢復自建服務優先，離線自動退回本機');
        this.render();
        return;
      }

      if (target.id === 'btnCloseAiSettings' || target.id === 'btnCancelAiSettings' || target.id === 'aiSettingsModal') {
        close();
      }

      if (target.id === 'btnSaveAiSettings') {
        const selectedRadio = this.modalEl.querySelector<HTMLInputElement>('input[name="aiModelChoice"]:checked');
        if (selectedRadio) {
          AiUpscaleClient.setStoredModel(selectedRadio.value as AiModelType);
        }

        SoundEffects.purityChime();
        Toast.success('✓ 設定已儲存！');
        this.close();
        if (this.onModelChanged) this.onModelChanged();
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
