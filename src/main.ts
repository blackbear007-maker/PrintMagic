import './styles/index.css';
import './styles/studio.css';
import './styles/components.css';
import './styles/theme-paper.css';

import { mountAppShell } from './ui/app-shell';
import { store, type AppState } from './ui/state';
import { DropZone, type LoadedImageResult } from './ui/dropzone';
import { DiagnosticCard } from './ui/diagnostic-card';
import { CompareSlider } from './ui/compare-slider';
import { Paper3DController } from './ui/paper-3d';
import { LoupeController } from './ui/loupe';
import { LaserScanController } from './ui/laser-scan';
import { MockupModal } from './ui/mockup-modal';
import { SpecModal } from './ui/spec-modal';
import { BatchBar } from './ui/batch-bar';
import { CropController } from './ui/crop-controller';
import { NetworkGuard } from './services/network-guard';
import { Toast } from './ui/toast';
import { SoundEffects } from './core/sound-effects';
import { CmykEngine } from './core/cmyk-engine';
import { getPresetById, detectBestPreset } from './core/presets';
import { DoubleSidedManager, type BackTemplateType } from './core/double-sided';
import { iccProfileEngine, type IccProfileId } from './core/icc-profiles';
import { ConveniencePrintModal } from './ui/convenience-print-modal';
import { ImpositionModal } from './ui/imposition-modal';
import { DielineModal } from './ui/dieline-modal';
import { OnboardingModal } from './ui/onboarding-modal';
import { renderPipelineSwitchList, bindPipelineSwitchList } from './ui/pipeline-matrix-modal';
import { ExportModal } from './ui/export-modal';
import { MultiFormatExporter } from './engines/multi-format-exporter';
import { TextInspectionModal } from './ui/text-inspection-modal';
import { TextInspector } from './core/text-inspector';
import { ObjectEraserModal } from './ui/object-eraser-modal';
import { BleedExpander } from './core/bleed-expander';
import { trimForImage } from './core/print-layout';
import { FreeIccClient } from './services/free-icc-client';
import { AiVectorizer } from './core/ai-vectorizer';
import { FreeVectorizeClient } from './services/free-vectorize-client';
import { PdfExporter } from './engines/pdf-exporter';
import { VectorTracer } from './engines/vector-tracer';
import { ColorBlindnessSimulator, type CvdType } from './core/color-blindness-simulator';
import { CanvasZoomController } from './ui/canvas-zoom';
import { WebShareService } from './services/web-share';
import { XiaoxiangAssistant } from './ui/xiaoxiang-assistant';
import { SceneClassifier } from './core/scene-classifier';
import { PipelineOrchestrator } from './core/pipeline-orchestrator';
import type { BatchItem, PrintPresetId, SourceEdits } from './types';
import { MAX_DESCREEN_INPUT_PIXELS } from './core/moire-descreen';

/** Icon asset id (public/icons/shared/<id>.webp) per print preset, for the preset pill/tabs. */
const PRESET_ICON_IDS: Record<string, string> = {
  'poster-a4': 'document-page',
  'poster-a3': 'picture',
  'postcard': 'envelope',
  'business-card': 'id-card',
  'sticker': 'tag',
  'id-photo': 'id-card',
  'social': 'phone',
};

/**
 * PrintMagic Studio 3.1 Pro Dual-Engine Main Controller
 */
class App {
  public diagnosticCard!: DiagnosticCard;
  public compareSlider!: CompareSlider;
  public paper3D!: Paper3DController;
  public canvasZoom!: CanvasZoomController;
  public xiangAssistant!: XiaoxiangAssistant;
  public doubleSidedManager = new DoubleSidedManager();
  public loupe!: LoupeController;
  public laserScan!: LaserScanController;
  public mockupModal!: MockupModal;
  public specModal!: SpecModal;
  public convPrintModal!: ConveniencePrintModal;
  public impositionModal!: ImpositionModal;
  public dielineModal!: DielineModal;
  public textInspectionModal!: TextInspectionModal;
  public objectEraserModal!: ObjectEraserModal;
  public onboardingModal!: OnboardingModal;
  public exportModal!: ExportModal;
  public dropZoneInstance!: DropZone;
  public batchBar!: BatchBar;
  public cropController!: CropController;
  private pipeline!: PipelineOrchestrator;

  // DOM references
  private dropZoneContainer = document.getElementById('dropZoneContainer')!;
  private studioWorkspace = document.getElementById('studioWorkspace')!;
  private presetSelectionBar = document.getElementById('presetSelectionBar')!;
  private btnModeSimple = document.getElementById('btnModeSimple');
  private btnModeAdvanced = document.getElementById('btnModeAdvanced');
  private btnNewArtwork = document.getElementById('btnNewArtwork')!;
  private mainPreviewImg = document.getElementById('mainPreviewImg') as HTMLImageElement;
  private canvasSheet = document.getElementById('canvasSheet')!;
  private compareSliderRoot = document.getElementById('compareSliderRoot')!;
  private bleedFrame = document.getElementById('bleedFrame')!;
  private safeFrame = document.getElementById('safeFrame')!;
  private processingOverlay = document.getElementById('processingOverlay')!;
  private processingText = document.getElementById('processingText')!;
  private presetAutoBadge = document.getElementById('presetAutoBadge');

  // Tool buttons
  private btnToggleCompare = document.getElementById('btnToggleCompare')!;
  private btnToggleLoupe = document.getElementById('btnToggleLoupe')!;
  private btnFlipBack = document.getElementById('btnFlipBack')!;
  private btnToggleSoftProof = document.getElementById('btnToggleSoftProof')!;
  private btnToggleCvdPreview = document.getElementById('btnToggleCvdPreview')!;
  private cvdPreviewLabel = document.getElementById('cvdPreviewLabel')!;
  private btnToggleSafeZone = document.getElementById('btnToggleSafeZone')!;
  private iccProfileInput = document.getElementById('iccProfileInput') as HTMLInputElement;
  private iccProfileStatus = document.getElementById('iccProfileStatus')!;

  // Action buttons
  private btnOpenMockup = document.getElementById('btnOpenMockup')!;
  private btnOpenSpec = document.getElementById('btnOpenSpec')!;
  private btnExportPdf = document.getElementById('btnExportPdf')!;
  private btnExportPng = document.getElementById('btnExportPng')!;
  private btnExportSvg = document.getElementById('btnExportSvg')!;

  // Preset & Paper buttons
  private presetButtons = document.querySelectorAll<HTMLButtonElement>('.pm-preset-btn');

  // Cache of view variations
  private softProofDataUrl: string | null = null;
  private cvdPreviewDataUrl: string | null = null;
  private cvdPreviewCachedType: CvdType | null = null;
  private lastPreviewSource: ImageData | null = null;
  // 手動套用文字疊加時的底圖（疊加前）與產出，用來避免重複疊印
  // 已補過出血的 processedImageData（避免重複外擴）

  // User-uploaded CMYK ICC profile (session-only, in-memory) — see free-icc-client.ts
  private uploadedIccProfile: { bytes: ArrayBuffer; name: string } | null = null;

  constructor() {
    this.initUIComponents();
    this.pipeline = new PipelineOrchestrator(
      this.laserScan,
      this.doubleSidedManager,
      this.xiangAssistant,
      () => this.invalidatePreviewCaches()
    );
    this.bindEvents();
    this.subscribeState();
    this.initServiceWorker();
    this.updatePresetButtonsUI(store.getState().currentPreset.id, null);

    // Check Cloud Backend status on startup (Advanced mode only)
    void NetworkGuard.checkHealth();
  }

