/**
 * App shell — the page layout that used to live as static markup in index.html.
 *
 * index.html now only carries <head> metadata and the module script; the whole studio layout
 * (header, upload zone, workspace, toolbars, assistant root, footer) is rendered from here before
 * any controller queries the DOM. Element IDs and classes are unchanged, so every existing
 * getElementById/querySelector in main.ts and src/ui/** keeps working.
 */
export const APP_SHELL_HTML = `
<div class="pm-app" id="app">
  <!-- Studio Header -->
  <header class="pm-header">
    <div class="pm-header-inner">
      <div class="pm-brand" style="display: flex; align-items: center; gap: 8px;">
        <img src="brand/logo-mark.svg" alt="" aria-hidden="true" class="pm-brand-mark" width="32" height="32" style="width: 32px; height: 32px; flex-shrink: 0;" />
        <div style="display: flex; flex-direction: column; line-height: 1.15;">
          <span class="pm-logo-text" style="font-size: 1.05rem; font-weight: 800; background: linear-gradient(135deg, #1d1d1f 0%, #4b2aa8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">印象魔法</span>
          <span style="font-size: 0.62rem; color: var(--pm-text-muted); font-weight: 600; letter-spacing: 0.02em;">專業印前影像優化 · 助手小象為您守護</span>
        </div>
      </div>

      <!-- Mode Switcher: Simple (Default, Beginner Friendly) vs Advanced (Pro Tools) -->
      <div class="pm-mode-switch-wrapper" id="modeSwitchWrapper">
        <button id="btnModeSimple" class="pm-mode-btn active" title="預設簡易模式：無腦一鍵搞定，最直觀的品質提升">
          <img src="icons/header/mode-simple.webp" alt="" class="pm-icon-img" /> 簡易
        </button>
        <button id="btnModeAdvanced" class="pm-mode-btn" title="進階模式：顯示處理開關、色彩描述檔與進階工具">
          <img src="icons/header/mode-advanced.webp" alt="" class="pm-icon-img" /> 進階
        </button>
      </div>

      <div class="pm-header-actions">
        <!-- Dual-Engine Switcher: two explicit buttons instead of one toggling pill (visible in both Simple and Advanced modes) -->
        <div class="pm-engine-switch" role="group" aria-label="本機隱私模式或雲端AI模式">
          <button id="btnEngineLocal" class="pm-engine-btn" title="本機隱私模式：圖片絕不離開你的裝置">
            <img src="icons/header/engine-local.webp" alt="" class="pm-icon-img" /> 本機
          </button>
          <button id="btnEngineCloud" class="pm-engine-btn" title="雲端AI模式：優先嘗試自建服務以取得更好結果，離線時自動退回本機演算法">
            <img id="engineCloudIcon" src="icons/header/engine-cloud.webp" alt="" class="pm-icon-img" />
            <span id="engineCloudLabel">雲端</span>
          </button>
        </div>

        <!-- Consolidated Settings: everything below collapses behind one gear icon (Advanced Only) -->
        <button id="btnOpenHeaderSettings" class="pm-tool-btn pm-advanced-only" style="padding: 6px 8px;" title="更多設定：文字檢查、管線自訂、新手指南">
          <img src="icons/header/mode-advanced.webp" alt="" class="pm-icon-img" />
        </button>

        <button id="btnNewArtwork" class="pm-btn pm-btn-ghost" style="display: none; padding: 5px 12px; font-size: 0.78rem; font-weight: 600;">
          <span>＋ 更換圖片</span>
        </button>
      </div>
    </div>
  </header>

  <!-- More Settings: tabbed panel behind the header's gear icon (檢查文字/管線自訂/新手指南).
       No save/close footer — pipeline toggles apply immediately, and clicking the backdrop or
       the ✕ dismisses it, same as every other modal in the app. -->
  <div class="pm-modal-backdrop" id="headerSettingsModal">
    <div class="pm-modal-dialog" style="max-width: 960px; width: 94vw;">
      <div class="pm-modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="icons/header/mode-advanced.webp" alt="" class="pm-icon-img" />
          <h3 class="pm-modal-title">更多設定</h3>
        </div>
        <button class="pm-modal-close" id="btnCloseHeaderSettings"><img src="icons/shared/close.webp" alt="" class="pm-icon-img" /></button>
      </div>
      <div class="pm-modal-body" style="display: flex; padding: 0; min-height: 560px; max-height: 78vh;">
        <div class="pm-settings-tabs" role="tablist">
          <button class="pm-settings-tab" data-tab="text-inspect"><img src="icons/header/text-inspect.webp" alt="" class="pm-icon-img" /> 檢查文字</button>
          <button class="pm-settings-tab active" data-tab="pipeline"><img src="icons/header/pipeline-matrix.webp" alt="" class="pm-icon-img" /> 管線自訂</button>
          <button class="pm-settings-tab" data-tab="guide"><img src="icons/header/guide.webp" alt="" class="pm-icon-img" /> 新手指南</button>
        </div>
        <div class="pm-settings-panes" style="flex: 1; overflow-y: auto;">
          <div class="pm-settings-pane" data-pane="text-inspect" style="display: none;">
            <h4 class="pm-settings-pane-title">檢查文字</h4>
            <p class="pm-settings-pane-desc">自動辨識圖中文字，檢查 AI 繪圖常見的英文拼寫錯誤與怪異亂碼——這項需要在獨立視窗中比對標註框與原圖，所以會另開一個檢查視窗。</p>
            <button id="btnOpenTextInspectHeader" class="pm-btn pm-btn-primary pm-settings-launch-btn" style="margin-top: 14px;">
              <img src="icons/header/text-inspect.webp" alt="" class="pm-icon-img" /> 開啟檢查文字
            </button>
          </div>

          <div class="pm-settings-pane" data-pane="pipeline">
            <h4 class="pm-settings-pane-title">管線自訂</h4>
            <p class="pm-settings-pane-desc">專家級印前管線開關：自由自訂 AI 放大、銳化、控墨與階調處理。每個開關切換後立即套用，不需另外儲存。</p>
            <div id="settingsPipelineList" style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;"></div>
          </div>

          <div class="pm-settings-pane" data-pane="guide" style="display: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <h4 class="pm-settings-pane-title" style="margin: 0;">新手指南</h4>
              <button id="btnOpenGuide" class="pm-tool-btn pm-settings-launch-btn" title="開啟小象陪同的完整圖文版指南">
                <img src="icons/header/guide.webp" alt="" class="pm-icon-img" /> 完整圖文版
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 14px;">
              <div style="display: flex; gap: 14px; padding: 14px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(60, 30, 140, 0.1); color: var(--pm-accent-blue); display: flex; align-items: center; justify-content: center; font-size: 1.05rem; font-weight: 800; flex-shrink: 0;">1</div>
                <div>
                  <h5 style="font-size: 0.9rem; font-weight: 700; color: var(--pm-text-primary); margin: 0 0 4px 0;"><img src="icons/shared/camera.webp" alt="" class="pm-icon-img" /> 選擇相片或直接拖進畫面</h5>
                  <p style="font-size: 0.78rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">從相簿選圖或直接拖進畫面，系統依圖片比例自動挑選版型（可再手動切換），並依版型加上出血。</p>
                </div>
              </div>
              <div style="display: flex; gap: 14px; padding: 14px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(52, 199, 89, 0.1); color: var(--pm-status-success); display: flex; align-items: center; justify-content: center; font-size: 1.05rem; font-weight: 800; flex-shrink: 0;">2</div>
                <div>
                  <h5 style="font-size: 0.9rem; font-weight: 700; color: var(--pm-text-primary); margin: 0 0 4px 0;"><img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" /> 自動放大補足 DPI 與 100 分印前健檢</h5>
                  <p style="font-size: 0.78rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">系統依目標 DPI 自動放大與 USM 銳化，並列出修正前後的分數。分數偏低時先看列出的問題，原圖太小就換一張更大的。</p>
                </div>
              </div>
              <div style="display: flex; gap: 14px; padding: 14px; background: var(--pm-bg-secondary); border: 1px solid var(--pm-border-subtle); border-radius: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 149, 0, 0.1); color: var(--pm-status-warning); display: flex; align-items: center; justify-content: center; font-size: 1.05rem; font-weight: 800; flex-shrink: 0;">3</div>
                <div>
                  <h5 style="font-size: 0.9rem; font-weight: 700; color: var(--pm-text-primary); margin: 0 0 4px 0;"><img src="icons/shared/package-box.webp" alt="" class="pm-icon-img" /> 一鍵下載標準 PDF 或超商列印檔</h5>
                  <p style="font-size: 0.78rem; color: var(--pm-text-secondary); margin: 0; line-height: 1.45;">點擊「一鍵下載標準印刷檔 (PDF)」直接送交印刷廠出機，或點擊「超商列印檔案產生器」下載排版好的檔案，再透過超商官網上傳取得取件碼。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Preset Selection Bar -->
  <!-- 2026-08-30 修正：這個列原本永遠顯示，包含還沒上傳任何圖片的初始畫面——但這時候規格
       選擇（A4 經典海報等）並非使用者的決定，只是寫死的初始值，容易讓人誤以為系統已經替
       使用者「決定」了印刷規格。上傳圖片後系統會依圖片尺寸自動判斷最適合的規格
       （detectBestPreset()），因此改成跟主要工作區（studioWorkspace）同步顯示：
       有圖片才出現，此處先預設 display:none 避免 JS 執行前的畫面閃爍。 -->
  <nav class="pm-preset-bar" id="presetSelectionBar" style="display: none;">
    <div class="pm-preset-bar-inner">
      <!-- 1. Simple Mode: Single Interactive Apple Capsule Pill + Dropdown Selector -->
      <div class="pm-simple-preset-bar" id="simplePresetBar">
        <div class="pm-simple-preset-pill" id="simplePresetActivePill" role="button" tabindex="0" title="點擊切換印刷規格 (A3/明信片/名片/貼紙/社群)">
          <img id="simplePresetIcon" src="icons/shared/document-page.webp" alt="" class="pm-icon-img" />
          <span id="simplePresetName" style="font-weight: 700; color: var(--pm-text-primary);">A4 經典海報 (210×297mm)</span>
          <span class="pm-preset-auto-badge" id="simplePresetAutoBadge" style="display: none;"><img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 自動適配</span>
          <span class="pm-dropdown-arrow" style="font-size: 0.72rem; opacity: 0.6; margin-left: 2px;">▾</span>
        </div>
        <div id="simplePresetDropdown" class="pm-simple-preset-dropdown" style="display: none;">
          <button class="pm-preset-btn active" data-preset="poster-a4">
            <img src="icons/shared/document-page.webp" alt="" class="pm-icon-img" /> A4 經典海報 (210×297mm)
          </button>
          <button class="pm-preset-btn" data-preset="poster-a3">
            <img src="icons/shared/picture.webp" alt="" class="pm-icon-img" /> A3 展覽大圖 (297×420mm)
          </button>
          <button class="pm-preset-btn" data-preset="postcard">
            <img src="icons/shared/envelope.webp" alt="" class="pm-icon-img" /> 藝術明信片 (148×100mm)
          </button>
          <button class="pm-preset-btn" data-preset="business-card">
            <img src="icons/shared/id-card.webp" alt="" class="pm-icon-img" /> 商業名片 (90×54mm)
          </button>
          <button class="pm-preset-btn" data-preset="sticker">
            <img src="icons/shared/tag.webp" alt="" class="pm-icon-img" /> 模切貼紙 (50×50mm)
          </button>
          <button class="pm-preset-btn" data-preset="id-photo">
            <img src="icons/shared/id-card.webp" alt="" class="pm-icon-img" /> 2 吋證件照 (35×45mm)
          </button>
          <button class="pm-preset-btn" data-preset="social">
            <img src="icons/shared/phone.webp" alt="" class="pm-icon-img" /> 社群高畫質 (1080px)
          </button>
        </div>
      </div>

      <!-- 2. Advanced Mode: Full Tab Bar -->
      <div class="pm-advanced-preset-bar pm-advanced-only" id="advancedPresetBar">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span class="pm-preset-label">印刷場景</span>
          <span id="presetAutoBadge" class="pm-preset-auto-badge" style="display: none;"><img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 智慧適配</span>
          <div class="pm-preset-tabs" id="presetTabs">
            <button class="pm-preset-btn active" data-preset="poster-a4">
              <img src="icons/shared/document-page.webp" alt="" class="pm-icon-img" /> A4 經典海報 (210×297mm)
            </button>
            <button class="pm-preset-btn" data-preset="poster-a3">
              <img src="icons/shared/picture.webp" alt="" class="pm-icon-img" /> A3 展覽大圖 (297×420mm)
            </button>
            <button class="pm-preset-btn" data-preset="postcard">
              <img src="icons/shared/envelope.webp" alt="" class="pm-icon-img" /> 藝術明信片 (148×100mm)
            </button>
            <button class="pm-preset-btn" data-preset="business-card">
              <img src="icons/shared/id-card.webp" alt="" class="pm-icon-img" /> 商業名片 (90×54mm)
            </button>
            <button class="pm-preset-btn" data-preset="sticker">
              <img src="icons/shared/tag.webp" alt="" class="pm-icon-img" /> 模切貼紙 (50×50mm)
            </button>
            <button class="pm-preset-btn" data-preset="id-photo">
              <img src="icons/shared/id-card.webp" alt="" class="pm-icon-img" /> 2 吋證件照 (35×45mm)
            </button>
            <button class="pm-preset-btn" data-preset="social">
              <img src="icons/shared/phone.webp" alt="" class="pm-icon-img" /> 社群高畫質 (1080px)
            </button>
          </div>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Studio Workspace -->
  <main class="pm-main">
    <!-- 1. Initial State: Clean Hero DropZone -->
    <section id="dropZoneContainer" class="pm-landing-container">
      <div class="pm-dropzone" id="dropZone">
        <div class="pm-dropzone-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <h2 class="pm-dropzone-title"><span class="pm-nobr">把任何一張圖，</span><span class="pm-nobr">變成印刷廠能直接出機的檔案</span></h2>
        <p class="pm-dropzone-subtitle"><span class="pm-nobr">把圖拖進來，或從相簿選一張。</span><span class="pm-nobr">尺寸、解析度、出血與墨量，交給印象魔法。</span></p>
        <div class="pm-dropzone-actions">
          <div class="pm-dropzone-cta-btn" id="btnPickAlbum">
            <span>＋ 從相簿選擇相片</span>
          </div>
        </div>
      </div>

    </section>

    <!-- 2. Active Studio View (Grid: Canvas + Diagnostic Panel) -->
    <section class="pm-studio-grid" id="studioWorkspace" style="display: none;">
      <!-- Left: Stage Canvas & Views -->
      <div class="pm-card">
        <!-- View Modes & Materials Bar -->
        <div class="pm-view-toolbar">
          <div class="pm-view-toolbar-primary">
            <!-- Essential Quick Actions (Simple & Advanced) -->
            <div class="pm-toggle-group">
              <button id="btnToggleCompare" class="pm-tool-btn" title="切換雙向滑桿對比檢視，一秒查看優化前後細節差異">
                <img src="icons/shared/eye.webp" alt="" class="pm-icon-img" /> 原圖對比
              </button>
              <button id="btnOpenObjectEraser" class="pm-tool-btn" style="background: rgba(255, 45, 85, 0.08); color: #d6204b; border-color: rgba(255, 45, 85, 0.25); font-weight: 600;" title="使用智慧塗抹消除筆移除相片中多餘的人物、浮水印、背景雜物或瑕疵（本機演算法，非生成式 AI）">
                <img src="icons/shared/magic-wand.webp" alt="" class="pm-icon-img" /> 消除物件
              </button>
              <button id="btnOpenTextInspect" class="pm-tool-btn pm-advanced-only" style="background: rgba(52, 199, 89, 0.08); color: #248a3d; border-color: rgba(52, 199, 89, 0.25); font-weight: 600;" title="自動辨識圖中文字，檢查 AI 繪圖常見的英文拼寫錯誤與怪異亂碼">
                <img src="icons/header/text-inspect.webp" alt="" class="pm-icon-img" /> 檢查文字
              </button>
              <button id="btnToggleLoupe" class="pm-tool-btn pm-advanced-only" title="切換 20x CMYK 玫瑰網點顯微放大鏡">
                <img src="icons/shared/magnifier.webp" alt="" class="pm-icon-img" /> 20x 網點
              </button>
            </div>

            <!-- Double-Sided Linking Selector (Advanced Only) -->
            <div class="pm-double-sided-group pm-paper-selector pm-advanced-only">
              <button id="btnSideFront" class="pm-paper-btn active" title="檢視與編輯【正面】視覺">
                <img src="icons/shared/picture.webp" alt="" class="pm-icon-img" /> 正面
              </button>
              <button id="btnSideBack" class="pm-paper-btn" title="檢視與編輯【背面】視覺 (支援雙面合版印刷)">
                <img src="icons/shared/id-card.webp" alt="" class="pm-icon-img" /> 背面
              </button>
              <button id="btnLoadBackTemplate" class="pm-tool-btn pm-btn-xs" title="一鍵載入標準明信片/名片背面公版">
                <img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 載入公版
              </button>
            </div>

          </div>

          <!-- Pro Tools & Smart Crop & ICC (Advanced Only) -->
          <div class="pm-view-toolbar-secondary pm-advanced-only">
            <div id="cropToolbarRoot"></div>

            <!-- ICC Profile Selector with Region Context -->
            <div class="pm-icc-selector pm-foil-selector">
              <span class="pm-paper-label">色彩：</span>
              <select id="selectIccProfile" class="pm-select-field" style="font-size: 0.72rem; padding: 2px 6px; height: 24px; border-radius: 6px; border: 1px solid rgba(0, 0, 0, 0.08); background: rgba(255, 255, 255, 0.9); font-weight: 600; color: var(--pm-text-primary); cursor: pointer;">
                <option value="japan-color-2001-coated" selected>🇹🇼 台灣/日本常用合版 (推薦)</option>
                <option value="iso-coated-v2-fogra39">🇪🇺 歐美精裝畫冊 (FOGRA39)</option>
                <option value="gracol-2006-coated">🇺🇸 美加商業印刷 (GRACoL)</option>
                <option value="japan-color-2001-uncoated">📖 模造紙/手帳書刊 (非塗布)</option>
              </select>
            </div>

            <!-- Opt-in illumination flattening for phone photos of artwork (default off) -->
            <label class="pm-foil-selector" for="chkEnableDeshadow" style="cursor: pointer; gap: 4px;" title="拍攝紙本/畫作時的光照不均與手影均勻化。一般數位圖檔請勿開啟，會壓平原本刻意的明暗">
              <input type="checkbox" id="chkEnableDeshadow" />
              <span style="font-size: 0.72rem; font-weight: 600; color: var(--pm-text-primary);"><img src="icons/shared/sun.webp" alt="" class="pm-icon-img" /> 手機翻拍光照均勻化</span>
            </label>

            <div class="pm-toggle-group pm-toggle-group-pro">
              <button id="btnToggleSafeZone" class="pm-tool-btn active" title="顯示 3mm 出血線與安全裁切框">
                <img src="icons/shared/ruler-vector.webp" alt="" class="pm-icon-img" /> 出血框
              </button>
              <button id="btnToggleSoftProof" class="pm-tool-btn" title="模擬 CMYK 實體印刷打樣色彩">
                <img src="icons/shared/printer.webp" alt="" class="pm-icon-img" /> 軟打樣
              </button>
              <button id="btnToggleCvdPreview" class="pm-tool-btn" title="色盲/色覺辨識障礙預覽：模擬紅綠色盲(protanopia/deuteranopia)、藍黃色盲(tritanopia)使用者實際看到的顏色，檢查設計是否過度依賴顏色分辨（Machado 2009 生理模型）">
                <img id="cvdPreviewIcon" src="icons/shared/rainbow-gamut.webp" alt="" class="pm-icon-img" /> <span id="cvdPreviewLabel">色盲預覽</span>
              </button>
              <button id="btnFlipBack" class="pm-tool-btn" title="翻轉查看紙張背面規格標記">
                <span>↻</span> 翻轉紙背
              </button>
            </div>

            <div class="pm-icc-profile-control" title="上傳您印刷廠提供的 CMYK ICC 描述檔（.icc/.icm），軟打樣將改用該描述檔透過自建服務進行真實色彩管理運算（LittleCMS）；未上傳時沿用內建的近似模擬。描述檔會隨圖片一併傳送至本專案自建的處理服務進行運算，不會轉存或用於其他用途；開啟「100% 本機模式」(Privacy Shield) 時，此功能會停用並自動改回近似模擬。">
              <label for="iccProfileInput" class="pm-icc-upload-label pm-tool-btn">
                <img src="icons/shared/folder-upload.webp" alt="" class="pm-icon-img" /> <span id="iccProfileStatus">上傳 ICC 描述檔（選用，真實色彩管理）</span>
              </label>
              <input type="file" id="iccProfileInput" accept=".icc,.icm" style="display: none;">
            </div>
          </div>
        </div>

        <!-- Stage Canvas Sheet -->
        <div class="pm-stage-view pm-paper-glossy" id="stageContainer">
          <!-- Floating iOS Health / Score Badge -->
          <div class="pm-canvas-score-pill" id="canvasScorePill" style="display: none;" title="點擊查看完整印前健檢報告">
            <span id="canvasScoreDot" class="pm-score-dot"></span>
            <span id="canvasScoreText" class="pm-score-val"></span>
            <span id="canvasScoreVerdict" class="pm-score-verdict"></span>
          </div>

          <!-- Canvas Floating Quick HUD (Apple Frosted Glass Pill) -->
          <div class="pm-canvas-hud" id="canvasHud">
            <div class="pm-canvas-hud-group">
              <button id="btnHudZoomOut" class="pm-canvas-hud-btn" type="button" title="縮小畫布檢視">
                <span>−</span>
              </button>
              <button id="btnHudZoomReset" class="pm-canvas-hud-btn" type="button" title="重設為最佳適配尺寸">
                <span>Fit</span>
              </button>
              <button id="btnHudZoomIn" class="pm-canvas-hud-btn" type="button" title="放大畫布檢視">
                <span>+</span>
              </button>
            </div>
            <div class="pm-canvas-hud-divider"></div>
            <button id="btnHudCompare" class="pm-canvas-hud-btn" type="button" title="一鍵切換原圖滑桿對比">
              <span><img src="icons/shared/eye.webp" alt="" class="pm-icon-img" /> 對比</span>
            </button>
            <button id="btnHudReupload" class="pm-canvas-hud-btn" type="button" title="更換另一張圖片">
              <span><img src="icons/shared/refresh.webp" alt="" class="pm-icon-img" /> 換圖</span>
            </button>
          </div>

          <!-- Normal Single / Proof Canvas -->
          <div class="pm-canvas-sheet" id="canvasSheet">
            <img id="mainPreviewImg" src="" alt="預覽圖" />
            <!-- Bleed & Safe Frames -->
            <div class="pm-bleed-frame" id="bleedFrame" style="display: none;">
              <span class="pm-frame-badge pm-frame-badge-bleed">3mm 出血框</span>
            </div>
            <div class="pm-safe-frame" id="safeFrame" style="display: none;">
              <span class="pm-frame-badge pm-frame-badge-safe">安全區 (文字請放此框內)</span>
            </div>
          </div>

          <!-- Split-View Comparison Slider (Hidden by default) -->
          <div id="compareSliderRoot" style="display: none; width: 100%;"></div>

          <!-- Async Processing Overlay -->
          <div class="pm-processing-overlay" id="processingOverlay" style="display: none;">
            <div class="pm-spinner"></div>
            <div class="pm-processing-text" id="processingText">正在以 Lanczos-3 演算法重採樣...</div>
          </div>

          <!-- Backside Quick Add Card (Intuitive for Business Cards & Postcards) -->
          <button id="btnPromptAddBack" class="pm-backside-prompt" type="button" style="display: none;" title="點擊載入背面公版或選擇圖片">
            <span><img src="icons/shared/id-card.webp" alt="" class="pm-icon-img" /> ＋ 加入【背面】視覺 (選用 · 雙圖自動合併為雙面 PDF)</span>
          </button>

          <!-- Reassurance Note for Beginners (消除新手擔心輔助線會被印出來的恐慌) -->
          <div class="pm-canvas-reassurance-note" style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); font-size: 0.72rem; color: var(--pm-text-muted); background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(8px); padding: 3px 12px; border-radius: 20px; border: 1px solid var(--pm-border-subtle); pointer-events: none; white-space: nowrap; z-index: 10;">
            <img src="icons/shared/lock.webp" alt="" class="pm-icon-img" /> 畫布輔助框線僅供對齊參考 · 實體印刷成品保證純淨無任何線條
          </div>
        </div>

        <!-- Bottom Action Export Bar (Dual Simple / Advanced Rendering) -->
        <div class="pm-export-bar">
          <!-- Simple Mode: one download button. Shown only as the mobile floating bar (the score
               card already carries the same button on desktop); PNG / 超商 / 分享 live in advanced mode. -->
          <div class="pm-export-simple-row" id="simpleExportRow">
            <button id="btnSimpleExportPdf" class="pm-btn pm-btn-primary pm-btn-md" style="font-weight: 700; width: 100%; box-shadow: 0 4px 14px rgba(60, 30, 140, 0.32);" title="下載含出血與裁切線的印刷用 PDF">
              下載印刷檔 (PDF)
            </button>
          </div>

          <!-- Advanced Mode macOS Floating Glass Dock -->
          <div class="pm-macos-dock pm-advanced-only" id="advancedExportRow">
            <div class="pm-dock-section">
              <span class="pm-dock-section-label"><img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 智慧增強</span>
              <button id="btnAiRemoveBg" class="pm-dock-btn" title="一鍵去背（雲端模式用自建 rembg 模型，本機模式用背景色距離演算法；背景單純時效果最好）">
                <img class="pm-dock-icon" src="icons/shared/scissors.webp" alt="" />
                <span class="pm-dock-name">髮絲去背</span>
              </button>
              <button id="btnAiVectorizer" class="pm-dock-btn" title="點陣轉真向量 SVG 貝茲曲線檔（自建 VTracer 服務，離線時退回本機貝茲曲線描邊），無限放大無鋸齒">
                <img class="pm-dock-icon" src="icons/shared/pen-nib.webp" alt="" />
                <span class="pm-dock-name">轉真向量</span>
              </button>
              <button id="btnDescreen" class="pm-dock-btn" title="去網紋摩爾紋：FFT 頻域陷波濾波（本機決定性演算法，非 AI），適合翻拍印刷品/掃描文件產生的網點干涉紋。運算量較高，大圖可能需要數秒；一般照片不建議套用（可能誤刪細節）">
                <img class="pm-dock-icon" src="icons/shared/spiral-descreen.webp" alt="" />
                <span class="pm-dock-name">去網紋</span>
              </button>
              <button id="btnJpegDeblock" class="pm-dock-btn" title="JPEG 去區塊：偵測 8x8 壓縮網格邊界的量化痕跡並局部平滑，適合網路截圖/多次轉傳壓縮過的圖片。只處理確認是壓縮瑕疵的邊界，真實圖案邊緣不受影響；一般未經 JPEG 重壓縮的圖片套用可能沒有效果">
                <img class="pm-dock-icon" src="icons/shared/puzzle.webp" alt="" />
                <span class="pm-dock-name">去區塊</span>
              </button>
            </div>

            <div class="pm-dock-divider"></div>

            <div class="pm-dock-section">
              <span class="pm-dock-section-label"><img src="icons/shared/factory.webp" alt="" class="pm-icon-img" /> 出圖工藝</span>
              <button id="btnOpenConvPrint" class="pm-dock-btn" title="7-11 ibon / 全家 FamiPort 超商列印檔案產生器（產生列印檔並連結官方上傳頁，需自行至門市操作取件）">
                <img class="pm-dock-icon" src="icons/shared/store.webp" alt="" />
                <span class="pm-dock-name">超商列印檔</span>
              </button>
              <button id="btnOpenImposition" class="pm-dock-btn" title="把同一張圖自動排滿一張 A4/A3，模數依成品尺寸而定">
                <img class="pm-dock-icon" src="icons/shared/puzzle.webp" alt="" />
                <span class="pm-dock-name">智慧拼模</span>
              </button>
              <button id="btnOpenDieline" class="pm-dock-btn" title="透明貼紙專用：一鍵生成 0.2mm 內縮白墨層與 2mm 洋紅外擴向量刀模線">
                <img class="pm-dock-icon" src="icons/shared/tag.webp" alt="" />
                <span class="pm-dock-name">刀模白墨</span>
              </button>
              <button id="btnOpenSpec" class="pm-dock-btn" title="送印溝通小抄，一鍵複製專業規格給印刷師傅">
                <img class="pm-dock-icon" src="icons/shared/clipboard.webp" alt="" />
                <span class="pm-dock-name">規格小抄</span>
              </button>
              <button id="btnOpenMockup" class="pm-dock-btn" title="一鍵生成現代美術館畫框、北歐書桌情境宣傳圖">
                <img class="pm-dock-icon" src="icons/shared/picture.webp" alt="" />
                <span class="pm-dock-name">展覽Mockup</span>
              </button>
            </div>

            <div class="pm-dock-divider"></div>

            <div class="pm-dock-section pm-dock-actions">
              <button id="btnAdvancedShare" class="pm-dock-btn" title="原生系統 AirDrop / 分享面板">
                <img class="pm-dock-icon" src="icons/shared/share.webp" alt="" />
                <span class="pm-dock-name">分享</span>
              </button>
              <button id="btnOpenExportModal" class="pm-dock-btn pm-dock-btn-primary" title="商業多格式出機中心：PDF / TIFF / JPG / PNG / 刀模 / 出機全套包">
                <img class="pm-dock-icon" src="icons/shared/printer.webp" alt="" />
                <span class="pm-dock-name">出機中心</span>
              </button>
              <button id="btnExportPdf" class="pm-dock-btn" title="匯出含裁切十字與出血的印刷用 PDF（分色服務可用時為 CMYK，否則為 RGB，由印刷廠轉檔）">
                <img class="pm-dock-icon" src="icons/shared/document-page.webp" alt="" />
                <span class="pm-dock-name">標準 PDF</span>
              </button>
              <button id="btnExportTiff" class="pm-dock-btn" title="匯出 300 DPI 工業級無損 TIFF 點陣檔">
                <img class="pm-dock-icon" src="icons/shared/printer.webp" alt="" />
                <span class="pm-dock-name">無損 TIFF</span>
              </button>
              <button id="btnExportPng" class="pm-dock-btn" title="匯出 300 DPI 高解析度 PNG">
                <img class="pm-dock-icon" src="icons/shared/download.webp" alt="" />
                <span class="pm-dock-name">下載 PNG</span>
              </button>
              <button id="btnExportSvg" class="pm-dock-btn" title="本機描邊轉為 SVG 向量（直線多邊形輪廓，適合色塊/線稿；照片細節會被簡化）">
                <img class="pm-dock-icon" src="icons/shared/hexagon-vector.webp" alt="" />
                <span class="pm-dock-name">向量 SVG</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Batch Studio Gallery Filmstrip (Bottom) -->
        <div id="batchBarRoot" class="pm-batch-container" style="display: none;"></div>
      </div>

      <!-- Right: Diagnostic & Score Panel -->
      <aside id="diagnosticCardRoot"></aside>
    </section>

    <!-- 🐘 Xiaoxiang Assistant Dialog Card (Inspired by Dan Dan danCard) -->
    <div id="xiangAssistantRoot"></div>
  </main>
</div>
`;

/** Render the app shell into <body> (before the module script tag). Idempotent. */
export function mountAppShell(doc: Document = document): HTMLElement {
  const existing = doc.getElementById('app');
  if (existing) return existing;
  const template = doc.createElement('template');
  template.innerHTML = APP_SHELL_HTML.trim();
  doc.body.prepend(template.content);
  return doc.getElementById('app') as HTMLElement;
}
