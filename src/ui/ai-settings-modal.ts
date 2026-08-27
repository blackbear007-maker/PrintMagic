import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';
import { AI_MODELS, AiUpscaleClient, type AiModelType } from '../services/ai-upscale-client';
import { NetworkGuard } from '../services/network-guard';

/**
 * ⚙️ 引擎設定面板 — 誠實版
 *
 * 這裡曾經是一個模擬 24+ 個雲端 AI 供應商配額/品質路由的儀表板（進度條、額度百分比、自動切換徽章），
 * 但沒有一行程式碼真的呼叫過那些供應商 —— 全部是本機模擬的假帳本。已整個移除，改成如實呈現：
 * 2 個自建服務容器（VTracer、PyTorch 視覺服務）+ 一律會用到的本機決定性演算法。
 * 誠實現況（2026-08-27）：VTracer 是真正能建置、運作的服務。PyTorch/ONNX 視覺服務容器裡實際跑
 * 7 個模型：Real-ESRGAN、ARNIQA、LaMa、rembg、YuNet（真實訓練權重，建置時自動下載）、Retinexformer 與
 * DehazeFormer-T（真實訓練權重，作者無自動下載網址，2026-08-26 已手動下載並直接提交進 git——因為
 * Railway 是從 git 建置這個服務，只存在本機的權重檔案永遠不會真正部署上去，見
 * docker/zero-dce/weights/README.md）。
 * Retinexformer 已於 2026-08-26 取代原本從未載入訓練權重的 Zero-DCE++，成為低光提亮功能的
 * 真實模型（權重檔案已驗證：strict=True 完整載入 122 個張量無缺漏，真實推論成功讓測試圖片變亮）。
 * DehazeFormer-T 的權重檔案同樣已驗證：strict=True 完整載入 258 個張量無缺漏，真實推論在模擬
 * 霧霾測試圖上讓對比度提升逾 3 倍。
 * LaMa（物件／浮水印移除）於 2026-08-26 加入，TorchScript 權重可自動下載，已驗證：torch.jit.load()
 * 成功、真實推論乾淨移除模擬「浮水印」色塊測試區域（移除區域內 0% 殘留原色，且修正了上游
 * simple-lama-inpainting 套件遺漏的「輸出裁切回原始尺寸」錯誤）。
 * rembg（去背，固定 u2netp session）與 YuNet（人臉偵測）於 2026-08-27 加入，兩者跑在 ONNX
 * Runtime/OpenCV DNN 後端而非 PyTorch。已驗證：rembg 在有紋理漸層背景的合成測試圖上正確分離主體
 * 與背景（取代原本只能處理單一色背景的色鍵去背）；YuNet 對合成測試圖成功偵測人臉，信心分數 84.2%。
 * 曾評估過的 GFPGAN（人像修復）、DDColor（老照片上色）、Florence-2（浮水印自動定位）皆決定不採用
 * ——技術可行，但與印前處理定位不符或成本過高，詳見 docs/SPEC.md 的評估紀錄。
 * OCR（Tesseract）已於 2026-08-26 移除——查證後發現它從未被任何 UI 功能實際呼叫，而它原本
 * 想解決的問題（讀取 AI 繪圖產生的亂碼假文字）OCR 本來就解不了，因為那些筆畫通常根本不是真實字元。
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
        icon: '📐',
        name: 'VTracer 點陣轉向量',
        desc: '真實開源 Rust 向量化工具，貝茲曲線擬合。'
      },
      {
        icon: '🔍',
        name: 'Real-ESRGAN 4x 超解析度放大',
        desc: '真實訓練權重（BSD-3-Clause），開箱即用。離線時自動退回本機邊緣強化演算法。'
      },
      {
        icon: '📊',
        name: 'ARNIQA 影像品質評估',
        desc: '真實訓練權重（Apache-2.0，WACV 2024），開箱即用。離線時自動退回本機像素統計評估。'
      },
      {
        icon: '🌫️',
        name: 'DehazeFormer-T 去霧',
        desc: '真實訓練權重（MIT），開箱即用（作者無自動下載網址，權重已手動下載並提交進 git）。離線時自動退回本機大氣散射模型演算法。'
      },
      {
        icon: '☀️',
        name: 'Retinexformer 低光照片提亮',
        desc: '真實訓練權重（MIT，ICCV 2023），開箱即用（作者無自動下載網址，權重已手動下載並提交進 git）。離線時自動退回本機曲線估計演算法。'
      },
      {
        icon: '🪄',
        name: 'LaMa 物件／浮水印移除',
        desc: '真實訓練權重（Apache-2.0），TorchScript 格式，開箱即用（建置時自動下載）。離線時自動退回本機 Navier-Stokes 畫布修復演算法。'
      },
      {
        icon: '✂️',
        name: 'rembg 髮絲級去背',
        desc: '真實訓練權重（MIT，固定使用 u2netp session），開箱即用（建置時自動下載）。離線時自動退回本機顏色距離去背演算法（僅適合單一色背景）。'
      },
      {
        icon: '🧑',
        name: 'YuNet 人臉偵測',
        desc: '真實訓練權重（Apache-2.0/MIT），開箱即用（建置時自動下載）。沒有本機備援——離線時誠實回報不可用，本專案沒有現成的本機人臉偵測演算法可退回。'
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
                    ? '已開啟：圖片絕不離開你的裝置，完全跳過下方自建服務，只用本機演算法。'
                    : '關閉時，會優先嘗試下方自建服務以取得更好結果（品質較高，但圖片會傳到你部署的伺服器），離線時自動退回本機演算法。開啟後強制只用本機演算法。'}
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
            <div style="font-size: 0.86rem; font-weight: 700; color: var(--pm-text-primary);">自建服務（2 個容器 · 8 項功能，詳見各項說明）</div>
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
              以上服務離線時，系統會自動退回本機決定性演算法（結果標籤會誠實標示「本機」，不會冒充雲端服務）——唯獨 YuNet 人臉偵測沒有本機備援，離線時該功能直接不可用，不會假造一個「本機演算法」來冒充。
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