  /** 任何直接改寫 processedImageData 的操作都要呼叫，避免軟打樣/色盲預覽顯示編輯前的舊圖。 */
  private invalidatePreviewCaches(): void {
    this.softProofDataUrl = null;
    this.cvdPreviewDataUrl = null;
    this.cvdPreviewCachedType = null;
  }

  /** 標記某項「手動選用」加強功能已對目前圖片套用過，供出機中心的提醒清單使用。 */
  private markManualEnhancementApplied(key: keyof AppState['manualEnhancementsApplied']): void {
    store.setState({
      manualEnhancementsApplied: {
        ...store.getState().manualEnhancementsApplied,
        [key]: true
      }
    });
  }

  private initServiceWorker(): void {
    if (import.meta.env.DEV && 'serviceWorker' in navigator) {
      // 開發時不用 SW：它會把 Vite 的 /src 模組當一般資源快取起來，改完程式要重新整理兩次才看得到新版。
      // 也順手清掉先前開發時已經註冊的 sw.js 與它的快取。
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => registrations.forEach((r) => void r.unregister()))
        .catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k))).catch(() => {});
      }
    } else if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('./sw.js')
        .catch((err) => {
          console.log('SW registration skipped or error:', err);
        });
    }

    // Monitor Online / Offline status
    window.addEventListener('offline', () => {
      Toast.info('📱 目前處於離線狀態：本機放大與 PDF 輸出仍可使用，需要自建服務的功能會退回本機演算法');
    });

    window.addEventListener('online', () => {
      Toast.success('🌐 網路連線已恢復！');
    });
  }

  private initUIComponents(): void {
    // 1. DropZone (Multi-file batch support)
    this.dropZoneInstance = new DropZone('dropZone', (results) => {
      this.handleImagesUploaded(results);
    });

    // 2. Diagnostic Card
    this.diagnosticCard = new DiagnosticCard(
      'diagnosticCardRoot',
      () => {
        this.btnExportPdf.click();
      },
      () => {
        const state = store.getState();
        if (state.originalImageData) {
          this.pipeline.runOptimizationPipeline(state.originalImageData);
        }
      },
      () => {
        this.openTextInspectionModal();
      },
      () => {
        this.exportModal.open();
      }
    );

    // 3. Compare Slider
    this.compareSlider = new CompareSlider('compareSliderRoot');

    // 4. 3D Paper Physics Controller
    this.paper3D = new Paper3DController('stageContainer', 'canvasSheet', store.getState().currentPreset);

    // 6. 🤌 Touch Pinch-to-Zoom & Long-Press Peek Controller
    this.canvasZoom = new CanvasZoomController('stageContainer', 'canvasSheet', 'mainPreviewImg');

    // 7. 3D Luxury Foil & Spot UV Simulator

    // 7. 10x Halftone Loupe (simulated screen)
    this.loupe = new LoupeController('stageContainer');

    // 8. Laser Scanline
    this.laserScan = new LaserScanController('stageContainer');

    // 9. Modals
    this.mockupModal = new MockupModal();
    this.specModal = new SpecModal();
    this.convPrintModal = new ConveniencePrintModal();
    this.impositionModal = new ImpositionModal();
    this.dielineModal = new DielineModal();
    this.textInspectionModal = new TextInspectionModal();
    this.objectEraserModal = new ObjectEraserModal((newImageData, newDataUrl) => {
      // Replace original with the erased image and re-run optimization pipeline. The batch item gets it
      // too (2026-09-26): otherwise switching items and back, or 批次全優化, restored the un-erased image.
      store.setState({
        originalImageData: newImageData,
        originalDataUrl: newDataUrl
      });
      const activeId = store.getState().activeBatchId;
      if (activeId) store.updateBatchItem(activeId, { originalImageData: newImageData, originalDataUrl: newDataUrl });
      this.pipeline.runOptimizationPipeline(newImageData);
    });
    this.onboardingModal = new OnboardingModal();
    this.exportModal = new ExportModal();

    // 10. Crop Controller
    this.cropController = new CropController('cropToolbarRoot', 'mainPreviewImg');

    // 11. Batch Studio Filmstrip Bar
    this.batchBar = new BatchBar('batchBarRoot', {
      onAddFiles: (files) => {
        // ⚠️ 2026-08-29 修正：這裡原本每次呼叫都 `new DropZone(...)`，對著同一個 #dropZone
        // 元素重複綁定 click/dragover/dragleave/drop 監聽器（疊加、永遠不會被移除），
        // 還會在 document.body 底下建立一個從未使用、也從未移除的隱藏 <input type=file>（DOM 洩漏）。
        // 改成重用建構時就已存在、事件已綁定好的 this.dropZoneInstance。
        this.dropZoneInstance.handleFiles(Array.from(files));
      },
      onBatchOptimize: () => {
        this.pipeline.runBatchOptimizeAll();
      },
      onBatchExportPdf: () => {
        this.pipeline.runBatchExportAllPdf();
      }
    });

    // 12. 🐘 Xiaoxiang Dialog Assistant (Inspired by Dan Dan danCard)
    this.xiangAssistant = new XiaoxiangAssistant('xiangAssistantRoot');
    Toast.onToastListener = (msg) => {
      this.xiangAssistant.say(msg, 5000);
    };
  }

  private bindEvents(): void {
    // Hybrid Dual-Engine Switcher (two explicit buttons: 本機隱私模式 / 雲端AI模式)
    document.getElementById('btnEngineLocal')?.addEventListener('click', () => {
      if (store.getState().engineMode === 'local') return;
      SoundEffects.sliderTick();
      store.setEngineMode('local');
      Toast.info('🖥️ 已切換至【本機隱私模式】：所有處理改用本機演算法，圖片不會上傳。臉部偵測與 ICC 精準軟打樣需要自建服務，本機模式下改用近似演算法或停用。');
    });
    document.getElementById('btnEngineCloud')?.addEventListener('click', async () => {
      if (store.getState().engineMode === 'cloud') return;
      SoundEffects.sliderTick();
      const isOnline = await NetworkGuard.checkHealth();
      store.setEngineMode('cloud');
      if (isOnline) {
        Toast.success('⚡ 已切換至【雲端AI模式】：在線運行 (可使用自建向量化 / 低光提亮服務)');
      } else {
        Toast.info('⚡ 已切換至【雲端AI模式】(伺服器未連線，會自動退回本機演算法)');
      }
    });

    // Open Onboarding Beginner Guide Modal
    document.getElementById('btnOpenGuide')?.addEventListener('click', () => {
      this.onboardingModal.open();
    });

    // Reset / New Artwork
    this.btnNewArtwork.addEventListener('click', () => {
      store.reset();
      this.invalidatePreviewCaches();
      // 雙面背面屬於上一張作品，不能帶進下一張
      this.doubleSidedManager.clearBackImage();
      this.loupe.setImageData(null);
      this.loupe.setEnabled(false);
      Toast.info('已重置畫布，請拖入新圖片');
    });

    // Simple Mode Preset Capsule Dropdown Toggle
    const simplePresetPill = document.getElementById('simplePresetActivePill');
    const simplePresetDropdown = document.getElementById('simplePresetDropdown');
    simplePresetPill?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (simplePresetDropdown) {
        const isHidden = simplePresetDropdown.style.display === 'none' || !simplePresetDropdown.style.display;
        simplePresetDropdown.style.display = isHidden ? 'flex' : 'none';
        SoundEffects.sliderTick();
      }
    });

    // Close simple preset dropdown on outside click
    document.addEventListener('click', (e) => {
      if (simplePresetDropdown && simplePresetDropdown.style.display === 'flex') {
        if (!simplePresetDropdown.contains(e.target as Node) && e.target !== simplePresetPill) {
          simplePresetDropdown.style.display = 'none';
        }
      }
    });

    // Sound on/off (2026-09-26: sounds played with no way to turn them off — the old toggle's element was gone)
    const btnToggleSound = document.getElementById('btnToggleSound');
    const renderSoundButton = () => {
      const muted = SoundEffects.getIsMuted();
      const icon = document.getElementById('soundIcon');
      if (icon) icon.textContent = muted ? '🔇' : '🔊';
      btnToggleSound?.setAttribute('aria-pressed', String(muted));
      btnToggleSound?.setAttribute('title', muted ? '音效已關閉（點一下開啟）' : '音效開啟中（點一下關閉）');
    };
    renderSoundButton();
    btnToggleSound?.addEventListener('click', () => {
      const muted = SoundEffects.toggleMute();
      renderSoundButton();
      Toast.info(muted ? '🔇 音效已關閉' : '🔊 音效已開啟');
    });

    // Header Settings Gear: opens a tabbed modal collapsing 檢查文字/放大/管線自訂/新手指南/螢幕校準
    const headerSettingsModal = document.getElementById('headerSettingsModal');
    const openHeaderSettings = () => {
      if (!headerSettingsModal) return;
      // The same switches also live on the advanced-mode score card — re-read the current values.
      const pipelineList = document.getElementById('settingsPipelineList');
      if (pipelineList) pipelineList.innerHTML = renderPipelineSwitchList();
      headerSettingsModal.style.display = 'flex';
      requestAnimationFrame(() => headerSettingsModal.classList.add('pm-modal-open'));
      SoundEffects.sliderTick();
    };
    const closeHeaderSettings = () => {
      if (!headerSettingsModal) return;
      headerSettingsModal.classList.remove('pm-modal-open');
      headerSettingsModal.style.display = 'none';
    };
    document.getElementById('btnOpenHeaderSettings')?.addEventListener('click', openHeaderSettings);
    document.getElementById('btnCloseHeaderSettings')?.addEventListener('click', closeHeaderSettings);

    // 管線自訂 tab embeds the real switch list (see image-2-style request) — bound once, each
    // toggle applies to the store and re-runs the pipeline immediately, no separate save step.
    const settingsPipelineList = document.getElementById('settingsPipelineList');
    if (settingsPipelineList) {
      settingsPipelineList.innerHTML = renderPipelineSwitchList();
      bindPipelineSwitchList(settingsPipelineList, () => {
        const state = store.getState();
        if (state.originalImageData) {
          this.pipeline.runOptimizationPipeline(state.originalImageData);
        }
      });
    }
    headerSettingsModal?.addEventListener('click', (e) => {
      if (e.target === headerSettingsModal) closeHeaderSettings();
    });
    // Tab strip switches which pane is visible; it never closes the modal.
    headerSettingsModal?.querySelectorAll<HTMLButtonElement>('.pm-settings-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetPane = tab.dataset.tab;
        headerSettingsModal.querySelectorAll('.pm-settings-tab').forEach((t) => t.classList.toggle('active', t === tab));
        headerSettingsModal.querySelectorAll<HTMLElement>('.pm-settings-pane').forEach((pane) => {
          pane.style.display = pane.dataset.pane === targetPane ? 'block' : 'none';
        });
        SoundEffects.sliderTick();
      });
    });
    // "開啟 X" launch buttons trigger their own already-bound handler elsewhere; this just also
    // closes the settings modal afterward so it doesn't linger behind the feature it opened.
    headerSettingsModal?.querySelectorAll('.pm-settings-launch-btn').forEach((btn) => {
      btn.addEventListener('click', () => closeHeaderSettings());
    });

    // Preset Selection (handles both Simple dropdown and Advanced tab bar)
    this.presetButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const presetId = btn.dataset.preset as PrintPresetId;
        if (presetId) {
          if (simplePresetDropdown) {
            simplePresetDropdown.style.display = 'none';
          }
          store.setPreset(presetId);
          this.paper3D.updatePreset(store.getState().currentPreset);
          this.updatePresetButtonsUI(presetId, false);
          SoundEffects.sliderTick();

          // Re-run pipeline for new physical dimensions
          const state = store.getState();
          if (state.originalImageData) {
            // 2 吋證件照的抓臉裁切在管線的原圖階段做（pipeline-orchestrator applySourceStage），
            // 每次重跑都會重新套用，不再只在點這個按鈕時做一次。
            await this.pipeline.runOptimizationPipeline(state.originalImageData);
          }
        }
      });
    });

    // Toggle Compare View
    this.btnToggleCompare.addEventListener('click', () => {
      store.toggleComparing();
      SoundEffects.sliderTick();
      const state = store.getState();
      const hudCompareBtn = document.getElementById('btnHudCompare');
      if (hudCompareBtn) {
        hudCompareBtn.classList.toggle('active', state.isComparing);
      }
      if (state.isComparing) {
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.compareOn, 5000);
      }
    });

    // Toggle Loupe Magnifier
    this.btnToggleLoupe.addEventListener('click', () => {
      const active = this.loupe.toggle();
      this.btnToggleLoupe.classList.toggle('active', active);
      SoundEffects.sliderTick();
      if (active) {
        Toast.info('🔍 10x 網點放大鏡已啟動（網點示意）');
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.loupeOn, 5000);
      }
    });

    // Flip Paper Back / Front
    this.btnFlipBack.addEventListener('click', () => {
      this.paper3D.flip();
      const isFlipped = this.paper3D.getIsFlipped();
      this.btnFlipBack.classList.toggle('active', isFlipped);
      SoundEffects.cardFlip();
      Toast.info(isFlipped ? '↻ 已翻轉至紙張背面 (查看背面規格)' : '↻ 已翻回紙張正面');
    });

    // Toggle Soft Proof
    this.btnToggleSoftProof.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.processedImageData) return;

      SoundEffects.sliderTick();

      if (!state.showSoftProof && !this.softProofDataUrl) {
        if (this.uploadedIccProfile) {
          Toast.info('🖨️ 正在以您上傳的 ICC 描述檔進行真實色彩管理運算...');
          const src = state.processedImageData;
          let result: Awaited<ReturnType<typeof FreeIccClient.softProof>>;
          try {
            result = await FreeIccClient.softProof(src, this.uploadedIccProfile.bytes);
          } catch (err: any) {
            Toast.error(`軟打樣失敗：${err?.message || '未知錯誤'}`);
            return;
          }
          // 等待期間圖片已被換掉 → 丟棄過期結果
          if (store.getState().processedImageData !== src) return;
          if (result.available && result.dataUrl) {
            this.softProofDataUrl = result.dataUrl;
            const tacMsg = result.tac ? `（真實總墨量 TAC：最高 ${result.tac.maxPercent}%，平均 ${result.tac.meanPercent}%）` : '';
            Toast.success(`✅ 已套用真實描述檔色彩管理：${result.profileName || ''}${tacMsg}`);
          } else {
            const proof = CmykEngine.simulatePrintProof(state.processedImageData);
            this.softProofDataUrl = this.imageDataToDataUrl(proof);
            Toast.info(`⚠️ ${result.error || result.engine}，已改用內建近似模擬`);
          }
        } else {
          const proof = CmykEngine.simulatePrintProof(state.processedImageData);
          this.softProofDataUrl = this.imageDataToDataUrl(proof);
        }
      }
      store.toggleSoftProof();
      const updatedState = store.getState();
      if (updatedState.showSoftProof) {
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.softProofOn, 5000);
      } else {
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.softProofOff, 3000);
      }
    });

    // Cycle Color-Blindness (CVD) Preview: off -> protanopia -> deuteranopia -> tritanopia -> off
    this.btnToggleCvdPreview.addEventListener('click', () => {
      const state = store.getState();
      if (!state.processedImageData) return;

      SoundEffects.sliderTick();
      store.cycleCvdPreview();
      const type = store.getState().cvdPreviewType;

      if (type && (type !== this.cvdPreviewCachedType || !this.cvdPreviewDataUrl)) {
        const preview = ColorBlindnessSimulator.simulate(state.processedImageData, type);
        this.cvdPreviewDataUrl = this.imageDataToDataUrl(preview);
        this.cvdPreviewCachedType = type;
      }

      const labels: Record<CvdType, string> = {
        protanopia: '紅色盲預覽',
        deuteranopia: '綠色盲預覽',
        tritanopia: '藍黃色盲預覽'
      };
      this.cvdPreviewLabel.textContent = type ? labels[type] : '色盲預覽';
      if (type) {
        Toast.info(`🌈 ${labels[type]}中 — 模擬色覺辨識障礙使用者實際看到的顏色`);
      } else {
        Toast.info('🌈 已關閉色盲預覽');
      }
    });

    // Upload user's own CMYK ICC profile (session-only, in-memory) — enables real ICC soft-proof
    this.iccProfileInput.addEventListener('change', async () => {
      const file = this.iccProfileInput.files?.[0];
      if (!file) return;

      try {
        const bytes = await file.arrayBuffer();
        this.uploadedIccProfile = { bytes, name: file.name };
        this.iccProfileStatus.textContent = `✅ ${file.name}`;
        this.softProofDataUrl = null; // force regeneration through the new profile next time soft-proof is toggled
        Toast.success(`📁 已載入 ICC 描述檔：${file.name}（下次開啟軟打樣時將套用真實色彩管理）`);
      } catch (err: any) {
        Toast.error(`ICC 描述檔讀取失敗：${err?.message || err}`);
      }
    });

    // Toggle Safe Zone
    this.btnToggleSafeZone.addEventListener('click', () => {
      store.toggleSafeZone();
      SoundEffects.sliderTick();
      const updatedState = store.getState();
      if (updatedState.showSafeZone) {
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.safeZoneOn, 5000);
      } else {
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.safeZoneOff, 3000);
      }
    });

    // Open Gallery Mockup Modal
    this.btnOpenMockup.addEventListener('click', () => {
      const state = store.getState();
      if (!state.processedDataUrl) {
        Toast.error('請先上傳圖片');
        return;
      }
      const img = new Image();
      img.onload = () => {
        this.mockupModal.open(img);
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.mockup, 5000);
      };
      img.src = state.processedDataUrl;
    });

    // Open Print Shop Spec Sheet
    this.btnOpenSpec.addEventListener('click', () => {
      const state = store.getState();
      if (!state.processedDataUrl) {
        Toast.error('請先上傳圖片');
        return;
      }
      this.specModal.open(state);
      this.xiangAssistant?.say(XiaoxiangAssistant.LINES.specCopy, 5000);
    });

    // Double-Sided Linking Controls (Front / Back)
    document.getElementById('btnSideFront')?.addEventListener('click', () => {
      this.doubleSidedManager.setActiveSide('front');
      document.getElementById('btnSideFront')?.classList.add('active');
      document.getElementById('btnSideBack')?.classList.remove('active');
      SoundEffects.sliderTick();

      const ds = this.doubleSidedManager.getState();
      if (ds.frontDataUrl) {
        this.mainPreviewImg.src = ds.frontDataUrl;
      }
      Toast.info('🖼️ 已切換至【正面】設計視覺');
    });

    document.getElementById('btnSideBack')?.addEventListener('click', () => {
      const ds = this.doubleSidedManager.getState();
      if (!ds.hasBack) {
        // 2026-09-26: this used to insert a template here, which then printed as PDF page 2 just because
        // the user looked at the back tab — for business cards with placeholder text and a fake phone
        // number. Now the back stays empty until the user loads a template or uploads a back image.
        Toast.info('還沒有背面：按「載入公版」，或一次上傳兩張圖（第二張當背面）');
        return;
      }

      this.doubleSidedManager.setActiveSide('back');
      document.getElementById('btnSideBack')?.classList.add('active');
      document.getElementById('btnSideFront')?.classList.remove('active');
      SoundEffects.sliderTick();

      const updatedDs = this.doubleSidedManager.getState();
      if (updatedDs.backDataUrl) {
        this.mainPreviewImg.src = updatedDs.backDataUrl;
      }
      Toast.info('📇 已切換至【背面】設計視覺 (雙面合版)');
    });

    document.getElementById('btnLoadBackTemplate')?.addEventListener('click', () => {
      const state = store.getState();
      // Business cards get a blank back: the old one printed "COMPANY NAME", example.com and a made-up
      // phone number that could not be edited.
      const tmplType: BackTemplateType = state.currentPreset.id === 'postcard' ? 'postcard_standard' : 'blank_white';
      const tmpl = DoubleSidedManager.generateBackTemplate(tmplType, state.currentPreset);
      this.doubleSidedManager.setBackImage(tmpl.dataUrl, tmpl.imageData);
      this.doubleSidedManager.setActiveSide('back');
      document.getElementById('btnSideBack')?.classList.add('active');
      document.getElementById('btnSideFront')?.classList.remove('active');
      this.mainPreviewImg.src = tmpl.dataUrl;
      SoundEffects.paperDrop();
      Toast.success(`✨ 已載入【${state.currentPreset.nameZh}】專用 300 DPI 背面公版！`);
    });

    // Backside Quick Prompt Click
    document.getElementById('btnPromptAddBack')?.addEventListener('click', () => {
      if (store.getState().currentPreset.id === 'postcard') {
        document.getElementById('btnLoadBackTemplate')?.click();
      } else {
        Toast.info('名片背面請用自己的背面圖：和正面一起上傳兩張，第二張會當背面');
      }
    });

    // ☀️ Opt-in phone-photo illumination flattening (HandShadowBalancer), default off
    const chkDeshadow = document.getElementById('chkEnableDeshadow') as HTMLInputElement | null;
    if (chkDeshadow) {
      chkDeshadow.checked = store.getState().pipelineOptions.enableDeshadow === true;
      store.subscribe((s) => {
        const on = s.pipelineOptions.enableDeshadow === true;
        if (chkDeshadow.checked !== on) chkDeshadow.checked = on;
      });
      chkDeshadow.addEventListener('change', () => {
        store.setPipelineOption('enableDeshadow', chkDeshadow.checked);
        SoundEffects.sliderTick();
        const s = store.getState();
        if (s.originalImageData) {
          void this.pipeline.runOptimizationPipeline(s.originalImageData);
        }
      });
    }

    // International ICC Profile Selector
    document.getElementById('selectIccProfile')?.addEventListener('change', (e) => {
      const iccId = (e.target as HTMLSelectElement).value as IccProfileId;
      if (iccId) {
        iccProfileEngine.setProfile(iccId);
        const active = iccProfileEngine.getActiveProfile();
        SoundEffects.sliderTick();
        Toast.info(`🎨 已切換印刷色彩描述檔：【${active.name}】`);
      }
    });

    // ✂️ 去背（自建 rembg/u2netp 優先，離線時自動退回本機顏色距離去背）。2026-09-26 起記在這張圖的
    // 處理紀錄裡，由管線在放大後、補出血前套用，重跑或切換批次都不會掉；再按一次取消。
    document.getElementById('btnAiRemoveBg')?.addEventListener('click', () => {
      void this.toggleSourceEdit('removeBg', '去背');
    });

    // ✒️ AI 點陣轉真向量 SVG 貝茲曲線檔 (VTracer Rust / 本機三次貝茲曲線雙通道)
    document.getElementById('btnAiVectorizer')?.addEventListener('click', async () => {
      const state = store.getState();
      const imgData = state.processedImageData || state.originalImageData;
      if (!imgData) {
        Toast.error('請先上傳圖片');
        return;
      }

      SoundEffects.laserScan();
      Toast.info('✒️ 正在啟動 VTracer Rust / 貝茲向量引擎提取精準路徑...');

      try {
        const { svg, engineName, elapsedMs } = await FreeVectorizeClient.vectorizeImage(imgData, 12, 1.5);
        AiVectorizer.downloadSvg(svg, `PrintMagic_Vector_${state.currentPreset.id}_${Date.now()}.svg`);
        this.markManualEnhancementApplied('vectorize');
        SoundEffects.shutterClick();
        Toast.success(`✓ 向量 SVG 已生成並下載！[${engineName}] ${elapsedMs ? `(${elapsedMs}ms)` : ''}`);
      } catch (err: any) {
        // Ultimate fallback
        const svgString = AiVectorizer.traceToSvg(imgData, 12, 2);
        AiVectorizer.downloadSvg(svgString, `PrintMagic_Vector_${state.currentPreset.id}_${Date.now()}.svg`);
        this.markManualEnhancementApplied('vectorize');
        SoundEffects.shutterClick();
        Toast.success('✓ 向量 SVG 檔案已由本機引擎生成並下載！');
      }
    });

    // Open AI Object Eraser Modal
    document.getElementById('btnOpenObjectEraser')?.addEventListener('click', () => {
      const state = store.getState();
      const imgData = state.originalImageData || state.processedImageData;
      if (!imgData) {
        Toast.error('請先上傳圖片');
        return;
      }
      this.objectEraserModal.open(imgData);
    });


    // Floating Canvas Score Pill Click -> Scroll smoothly to Diagnostic Card
    document.getElementById('canvasScorePill')?.addEventListener('click', () => {
      SoundEffects.shutterClick();
      const card = document.getElementById('diagnosticCardRoot');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Open Smart Dieline & White Ink Modal
    document.getElementById('btnOpenDieline')?.addEventListener('click', () => {
      this.dielineModal.open();
      this.xiangAssistant?.say(XiaoxiangAssistant.LINES.dieline, 5000);
    });

    // 🌀 去網紋（本機 FFT 陷波濾波）與 🧩 JPEG 去區塊：2026-09-26 起改在原圖上做（放大前，JPEG 8×8 格線
    // 與網點還在原位），記在這張圖的處理紀錄裡，每次重跑由管線重新套用（有快取）；再按一次取消。
    document.getElementById('btnDescreen')?.addEventListener('click', () => {
      const src = store.getState().originalImageData;
      if (src && !store.getState().sourceEdits.descreen && src.width * src.height > MAX_DESCREEN_INPUT_PIXELS) {
        Toast.error(`去網紋只能處理 ${(MAX_DESCREEN_INPUT_PIXELS / 1e6).toFixed(0)} 百萬像素以下的原圖（這張 ${((src.width * src.height) / 1e6).toFixed(1)} 百萬像素）`);
        return;
      }
      void this.toggleSourceEdit('descreen', '去網紋');
    });
    document.getElementById('btnJpegDeblock')?.addEventListener('click', () => {
      void this.toggleSourceEdit('deblock', '去區塊');
    });

    // Open Convenience Store Cloud Print Modal (7-11 & FamilyMart)
    document.getElementById('btnOpenConvPrint')?.addEventListener('click', () => {
      this.convPrintModal.open();
      this.xiangAssistant?.say(XiaoxiangAssistant.LINES.convPrint, 5000);
    });

    // Open Imposition Gang-Run Sheet Modal (A4/A3)
    document.getElementById('btnOpenImposition')?.addEventListener('click', () => {
      void this.impositionModal.open();
      this.xiangAssistant?.say(XiaoxiangAssistant.LINES.imposition, 5000);
    });

    // Open Multi-Format Pre-Press Export Center Modal (PDF, TIFF, JPG, PNG, SVG, ZIP)
    document.getElementById('btnOpenExportModal')?.addEventListener('click', () => {
      this.exportModal.open();
    });

    // Quick Export 300 DPI TIFF
    document.getElementById('btnExportTiff')?.addEventListener('click', () => {
      void MultiFormatExporter.exportFormat('tiff', store.getState());
    });

    // Export Standard PDF (Client Engine with Double-Sided Support)
    this.btnExportPdf.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.processedDataUrl) {
        Toast.error('請先上傳並優化圖片');
        return;
      }

      const ds = this.doubleSidedManager.getState();

      try {
        SoundEffects.shutterClick();
        // 小抄要照實寫檔案內容（2026-09-24 起）。2026-09-25 起 PDF 可能是 CMYK（分色服務可用時）或 RGB，
        // 所以等 PDF 產生完、知道實際色彩模式之後才寫剪貼簿。
        const p = state.currentPreset;
        const copySpecSummary = async (colorNote: string): Promise<boolean> => {
          const text = `【送印規格小抄】${p.nameZh}（${p.widthMm}×${p.heightMm}mm）· ${p.targetDpi} DPI · ${p.bleedMm > 0 ? `出血 ${p.bleedMm}mm` : '無出血'} · ${colorNote}`;
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch {
            return false;
          }
        };

        // 雙面合版（2026-09-25）：與單面同一套版面與分色，第 1 頁正面、第 2 頁背面。正面一律用目前畫面上
        // 的成品（ds.frontDataUrl 不會跟著就地編輯/切換批次項目更新），它已含出血；背面範本或上傳圖只有
        // 成品尺寸，先用同一個鏡像外推補出血，否則會被拉伸進出血框。舊的雙面 PDF 是成品尺寸、沒有出血與角線。
        const isDoubleSided = ds.hasBack && !!ds.backDataUrl;
        let pages: string | string[] = state.processedDataUrl;
        if (isDoubleSided) {
          const back = ds.backImageData && p.bleedMm > 0
            ? BleedExpander.expandBleed(ds.backImageData, p, p.bleedMm).dataUrl
            : ds.backDataUrl!;
          pages = [state.processedDataUrl, back];
        }

        Toast.info(isDoubleSided
          ? '📄 正在產生 2 頁雙面合版 PDF（第 1 頁正面、第 2 頁背面）...'
          : '📄 正在產生印刷用 PDF（含裁切標記與色條）...');
        const result = await PdfExporter.export(
          pages,
          p,
          isDoubleSided ? `PrintMagic_DoubleSided_${p.id}_${Date.now()}.pdf` : undefined,
          state.cropAnchor
        );
        const isCmyk = result.colorMode === 'cmyk';
        const copied = await copySpecSummary(
          (isDoubleSided ? '雙面 2 頁 · ' : '') +
            (isCmyk ? `檔案為 CMYK PDF（已依 ${result.outputCondition} 分色，請直接輸出、勿再轉檔）` : '檔案為 RGB PDF，如需 CMYK 請協助轉檔')
        );
        Toast.success(`✓ ${isCmyk ? 'CMYK' : 'RGB'} ${isDoubleSided ? '雙面 2 頁' : '印刷'} PDF 已輸出！${copied ? '已自動複製「送印溝通小抄」至剪貼簿！' : ''}`);
        // 下載後不再彈出「送印通關護照」視窗（簡易模式要一路無腦到底）；由小象說明色彩模式，不擋畫面。
        this.xiangAssistant?.say(
          isCmyk ? XiaoxiangAssistant.exportPdfCmykLine(result.outputCondition!) : XiaoxiangAssistant.LINES.exportPdfRgb,
          8000
        );
      } catch (err: any) {
        Toast.error(`PDF 匯出失敗: ${err?.message || err}`);
      }
    });

    // Export High-Res PNG
    this.btnExportPng.addEventListener('click', () => {
      const state = store.getState();
      if (!state.processedDataUrl) {
        Toast.error('請先上傳圖片');
        return;
      }

      SoundEffects.shutterClick();
      const link = document.createElement('a');
      link.download = `PrintMagic_${state.currentPreset.id}_${Date.now()}.png`;
      link.href = state.processedDataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      Toast.success('✓ 300 DPI 高解析度 PNG 已下載！');
    });

    // Export SVG (local straight-line polygon tracer)
    this.btnExportSvg.addEventListener('click', () => {
      const state = store.getState();
      if (!state.processedImageData) {
        Toast.error('請先上傳圖片');
        return;
      }

      try {
        SoundEffects.shutterClick();
        Toast.info('🔄 正在本機描邊生成 SVG 向量輪廓（直線多邊形）...');
        const svg = VectorTracer.traceToSvg(state.processedImageData);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `PrintMagic_Vector_${state.currentPreset.id}_${Date.now()}.svg`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        Toast.success('✓ 向量 SVG 檔案已下載！');
      } catch (err: any) {
        Toast.error(`向量化失敗: ${err?.message || err}`);
      }
    });

    // Mode Switcher (Simple vs Advanced) with Apple Dynamic Spring Transition
    const triggerModeSwitch = (mode: 'simple' | 'advanced') => {
      SoundEffects.sliderTick();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([15, 30, 15]);
      }

      // Optical transition ripple flash
      const flash = document.createElement('div');
      flash.className = 'pm-mode-ripple-flash';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 420);

      store.setUiMode(mode);
      // 2026-09-26: switching to simple mode used to force the local engine as a side effect, so a
      // simple-mode PDF was CMYK on first load (cloud default) but RGB after visiting advanced mode.
      // The engine switch is its own control; UI mode no longer touches it.
      if (mode === 'simple') {
        Toast.info('⚡ 已切換為【簡易模式】：只顯示分數和下載按鈕');
      } else {
        Toast.info('🎛️ 已切換為【進階模式】：顯示處理開關與進階工具');
      }
    };

    this.btnModeSimple?.addEventListener('click', () => triggerModeSwitch('simple'));
    this.btnModeAdvanced?.addEventListener('click', () => triggerModeSwitch('advanced'));

    // Text Inspection Buttons
    document.getElementById('btnOpenTextInspectHeader')?.addEventListener('click', () => {
      void this.openTextInspectionModal();
    });
    document.getElementById('btnOpenTextInspect')?.addEventListener('click', () => {
      void this.openTextInspectionModal();
    });

    // Simple Mode Action Buttons
    document.getElementById('btnSimpleExportPdf')?.addEventListener('click', () => {
      this.btnExportPdf.click();
    });

    // 📤 Native Web Share API (iOS AirDrop / LINE / Messenger / Files)
    const handleShareArtwork = async () => {
      const state = store.getState();
      if (!state.processedDataUrl || !state.processedImageData) {
        Toast.error('請先上傳圖片');
        return;
      }
      Toast.info('⏳ 正在準備分享檔案...');
      try {
        const preset = state.currentPreset;
        const fileName = `PrintMagic_${preset.nameZh.replace(/\s+/g, '_')}_300DPI.png`;
        const file = await WebShareService.dataUrlToFile(state.processedDataUrl, fileName, 'image/png');
        const shared = await WebShareService.shareFile(file, `PrintMagic 印刷標準檔 (${preset.nameZh})`);
        if (!shared) {
          // If user cancels or share is unsupported, trigger standard PNG export
          this.btnExportPng.click();
        }
      } catch (err) {
        console.warn('Share error:', err);
        this.btnExportPng.click();
      }
    };

    document.getElementById('btnAdvancedShare')?.addEventListener('click', handleShareArtwork);

    // 🎛️ Bind Canvas Floating Quick HUD
    this.bindCanvasHud();

    // 📥 Bind Studio Drag-and-Drop Re-upload
    this.bindStudioDragAndDrop();
  }

  /**
   * 🎛️ Bind Canvas Floating HUD (Zoom In/Out/Reset, Compare, Reupload)
   */
  private bindCanvasHud(): void {
    document.getElementById('btnHudZoomIn')?.addEventListener('click', () => {
      this.canvasZoom.zoomIn();
    });

    document.getElementById('btnHudZoomOut')?.addEventListener('click', () => {
      this.canvasZoom.zoomOut();
    });

    document.getElementById('btnHudZoomReset')?.addEventListener('click', () => {
      this.canvasZoom.resetZoom();
      Toast.info('🔍 畫布已適配重設為最佳檢視尺寸');
    });

    document.getElementById('btnHudCompare')?.addEventListener('click', () => {
      this.btnToggleCompare.click();
    });

    document.getElementById('btnHudReupload')?.addEventListener('click', () => {
      this.dropZoneInstance.openFilePicker();
    });
  }

  /**
   * 📥 Direct Drag & Drop Re-upload on Stage Canvas in Studio Mode
   */
  private bindStudioDragAndDrop(): void {
    const stage = document.getElementById('stageContainer');
    if (!stage) return;

    stage.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.add('pm-stage-dragover');
    });

    stage.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.remove('pm-stage-dragover');
    });

    stage.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.remove('pm-stage-dragover');

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (files.length > 0) {
          Toast.info('📥 收到新圖片，正在重新計算印刷規格...');
          void this.dropZoneInstance.handleFiles(files);
        }
      }
    });
  }

  private subscribeState(): void {
    store.subscribe((state) => {
      const hasImage = !!state.originalDataUrl;

      // 0. Sync UI Mode attribute to body and toggle active classes
      document.body.setAttribute('data-ui-mode', state.uiMode);
      this.btnModeSimple?.classList.toggle('active', state.uiMode === 'simple');
      this.btnModeAdvanced?.classList.toggle('active', state.uiMode === 'advanced');

      // 1. Update Dual-Engine Switch Buttons (selected = light green, unselected = light gray)
      const btnEngineLocal = document.getElementById('btnEngineLocal');
      const btnEngineCloud = document.getElementById('btnEngineCloud');
      const engineCloudLabel = document.getElementById('engineCloudLabel');
      btnEngineLocal?.classList.toggle('active', state.engineMode === 'local');
      btnEngineCloud?.classList.toggle('active', state.engineMode === 'cloud');
      if (engineCloudLabel) {
        engineCloudLabel.textContent = state.engineMode === 'cloud'
          ? (state.cloudStatus === 'online' ? '雲端 (在線)' : '雲端 (離線)')
          : '雲端';
      }

      // 2. Switch View Containers
      this.dropZoneContainer.style.display = hasImage ? 'none' : 'block';
      this.studioWorkspace.style.display = hasImage ? 'grid' : 'none';
      this.btnNewArtwork.style.display = hasImage ? 'inline-flex' : 'none';
      this.presetSelectionBar.style.display = hasImage ? 'block' : 'none';

      // 3. Processing Overlay
      this.processingOverlay.style.display = state.isProcessing ? 'flex' : 'none';
      // Simple mode doesn't narrate each algorithm step — just that it's working.
      this.processingText.textContent =
        state.uiMode === 'simple' ? '正在自動優化…' : state.processingStep || '正在處理中...';

      // 4. Comparison Mode
      if (state.isComparing) {
        this.canvasSheet.style.display = 'none';
        this.compareSliderRoot.style.display = 'block';
        this.btnToggleCompare.classList.add('active');
        if (state.originalDataUrl && state.processedDataUrl) {
          this.compareSlider.setImages(
            state.originalDataUrl,
            state.processedDataUrl,
            state.originalScoreResult || undefined,
            state.scoreResult || undefined,
            state.originalDpiAnalysis || undefined,
            state.dpiAnalysis || undefined
          );
        }
      } else {
        this.canvasSheet.style.display = 'inline-block';
        this.compareSliderRoot.style.display = 'none';
        this.btnToggleCompare.classList.remove('active');
      }

      // 5. Update Main Preview Image
      // processedImageData 被換掉（切換批次項目等）→ 預覽快取一律作廢
      if (state.processedImageData !== this.lastPreviewSource) {
        this.lastPreviewSource = state.processedImageData;
        this.invalidatePreviewCaches();
      }
      if (!state.isComparing && state.processedDataUrl) {
        if (state.showSoftProof && this.softProofDataUrl) {
          this.mainPreviewImg.src = this.softProofDataUrl;
        } else if (state.cvdPreviewType && this.cvdPreviewDataUrl) {
          this.mainPreviewImg.src = this.cvdPreviewDataUrl;
        } else {
          this.mainPreviewImg.src = state.processedDataUrl;
        }
      } else if (!state.isComparing && state.originalDataUrl) {
        // 尚未處理的批次項目：至少顯示它自己的原圖，不要殘留上一張
        this.mainPreviewImg.src = state.originalDataUrl;
      }

      // 5b. Show the preview at the printed ratio (trim + bleed, in the image's orientation) and crop
      // it the way the PDF does — cover, positioned by the 焦點九宮格 anchor (crop-controller sets
      // object-position). It used to show the whole image while the PDF stretched it.
      const layoutW = state.processedWidth || state.originalImageData?.width || 0;
      const layoutH = state.processedHeight || state.originalImageData?.height || 0;
      const trim = layoutW && layoutH ? trimForImage(state.currentPreset, layoutW, layoutH) : null;
      if (trim && state.currentPreset.widthMm > 0) {
        this.mainPreviewImg.style.aspectRatio = `${trim.widthMm + trim.bleedMm * 2} / ${trim.heightMm + trim.bleedMm * 2}`;
        this.mainPreviewImg.style.objectFit = 'cover';
      } else {
        this.mainPreviewImg.style.aspectRatio = '';
        this.mainPreviewImg.style.objectFit = '';
      }

      // 6. Button Active States
      this.btnToggleSoftProof.classList.toggle('active', state.showSoftProof);
      this.btnToggleCvdPreview.classList.toggle('active', !!state.cvdPreviewType);
      this.btnToggleSafeZone.classList.toggle('active', state.showSafeZone);
      this.btnFlipBack.classList.toggle('active', this.paper3D.getIsFlipped());

      // 8. Trim line & safe area overlays. The preview box is trim + bleed (5b), so the trim line sits
      // one bleed width inside its edge and the safe area another safeMarginMm inside that. (Before
      // 2026-09-26 the "3mm 出血框" was drawn on the image's outer edge — no trim line at all — and
      // the safe area was measured from the bleed edge, not the trim.)
      if (state.showSafeZone && trim && state.currentPreset.widthMm > 0) {
        this.bleedFrame.style.display = 'block';
        this.safeFrame.style.display = 'block';

        const totalW = trim.widthMm + trim.bleedMm * 2;
        const totalH = trim.heightMm + trim.bleedMm * 2;
        const inset = (el: HTMLElement, mm: number) => {
          el.style.top = el.style.bottom = `${(mm / totalH) * 100}%`;
          el.style.left = el.style.right = `${(mm / totalW) * 100}%`;
        };
        inset(this.bleedFrame, trim.bleedMm);
        inset(this.safeFrame, trim.bleedMm + (state.currentPreset.safeMarginMm || 5));
        const badge = this.bleedFrame.querySelector('.pm-frame-badge');
        if (badge) badge.textContent = trim.bleedMm > 0 ? `裁切線（外側 ${trim.bleedMm}mm 為出血）` : '裁切線';
      } else {
        this.bleedFrame.style.display = 'none';
        this.safeFrame.style.display = 'none';
      }

      // 9. Update Loupe Image Data
      if (state.processedImageData) {
        this.loupe.setImageData(state.processedImageData);
      }

      // 10. Diagnostic Card & Floating Canvas Score Pill
      this.diagnosticCard.render(state);
      this.updateCanvasScorePill(state);
    });
  }

  private async handleImagesUploaded(results: LoadedImageResult[]): Promise<void> {
    SoundEffects.paperDrop();

    // 在【背面】分頁拖入單張圖片 → 設為背面，不動正面與批次
    if (results.length === 1 && this.doubleSidedManager.getState().activeSide === 'back' && store.getState().originalImageData) {
      const res = results[0];
      const c = document.createElement('canvas');
      c.width = res.img.naturalWidth;
      c.height = res.img.naturalHeight;
      const cctx = c.getContext('2d')!;
      cctx.drawImage(res.img, 0, 0);
      this.doubleSidedManager.setBackImage(res.dataUrl, cctx.getImageData(0, 0, c.width, c.height));
      this.mainPreviewImg.src = res.dataUrl;
      Toast.success('📇 已將此圖片設為【背面】設計');
      return;
    }

    // 新上傳：清掉上一批留下的背面，避免舊背面被帶進新 PDF
    this.doubleSidedManager.clearBackImage();
    document.getElementById('btnSideFront')?.classList.add('active');
    document.getElementById('btnSideBack')?.classList.remove('active');

    const batchItems: BatchItem[] = results.map((res) => {
      const canvas = document.createElement('canvas');
      canvas.width = res.img.naturalWidth;
      canvas.height = res.img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(res.img, 0, 0);
      const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return {
        id: `art-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: res.file.name.replace(/\.[^/.]+$/, ''),
        file: res.file,
        originalDataUrl: res.dataUrl,
        originalImageData,
        originalWidth: canvas.width,
        originalHeight: canvas.height,
        status: 'idle'
      };
    });

    store.addBatchItems(batchItems);

    const firstItem = batchItems[0];
    store.loadBatchItemIntoActive(firstItem);

    // Auto-detect optimal preset based on image aspect ratio and resolution
    const autoPreset = detectBestPreset(firstItem.originalWidth, firstItem.originalHeight);
    store.setPreset(autoPreset.id);
    this.paper3D.updatePreset(autoPreset);
    this.updatePresetButtonsUI(autoPreset.id, true);

    // Auto-match ICC Profile by preset material/category
    const iccSelect = document.getElementById('selectIccProfile') as HTMLSelectElement | null;
    const autoIcc: IccProfileId =
      autoPreset.category === 'art' || autoPreset.id === 'postcard' ? 'japan-color-2001-uncoated' : 'japan-color-2001-coated';
    if (iccSelect) iccSelect.value = autoIcc;
    // 程式設定 .value 不會觸發 change，必須同步引擎，否則 CMYK 分色仍用舊描述檔
    iccProfileEngine.setProfile(autoIcc);

    // Auto-configure Double-Sided pairing only when exactly 2 images are uploaded together
    // (3 張以上視為一般批次，不自動綁背面)
    if (batchItems.length === 2) {
      const backItem = batchItems[1];
      this.doubleSidedManager.setBackImage(backItem.originalDataUrl, backItem.originalImageData);
      Toast.info(`✨ 偵測到 2 張作品，已自動為您綁定為【正面 + 背面】雙面合版印刷！`);
    }

    // Auto-detect Scene & Image Category (Multi-Spectral + EXIF Sniffing)
    const fileBytes = firstItem.file ? await firstItem.file.arrayBuffer() : undefined;
    const scene = SceneClassifier.classifyImage(firstItem.originalImageData, fileBytes);
    const traitInfo = scene.detectedTraits.length > 0 ? ` (${scene.detectedTraits[0]})` : '';
    // 2026-08-28: this used to say "已...套用專屬處理流程（X）" (already applied pipeline X) — false for
    // most categories (see the honesty note in scene-classifier.ts: only the super-resolution step for
    // anime/portrait/landscape is actually invoked later in the pipeline; nothing else here is auto-run).
    // Preset matching IS real; the named pipeline is a suggestion, so the wording now says so honestly.
    // The preset comes from detectBestPreset (aspect ratio only); the scene class only picks the upscale path.
    this.xiangAssistant?.say(`🎯 看起來是【${scene.categoryIcon} ${scene.categoryNameZh}${traitInfo}】。依圖片比例先選了【${autoPreset.nameZh}】，不對的話上面可以換。`, 7500);
    Toast.success(`✨ 依圖片比例選了【${autoPreset.nameZh}】`);

    // Show/hide backside quick prompt based on preset and batch count
    const promptAddBack = document.getElementById('btnPromptAddBack');
    if (promptAddBack) {
      if ((autoPreset.id === 'business-card' || autoPreset.id === 'postcard') && batchItems.length === 1) {
        promptAddBack.style.display = 'flex';
      } else {
        promptAddBack.style.display = 'none';
      }
    }

    await this.pipeline.runOptimizationPipeline(firstItem.originalImageData);
  }

  public async openTextInspectionModal(): Promise<void> {
    const state = store.getState();
    const imgData = state.processedImageData || state.originalImageData;
    const dataUrl = state.processedDataUrl || state.originalDataUrl;

    if (!imgData || !dataUrl) {
      Toast.error('請先上傳圖片');
      return;
    }

    if (state.textInspectionResult) {
      this.textInspectionModal.open(state.textInspectionResult, dataUrl);
    } else {
      Toast.info('📝 正在進行 AI 智慧文字辨識與錯字檢查...');
      try {
        const result = await TextInspector.inspectImage(imgData);
        // 等待期間已換圖 → 不要把舊結果寫進新圖
        const cur = store.getState();
        if ((cur.processedImageData || cur.originalImageData) !== imgData) return;
        store.setTextInspectionResult(result);
        this.textInspectionModal.open(result, dataUrl);
      } catch (err: any) {
        Toast.error(`文字檢查失敗：${err?.message || '未知錯誤'}`);
      }
    }
  }

  /** Switch a manual edit for the active image, then re-run so the pipeline applies (or drops) it. */
  private async toggleSourceEdit(key: keyof SourceEdits, label: string): Promise<void> {
    const state = store.getState();
    if (!state.originalImageData) {
      Toast.error('請先上傳圖片');
      return;
    }
    const on = !state.sourceEdits[key];
    store.setSourceEdit(key, on);
    SoundEffects.laserScan();
    Toast.info(on ? `已加入【${label}】，正在重新處理…（再按一次可取消）` : `已取消【${label}】，正在重新處理…`);
    await this.pipeline.runOptimizationPipeline(state.originalImageData);
  }

  private imageDataToDataUrl(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  // ⚠️ 2026-08-29 修正：isAuto 原本只有 true/false 兩種狀態，但初次載入頁面、使用者
  // 還沒上傳任何圖片時，也會用 true 呼叫這個函式（見建構子），讓徽章顯示「✨ 自動偵測」——
  // 但這時候系統根本還沒分析過任何圖片，沒有東西可以「偵測」，這是誤導性的宣告。
  // isAuto=null 代表「還沒有真正的偵測或手動選擇結果，先不顯示徽章」；true 只在真的
  // 依照剛上傳圖片的尺寸跑完 detectBestPreset() 之後才傳入；false 代表使用者自己手動選了預設。
  private updatePresetButtonsUI(activeId: string, isAuto: boolean | null = false): void {
    // Re-query in case DOM elements were populated
    this.presetButtons = document.querySelectorAll<HTMLButtonElement>('.pm-preset-btn');
    this.presetButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === activeId);
    });

    const preset = getPresetById(activeId);
    const shortName = preset.nameZh.split(' ')[0] || preset.nameZh;
    const sizeText = preset.widthMm > 0 ? `${preset.widthMm}×${preset.heightMm}mm` : '1080px';

    // 1. Update Simple Mode Auto-Preset Pill
    const simpleIcon = document.getElementById('simplePresetIcon') as HTMLImageElement | null;
    const simpleName = document.getElementById('simplePresetName');
    const simpleAutoBadge = document.getElementById('simplePresetAutoBadge');
    if (simpleIcon) simpleIcon.src = `icons/shared/${PRESET_ICON_IDS[preset.id] || 'document-page'}.webp`;
    if (simpleName) simpleName.textContent = `${preset.nameZh} (${sizeText})`;
    if (simpleAutoBadge) {
      if (isAuto === null) {
        simpleAutoBadge.style.display = 'none';
      } else {
        simpleAutoBadge.style.display = '';
        simpleAutoBadge.innerHTML = isAuto
          ? '<img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 自動偵測'
          : '<img src="icons/shared/palette.webp" alt="" class="pm-icon-img" /> 已手動自訂';
      }
    }

    // 2. Update Advanced Mode Auto Badge
    if (this.presetAutoBadge) {
      if (isAuto === null) {
        this.presetAutoBadge.style.display = 'none';
      } else if (isAuto) {
        this.presetAutoBadge.style.display = 'inline-flex';
        this.presetAutoBadge.innerHTML = `<img src="icons/shared/sparkle.webp" alt="" class="pm-icon-img" /> 智慧適配：${shortName}`;
      } else {
        this.presetAutoBadge.style.display = 'inline-flex';
        this.presetAutoBadge.innerHTML = '<img src="icons/shared/palette.webp" alt="" class="pm-icon-img" /> 手動選擇';
      }
    }
  }

  private updateCanvasScorePill(state: AppState): void {
    const pill = document.getElementById('canvasScorePill');
    const text = document.getElementById('canvasScoreText');
    const verdict = document.getElementById('canvasScoreVerdict');

    if (!pill || !text || !verdict || !state.scoreResult || !state.processedDataUrl) {
      if (pill) pill.style.display = 'none';
      return;
    }

    pill.style.display = 'inline-flex';
    const score = state.scoreResult.score;
    text.textContent = `${score}分`;

    pill.classList.remove('pm-score-pill-high', 'pm-score-pill-mid', 'pm-score-pill-low');
    // Same wording as the score card's verdict — no "完美就緒" next to a list of open issues.
    const issueCount = state.scoreResult.issues.length;
    if (score >= 88) {
      pill.classList.add('pm-score-pill-high');
      verdict.innerHTML = issueCount > 0
        ? `<img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 良好 · ${issueCount} 項建議`
        : '<img src="icons/shared/check.webp" alt="" class="pm-icon-img" /> 品質良好';
    } else if (score >= 75) {
      pill.classList.add('pm-score-pill-mid');
      verdict.innerHTML = '<img src="icons/shared/info.webp" alt="" class="pm-icon-img" /> 尚可';
    } else {
      pill.classList.add('pm-score-pill-low');
      verdict.innerHTML = '<img src="icons/shared/warning.webp" alt="" class="pm-icon-img" /> 需確認';
    }
  }
}

// Clean up obsolete Service Workers and stale caches
function cleanupLegacyServiceWorkers(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        // 保留本 App 自己的 sw.js（initServiceWorker 會註冊它），只移除舊版/其他 worker
        const scriptURL = (registration.active ?? registration.waiting ?? registration.installing)?.scriptURL || '';
        if (scriptURL.endsWith('/sw.js')) continue;
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
}

// Bootstrap with readyState check to ensure execution regardless of module load timing
function bootstrapApp(): void {
  mountAppShell();
  cleanupLegacyServiceWorkers();
  new App();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
