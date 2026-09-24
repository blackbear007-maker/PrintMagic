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
import { NearbyShopsModal } from './ui/nearby-shops-modal';
import { DirectPrintModal } from './ui/direct-print-modal';
import { BatchBar } from './ui/batch-bar';
import { CropController } from './ui/crop-controller';
import { CloudClient } from './services/cloud-client';
import { Toast } from './ui/toast';
import { SoundEffects } from './core/sound-effects';
import { CmykEngine } from './core/cmyk-engine';
import { getPresetById, detectBestPreset } from './core/presets';
import { SampleArtworks } from './services/sample-artworks';
import { FoilSimulator, type FoilEffectType } from './core/foil-simulator';
import { DoubleSidedManager, type BackTemplateType } from './core/double-sided';
import { VectorOverlayEngine } from './core/vector-overlay';
import { iccProfileEngine, type IccProfileId } from './core/icc-profiles';
import { ConveniencePrintModal } from './ui/convenience-print-modal';
import { ImpositionModal } from './ui/imposition-modal';
import { DielineModal } from './ui/dieline-modal';
import { VectorOverlayModal } from './ui/vector-overlay-modal';
import { OnboardingModal } from './ui/onboarding-modal';
import { renderPipelineSwitchList, bindPipelineSwitchList } from './ui/pipeline-matrix-modal';
import { ExportModal } from './ui/export-modal';
import { MultiFormatExporter } from './engines/multi-format-exporter';
import { TextInspectionModal } from './ui/text-inspection-modal';
import { TextInspector } from './core/text-inspector';
import { ObjectEraserModal } from './ui/object-eraser-modal';
import { BleedExpander } from './core/bleed-expander';
import { FreeMattingClient } from './services/free-matting-client';
import { FreeFaceDetectClient, type DetectedFace } from './services/free-face-detect-client';
import { FaceSafetyChecker } from './core/face-safety-checker';
import { FreeIccClient } from './services/free-icc-client';
import { IdPhotoCropper } from './core/id-photo-cropper';
import { AiVectorizer } from './core/ai-vectorizer';
import { FreeVectorizeClient } from './services/free-vectorize-client';
import { PdfExporter } from './engines/pdf-exporter';
import { VectorTracer } from './engines/vector-tracer';
import { workerClient } from './workers/worker-client';
import { ColorBlindnessSimulator, type CvdType } from './core/color-blindness-simulator';
import { PassportModal } from './ui/passport-modal';
import { CanvasZoomController } from './ui/canvas-zoom';
import { WebShareService } from './services/web-share';
import { XiaoxiangAssistant } from './ui/xiaoxiang-assistant';
import { SceneClassifier } from './core/scene-classifier';
import { PipelineOrchestrator } from './core/pipeline-orchestrator';
import type { BatchItem, PaperType, PrintPresetId } from './types';

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
  public foilSimulator!: FoilSimulator;
  public doubleSidedManager = new DoubleSidedManager();
  public vectorOverlayEngine = new VectorOverlayEngine();
  public loupe!: LoupeController;
  public laserScan!: LaserScanController;
  public mockupModal!: MockupModal;
  public specModal!: SpecModal;
  public passportModal!: PassportModal;
  public shopsModal!: NearbyShopsModal;
  public directPrintModal!: DirectPrintModal;
  public convPrintModal!: ConveniencePrintModal;
  public impositionModal!: ImpositionModal;
  public dielineModal!: DielineModal;
  public vectorOverlayModal!: VectorOverlayModal;
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
  private btnToggleSound = document.getElementById('btnToggleSound');
  private soundIcon = document.getElementById('soundIcon');
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
  private btnToggleHeatmap = document.getElementById('btnToggleHeatmap')!;
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
  private paperButtons = document.querySelectorAll<HTMLButtonElement>('.pm-paper-btn[data-paper]');

  // Cache of view variations
  private heatmapDataUrl: string | null = null;
  private softProofDataUrl: string | null = null;
  private cvdPreviewDataUrl: string | null = null;
  private cvdPreviewCachedType: CvdType | null = null;
  private lastPreviewSource: ImageData | null = null;
  // 手動套用文字疊加時的底圖（疊加前）與產出，用來避免重複疊印
  private overlayBase: { base: ImageData; output: ImageData } | null = null;
  // 已補過出血的 processedImageData（避免重複外擴）
  private bleedAppliedTo: ImageData | null = null;

  // User-uploaded CMYK ICC profile (session-only, in-memory) — see free-icc-client.ts
  private uploadedIccProfile: { bytes: ArrayBuffer; name: string } | null = null;

  constructor() {
    this.initUIComponents();
    this.pipeline = new PipelineOrchestrator(
      this.laserScan,
      this.vectorOverlayEngine,
      this.doubleSidedManager,
      this.xiangAssistant,
      () => this.invalidatePreviewCaches()
    );
    this.bindEvents();
    this.subscribeState();
    this.updateSoundIcon();
    this.initServiceWorker();
    this.updatePresetButtonsUI(store.getState().currentPreset.id, null);

    // Check Cloud Backend status on startup (Advanced mode only)
    void CloudClient.checkHealth();
  }

  /** 任何直接改寫 processedImageData 的操作都要呼叫，避免熱力圖/軟打樣/色盲預覽顯示編輯前的舊圖。 */
  private invalidatePreviewCaches(): void {
    this.heatmapDataUrl = null;
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
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('./sw.js')
        .then(() => {
          const offlineEl = document.getElementById('offlineStatusText');
          if (offlineEl) offlineEl.textContent = '支援離線使用';
        })
        .catch((err) => {
          console.log('SW registration skipped or error:', err);
        });
    }

    // Monitor Online / Offline status
    window.addEventListener('offline', () => {
      const offlineEl = document.getElementById('offlineStatusText');
      if (offlineEl) offlineEl.textContent = '無網路 (離線極速運作中)';
      Toast.info('📱 目前處於離線狀態：本機放大與 PDF 輸出仍可使用，需要自建服務的功能會退回本機演算法');
    });

    window.addEventListener('online', () => {
      const offlineEl = document.getElementById('offlineStatusText');
      if (offlineEl) offlineEl.textContent = '在線';
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
        this.directPrintModal.open();
      },
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
    this.foilSimulator = new FoilSimulator('stageContainer', 'canvasSheet');

    // 7. 20x Halftone Loupe
    this.loupe = new LoupeController('stageContainer');

    // 8. Laser Scanline
    this.laserScan = new LaserScanController('stageContainer');

    // 9. Modals
    this.mockupModal = new MockupModal();
    this.specModal = new SpecModal();
    this.passportModal = new PassportModal();
    this.shopsModal = new NearbyShopsModal();
    this.directPrintModal = new DirectPrintModal(() => this.shopsModal.open());
    this.convPrintModal = new ConveniencePrintModal();
    this.impositionModal = new ImpositionModal();
    this.dielineModal = new DielineModal();
    this.vectorOverlayModal = new VectorOverlayModal(this.vectorOverlayEngine, () => {
      this.markManualEnhancementApplied('textOverlay');
      void this.renderVectorOverlayOnCanvas();
    });
    this.textInspectionModal = new TextInspectionModal(
      (suggestedText) => {
        this.vectorOverlayModal.open(suggestedText);
      },
      () => {
        this.vectorOverlayModal.autoDetectFromCurrentState(true);
      }
    );
    this.objectEraserModal = new ObjectEraserModal((newImageData, newDataUrl) => {
      // Replace original with the erased image and re-run optimization pipeline
      store.setState({
        originalImageData: newImageData,
        originalDataUrl: newDataUrl
      });
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
      const isOnline = await CloudClient.checkHealth();
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

    // Sound Toggle
    this.btnToggleSound?.addEventListener('click', () => {
      const isMuted = SoundEffects.toggleMute();
      this.updateSoundIcon();
      Toast.info(isMuted ? '🔇 觸覺音效已靜音' : '🔊 觸覺音效已開啟');
    });

    // Reset / New Artwork
    this.btnNewArtwork.addEventListener('click', () => {
      store.reset();
      this.invalidatePreviewCaches();
      // 雙面背面與文字疊加屬於上一張作品，不能帶進下一張
      this.doubleSidedManager.clearBackImage();
      this.vectorOverlayEngine.clear();
      this.loupe.setImageData(null);
      this.loupe.setEnabled(false);
      Toast.info('已重置畫布，請拖入新圖片');
    });

    // FTUX Sample Artwork Pills (1-Click Test for New Users)
    document.querySelectorAll('.pm-sample-pill-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const el = btn as HTMLElement;
        const sampleType = el.dataset.sample as 'anime' | 'cyberpunk' | 'card';
        const presetId = el.dataset.preset as PrintPresetId | undefined;
        if (!sampleType) return;

        if (presetId) {
          store.setPreset(presetId);
        }

        SoundEffects.paperDrop();
        Toast.info('✨ 正在載入示範作品並啟動印刷分析...');
        try {
          const file = await SampleArtworks.loadSample(sampleType);
          await this.dropZoneInstance.handleFiles([file]);
        } catch (err: any) {
          Toast.error(`示範作品載入失敗: ${err?.message || err}`);
        }
      });
    });

    // FTUX Coachmark Banner Dismiss
    document.getElementById('btnDismissCoachmark')?.addEventListener('click', () => {
      const coachmark = document.getElementById('coachmarkBanner');
      if (coachmark) {
        coachmark.style.display = 'none';
      }
      localStorage.setItem('pm_coachmark_dismissed', '1');
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
            await this.pipeline.runOptimizationPipeline(state.originalImageData);

            // 🪪 2 吋證件照：自動用 YuNet 抓臉置中裁切成 35×45mm 比例（真實像素裁切，
            // 不是只改 CSS 預覽的九宮格錨點——輸出的 PDF 才會真的反映這個裁切）
            if (presetId === 'id-photo' && store.getState().currentPreset.id === 'id-photo') {
              await this.applyIdPhotoCrop();
            }
          }
        }
      });
    });

    // Paper Material Selection
    this.paperButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const paper = btn.dataset.paper as PaperType;
        if (paper) {
          store.setPaper(paper);
          this.updatePaperButtonsUI(paper);
          const stage = document.getElementById('stageContainer');
          if (stage) {
            stage.classList.remove('pm-paper-glossy', 'pm-paper-matte', 'pm-paper-linen', 'pm-paper-cotton');
            stage.classList.add(`pm-paper-${paper}`);
          }
          SoundEffects.sliderTick();
          Toast.info(`已切換實體紙材模擬：${btn.textContent}`);
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
        Toast.info('🔍 20x 網點顯微放大鏡已啟動');
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

    // Toggle TAC Heatmap
    this.btnToggleHeatmap.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.processedImageData) return;

      SoundEffects.sliderTick();

      if (!state.showHeatmap) {
        if (!this.heatmapDataUrl) {
          const src = state.processedImageData;
          // Use the same active-ICC-profile TAC limit the actual ink-clamping step applies
          // (see Step 3's honesty note), so the heatmap's warning threshold matches reality.
          let heatmap: ImageData;
          try {
            heatmap = await workerClient.generateHeatmap(src, iccProfileEngine.getActiveProfile().maxTac);
          } catch (err: any) {
            Toast.error(`熱力圖產生失敗：${err?.message || '未知錯誤'}`);
            return;
          }
          // 等待期間圖片已被換掉 → 丟棄過期結果
          if (store.getState().processedImageData !== src) return;
          this.heatmapDataUrl = this.imageDataToDataUrl(heatmap);
        }
      }
      store.toggleHeatmap();
      const updatedState = store.getState();
      if (updatedState.showHeatmap) {
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.heatmapOn, 5000);
      } else {
        this.xiangAssistant?.say(XiaoxiangAssistant.LINES.heatmapOff, 3000);
      }
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

    // 3D Luxury Foil & Spot UV Craft Selection
    document.querySelectorAll('.pm-foil-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const foilType = (btn as HTMLElement).dataset.foil as FoilEffectType;
        if (foilType) {
          this.foilSimulator.setFoil(foilType);
          document.querySelectorAll('.pm-foil-btn').forEach((b) => {
            b.classList.toggle('active', (b as HTMLElement).dataset.foil === foilType);
          });
          SoundEffects.sliderTick();
          if (foilType === 'gold') this.xiangAssistant?.say(XiaoxiangAssistant.LINES.foilGold, 5000);
          else if (foilType === 'rose-gold') this.xiangAssistant?.say(XiaoxiangAssistant.LINES.foilRoseGold, 5000);
          else if (foilType === 'silver') this.xiangAssistant?.say(XiaoxiangAssistant.LINES.foilSilver, 5000);
          else if (foilType === 'spot-uv') this.xiangAssistant?.say(XiaoxiangAssistant.LINES.foilSpotUv, 5000);
          else if (foilType === 'holographic') this.xiangAssistant?.say(XiaoxiangAssistant.LINES.foilHolo, 5000);
        }
      });
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
        // Auto generate default back template if none exists.
        // 2026-08-29 修正：這裡原本不管目前選的是哪個規格，一律寫死套用明信片公版——名片規格的使用者
        // 切到背面分頁時，會拿到尺寸正確但版型錯誤的明信片背面（郵遞區號框、寄件框等），而不是名片
        // 背面該有的公司/聯絡資訊版型。已改成跟「載入公版」按鈕（下面 btnLoadBackTemplate）同一套依
        // 目前選取規格判斷版型的邏輯，兩個入口現在保持一致。
        const state = store.getState();
        const tmplType: BackTemplateType =
          state.currentPreset.id === 'business-card' ? 'business_card_minimal' : 'postcard_standard';
        const tmpl = DoubleSidedManager.generateBackTemplate(tmplType, state.currentPreset);
        this.doubleSidedManager.setBackImage(tmpl.dataUrl, tmpl.imageData);
        Toast.success(
          tmplType === 'business_card_minimal'
            ? '✨ 已為您自動載入標準名片背面公版！'
            : '✨ 已為您自動載入標準明信片背面公版！'
        );
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
      const tmplType: BackTemplateType =
        state.currentPreset.id === 'business-card' ? 'business_card_minimal' : 'postcard_standard';
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
      document.getElementById('btnSideBack')?.click();
      this.xiangAssistant?.say('切換至【背面】。在背面分頁拖入單張圖片即會設為背面，或點【載入公版】直接使用設計好的背面！', 5000);
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
        // Invalidate any cached TAC heatmap — it was rendered against the previous profile's
        // maxTac and would show a stale warning threshold otherwise.
        this.heatmapDataUrl = null;
        SoundEffects.sliderTick();
        Toast.info(`🎨 已切換印刷色彩描述檔：【${active.name}】(TAC ≤${active.maxTac}%)`);
      }
    });

    // 🖼️ AI 智慧 3mm 出血外擴延伸
    document.getElementById('btnAiBleedOutpaint')?.addEventListener('click', () => {
      const state = store.getState();
      const imgData = state.processedImageData || state.originalImageData;
      if (!imgData) {
        Toast.error('請先上傳圖片');
        return;
      }

      const bleedMm = state.currentPreset.bleedMm;
      if (!(bleedMm > 0)) {
        Toast.info('此尺寸不需要出血，無需外擴');
        return;
      }
      if (state.pipelineOptions.enableBleedExpand) {
        Toast.info(`已在自動處理流程中補齊 ${bleedMm}mm 出血，無需再次外擴（可在「專家管線自訂」關閉自動出血後手動套用）`);
        return;
      }
      if (this.bleedAppliedTo && this.bleedAppliedTo === state.processedImageData) {
        Toast.info(`已補過 ${bleedMm}mm 出血，不再重複外擴`);
        return;
      }

      SoundEffects.laserScan();
      Toast.info(`🖼️ 正在以鏡像外推＋接縫融合補齊 ${bleedMm}mm 邊界出血區...`);

      const result = BleedExpander.expandBleed(imgData, state.currentPreset, bleedMm);
      this.invalidatePreviewCaches();
      store.setState({
        processedImageData: result.imageData,
        processedDataUrl: result.dataUrl,
        processedWidth: result.width,
        processedHeight: result.height
      });
      this.bleedAppliedTo = result.imageData;
      this.mainPreviewImg.src = result.dataUrl;
      SoundEffects.purityChime();
      Toast.success(`✓ ${bleedMm}mm 出血已補齊（鏡像外推，非生成式 AI）`);
    });

    // ✂️ 髮絲級 AI 模切貼紙去背（自建 rembg/u2netp 優先，離線時自動退回本機顏色距離去背）
    document.getElementById('btnAiRemoveBg')?.addEventListener('click', async () => {
      const state = store.getState();
      const imgData = state.processedImageData || state.originalImageData;
      if (!imgData) {
        Toast.error('請先上傳圖片');
        return;
      }

      SoundEffects.laserScan();
      Toast.info('✂️ 正在進行去背處理...');

      const result = await FreeMattingClient.removeBackground(imgData);
      const cur = store.getState();
      if ((cur.processedImageData || cur.originalImageData) !== imgData) return;
      this.invalidatePreviewCaches();
      store.setState({
        processedImageData: result.imageData,
        processedDataUrl: result.dataUrl
      });
      this.mainPreviewImg.src = result.dataUrl;
      SoundEffects.purityChime();
      Toast.success(
        result.isCloud
          ? '✓ 髮絲級去背完成！可直接點擊【🏷️ 造型刀模 & 白墨】一鍵生成透明貼紙製版檔！'
          : '✓ 去背完成（本機演算法，背景須為單一色塊效果較佳）'
      );
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

    // Open Text Clarity & Vector Overlay Modal (Simple & Advanced Modes)
    const openVectorOverlayModal = () => {
      this.vectorOverlayModal.open();
      this.xiangAssistant?.say('開啟【文字防糊清晰化】。AI 自動幫你把小字轉為純黑銳利字，印刷保證字字清晰見骨！', 5000);
    };

    document.getElementById('btnOpenVectorOverlay')?.addEventListener('click', openVectorOverlayModal);
    document.getElementById('btnOpenVectorOverlayTop')?.addEventListener('click', openVectorOverlayModal);
    document.getElementById('btnSimpleVectorOverlay')?.addEventListener('click', openVectorOverlayModal);

    // 🌀 去網紋摩爾紋（本機 FFT 陷波濾波，非 AI，見 src/core/moire-descreen.ts）
    document.getElementById('btnDescreen')?.addEventListener('click', async () => {
      const state = store.getState();
      const imgData = state.processedImageData || state.originalImageData;
      if (!imgData) {
        Toast.error('請先上傳圖片');
        return;
      }

      SoundEffects.laserScan();
      Toast.info('🌀 正在執行去網紋運算（FFT 頻域濾波，大圖可能需要數秒）...');

      try {
        const result = await workerClient.descreen(imgData);
        // 等待期間已換圖 → 丟棄過期結果
        const cur = store.getState();
        if ((cur.processedImageData || cur.originalImageData) !== imgData) return;
        const resultUrl = this.imageDataToDataUrl(result);
        this.invalidatePreviewCaches();
        store.setState({
          processedImageData: result,
          processedDataUrl: resultUrl
        });
        this.mainPreviewImg.src = resultUrl;
        this.markManualEnhancementApplied('descreen');
        SoundEffects.purityChime();
        Toast.success('✓ 去網紋完成（本機 FFT 陷波濾波）。若原圖沒有明顯網紋/摩爾紋，效果可能不明顯。');
      } catch (err: any) {
        Toast.error(`去網紋失敗：${err?.message || '未知錯誤'}`);
      }
    });

    // 🧩 JPEG 去區塊（偵測 8x8 壓縮網格邊界痕跡並局部平滑，見 src/core/jpeg-deblocking-filter.ts）
    document.getElementById('btnJpegDeblock')?.addEventListener('click', async () => {
      const state = store.getState();
      const imgData = state.processedImageData || state.originalImageData;
      if (!imgData) {
        Toast.error('請先上傳圖片');
        return;
      }

      SoundEffects.laserScan();
      Toast.info('🧩 正在偵測並修復 JPEG 壓縮區塊痕跡...');

      try {
        const result = await workerClient.deblock(imgData);
        // 等待期間已換圖 → 丟棄過期結果
        const cur = store.getState();
        if ((cur.processedImageData || cur.originalImageData) !== imgData) return;
        const resultUrl = this.imageDataToDataUrl(result);
        this.invalidatePreviewCaches();
        store.setState({
          processedImageData: result,
          processedDataUrl: resultUrl
        });
        this.mainPreviewImg.src = resultUrl;
        this.markManualEnhancementApplied('jpegDeblock');
        SoundEffects.purityChime();
        Toast.success('✓ 去區塊完成。若原圖沒有明顯 JPEG 壓縮網格痕跡，效果可能不明顯。');
      } catch (err: any) {
        Toast.error(`去區塊失敗：${err?.message || '未知錯誤'}`);
      }
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
        const specSummary = `【送印規格小抄】尺寸：${state.currentPreset.nameZh} (${state.currentPreset.widthMm}×${state.currentPreset.heightMm}mm) · 解析度：${state.currentPreset.targetDpi} DPI · 色彩：CMYK · 出血：${state.currentPreset.bleedMm}mm · 純黑向量銳化 · 零退件認證`;
        if (navigator.clipboard) {
          void navigator.clipboard.writeText(specSummary).catch(() => {});
        }

        if (ds.hasBack && ds.backDataUrl) {
          Toast.info('📄 正在生成 2 頁標準【雙面合版 PDF】(Page 1 正面 + Page 2 背面)...');
          const pdfBlob = await DoubleSidedManager.exportDoubleSidedPdf(
            // 一律以目前畫面上的成品為正面（ds.frontDataUrl 不會跟著就地編輯/切換批次項目更新）
            state.processedDataUrl,
            ds.backDataUrl,
            state.currentPreset
          );
          const url = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.download = `PrintMagic_DoubleSided_${state.currentPreset.id}_${Date.now()}.pdf`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          Toast.success('✓ 標準雙面 2-Page PDF 已成功輸出！已自動複製「送印溝通小抄」至剪貼簿！');
        } else {
          Toast.info('📄 正在產生印刷用 PDF（含裁切標記與色條）...');
          await PdfExporter.export(state.processedDataUrl, state.currentPreset, undefined, state.cropAnchor);
          Toast.success('✓ 標準印刷 PDF 已成功輸出！已自動複製「送印溝通小抄」至剪貼簿！');
        }

        // In Simple Mode, pop up the Print-Ready Passport to reassure beginners
        if (state.uiMode === 'simple') {
          setTimeout(() => {
            this.passportModal.open();
          }, 450);
        }
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
      if (mode === 'simple') {
        store.setEngineMode('local');
        Toast.info('⚡ 已切換為【簡易模式】：極簡純粹、手機專用、極速輸出！');
      } else {
        Toast.info('🎛️ 已切換為【進階模式】：展開全部專業製版、工藝與管線工具！');
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
    document.getElementById('btnSimpleTextInspect')?.addEventListener('click', () => {
      void this.openTextInspectionModal();
    });

    // Simple Mode Action Buttons
    document.getElementById('btnSimpleExportPdf')?.addEventListener('click', () => {
      this.btnExportPdf.click();
    });

    // 📷 Camera Direct Capture (Document Scanner)
    const cameraInput = document.getElementById('cameraInput') as HTMLInputElement | null;
    // cameraInput 位於 #dropZone 內；程式化 click 會冒泡到 DropZone 並額外開啟一般相簿選擇器
    cameraInput?.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('btnPickCamera')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cameraInput) {
        cameraInput.value = '';
        cameraInput.click();
      }
    });
    cameraInput?.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        SoundEffects.shutterClick();
        Toast.info('📷 正在以 300 DPI 增強處理相機拍攝之作品...');
        void this.dropZoneInstance.handleFiles(Array.from(target.files));
      }
    });

    // 📋 Clipboard Paste Button
    document.getElementById('btnPasteClipboard')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (navigator.clipboard && navigator.clipboard.read) {
          const clipboardItems = await navigator.clipboard.read();
          const files: File[] = [];
          for (const item of clipboardItems) {
            const imageType = item.types.find((t) => t.startsWith('image/'));
            if (imageType) {
              const blob = await item.getType(imageType);
              files.push(new File([blob], `pasted-${Date.now()}.png`, { type: imageType }));
            }
          }
          if (files.length > 0) {
            Toast.success('✓ 已從剪貼簿載入圖片！');
            void this.dropZoneInstance.handleFiles(files);
            return;
          }
        }
        Toast.info('💡 直接把圖片拖進畫面，或用手機相機掃描匯入');
      } catch {
        Toast.info('💡 直接把圖片拖進畫面，或用手機相機掃描匯入');
      }
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

  private updateSoundIcon(): void {
    const isMuted = SoundEffects.getIsMuted();
    if (this.soundIcon) {
      this.soundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
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
            state.dpiAnalysis || undefined,
            state.originalInkAnalysis || undefined,
            state.inkAnalysis || undefined
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
        if (state.showHeatmap && this.heatmapDataUrl) {
          this.mainPreviewImg.src = this.heatmapDataUrl;
        } else if (state.showSoftProof && this.softProofDataUrl) {
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

      // 6. Button Active States
      this.btnToggleHeatmap.classList.toggle('active', state.showHeatmap);
      this.btnToggleSoftProof.classList.toggle('active', state.showSoftProof);
      this.btnToggleCvdPreview.classList.toggle('active', !!state.cvdPreviewType);
      this.btnToggleSafeZone.classList.toggle('active', state.showSafeZone);
      this.btnFlipBack.classList.toggle('active', this.paper3D.getIsFlipped());

      // 8. Bleed & Safe Frame Overlays
      if (state.showSafeZone && state.currentPreset.widthMm > 0) {
        this.bleedFrame.style.display = 'block';
        this.safeFrame.style.display = 'block';

        const safeMargin = state.currentPreset.safeMarginMm || 5;
        const totalW = state.currentPreset.widthMm + state.currentPreset.bleedMm * 2;
        const totalH = state.currentPreset.heightMm + state.currentPreset.bleedMm * 2;
        const padXPercent = (safeMargin / totalW) * 100;
        const padYPercent = (safeMargin / totalH) * 100;

        this.safeFrame.style.top = `${padYPercent}%`;
        this.safeFrame.style.left = `${padXPercent}%`;
        this.safeFrame.style.right = `${padXPercent}%`;
        this.safeFrame.style.bottom = `${padYPercent}%`;
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
    // 程式設定 .value 不會觸發 change，必須同步引擎，否則 TAC 限制仍用舊描述檔
    iccProfileEngine.setProfile(autoIcc);
    this.heatmapDataUrl = null;

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
    this.xiangAssistant?.say(`🎯 偵測到為【${scene.categoryIcon} ${scene.categoryNameZh}${traitInfo}】！已為您自動匹配【${autoPreset.nameZh}】，建議搭配處理流程（${scene.recommendedPipeline.superResolutionModel}）！`, 7500);
    Toast.success(`✨ 智慧辨識：【${scene.categoryIcon} ${scene.categoryNameZh}】· 已自動匹配專屬預設！`);

    // Show/hide backside quick prompt based on preset and batch count
    const promptAddBack = document.getElementById('btnPromptAddBack');
    if (promptAddBack) {
      if ((autoPreset.id === 'business-card' || autoPreset.id === 'postcard') && batchItems.length === 1) {
        promptAddBack.style.display = 'flex';
      } else {
        promptAddBack.style.display = 'none';
      }
    }

    // Show First-Time Coachmark Banner if not previously dismissed
    const isDismissed = localStorage.getItem('pm_coachmark_dismissed');
    const coachmark = document.getElementById('coachmarkBanner');
    if (coachmark && !isDismissed) {
      coachmark.style.display = 'flex';
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

  private async renderVectorOverlayOnCanvas(): Promise<void> {
    const state = store.getState();
    // 管線 Step 3.5 會套用目前的文字/Logo 疊加：從原圖重跑，確保只蓋「目前這一份」，
    // 刪除或修改過的舊文字不會殘留、也不會重複疊印。
    if (state.originalImageData && state.pipelineOptions.enableVectorOverlay) {
      const presetId = state.currentPreset.id;
      await this.pipeline.runOptimizationPipeline(state.originalImageData);
      if (presetId === 'id-photo' && store.getState().currentPreset.id === 'id-photo') {
        await this.applyIdPhotoCrop();
      }
      return;
    }

    // 管線未啟用疊加：畫在「疊加前」的底圖上，而不是已蓋過舊文字的成品上
    const current = state.processedImageData || state.originalImageData;
    if (!current) return;
    const baseImgData =
      this.overlayBase && this.overlayBase.output === current ? this.overlayBase.base : current;

    const canvas = document.createElement('canvas');
    canvas.width = baseImgData.width;
    canvas.height = baseImgData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(baseImgData, 0, 0);

    // Draw Vector Overlay Elements
    await this.vectorOverlayEngine.renderOverlay(ctx, canvas.width, canvas.height);

    const updatedDataUrl = canvas.toDataURL('image/png');
    const updatedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    this.overlayBase = { base: baseImgData, output: updatedImageData };
    this.invalidatePreviewCaches();
    store.setState({
      processedDataUrl: updatedDataUrl,
      processedImageData: updatedImageData
    });

    if (this.doubleSidedManager.getState().activeSide === 'front') {
      this.doubleSidedManager.setFrontImage(updatedDataUrl, updatedImageData);
      this.mainPreviewImg.src = updatedDataUrl;
    }
  }

  /**
   * 🪪 2 吋證件照自動裁切：優先用自建 YuNet 抓臉位置，估算置中裁切（見
   * src/core/id-photo-cropper.ts 的誠實附註——這是估算起點，不是官方合規保證，使用者仍須
   * 自行對照官方範例圖）。YuNet 離線或沒偵測到臉時，退回單純置中裁切（一樣是真實像素裁切，
   * 不是拉伸變形）。有偵測到臉時，會先用雙眼連線角度自動水平校正（頭歪一點也能拉正），裁切完
   * 再對成品四角取樣做背景合規啟發式檢查（不是官方驗證，只是抓明顯的偏色/不均勻/太暗）。
   */
  private async applyIdPhotoCrop(): Promise<void> {
    const state = store.getState();
    const imgData = state.processedImageData || state.originalImageData;
    if (!imgData) return;

    Toast.info('🪪 正在偵測人臉並自動置中裁切為證件照比例...');
    try {
      const faceResult = await FreeFaceDetectClient.detect(imgData);
      let crop: { x: number; y: number; width: number; height: number } | undefined;
      let sourceForCrop = imgData;
      let leveledFace: DetectedFace | undefined;
      let message: string;

      if (faceResult.available && faceResult.faces.length > 0) {
        let bestFace = faceResult.faces.reduce((a, b) => (a.confidence >= b.confidence ? a : b));

        const leveled = IdPhotoCropper.levelFace(imgData, bestFace);
        sourceForCrop = leveled.imageData;
        bestFace = leveled.face;
        leveledFace = bestFace;

        const suggestion = IdPhotoCropper.computeCrop(bestFace, sourceForCrop.width, sourceForCrop.height);
        if (suggestion) {
          crop = suggestion.crop;
          const rotateNote = leveled.angleDegrees !== 0
            ? `已自動水平校正 ${Math.abs(leveled.angleDegrees).toFixed(1)}°。`
            : '';
          message = `✓ 已用 YuNet 自動抓臉置中裁切（估算頭部佔比 ${suggestion.estimatedHeadRatioPercent}%）。${rotateNote}${suggestion.note}`;
        }
      }

      if (!crop) {
        sourceForCrop = imgData;
        crop = IdPhotoCropper.computeCenterCrop(imgData.width, imgData.height);
        message = '⚠️ 未偵測到人臉，已改用置中裁切（35×45mm 比例）。建議用九宮格「✨ AI 建議」再微調焦點，送印前務必對照官方範例圖確認。';
      }

      const cropped = IdPhotoCropper.applyCrop(sourceForCrop, crop);
      const dataUrl = this.imageDataToDataUrl(cropped);

      // 偵測期間已換圖或換規格 → 丟棄
      const cur = store.getState();
      if ((cur.processedImageData || cur.originalImageData) !== imgData || cur.currentPreset.id !== 'id-photo') return;
      this.invalidatePreviewCaches();
      store.setState({ processedImageData: cropped, processedDataUrl: dataUrl });
      this.mainPreviewImg.src = dataUrl;
      Toast.success(message!);
      // 📇 Batch-print discoverability hint: the existing A4/A3 imposition modal (btnOpenImposition)
      // already handles this correctly today — it reads the active preset's real widthMm/heightMm
      // (35×45mm here) and repeat-tiles it with real crop marks, so no new engine work was needed,
      // just pointing users at it (verified: 28 copies fit on A4, 56 on A3 — see
      // imposition-engine.test.ts).
      this.xiangAssistant?.say(XiaoxiangAssistant.LINES.idPhotoBatchHint, 6000);

      const bgCheck = IdPhotoCropper.checkBackgroundCompliance(cropped);
      if (!bgCheck.compliant && bgCheck.warning) {
        Toast.info(bgCheck.warning);
      }

      // ⚠️ Sanity check: computeCrop() aims to keep the head well clear of the frame edges, but a
      // face very near the source image's own border can still force the crop to clamp tighter
      // than intended (see face-safety-checker.ts). Reuses the same leveled face box computed
      // above rather than re-running levelFace() a second time.
      if (leveledFace && crop) {
        const preset = state.currentPreset;
        // 以裁切後影像的實際像素密度換算（裁切結果對應整張 preset.widthMm），而非假設已達目標 DPI
        const pxPerMm = preset.widthMm > 0 ? cropped.width / preset.widthMm : preset.targetDpi / 25.4;
        const safeMarginPx = (preset.safeMarginMm || 5) * pxPerMm;
        const faceInCropSpace: DetectedFace = {
          box: {
            x: leveledFace.box.x - crop.x,
            y: leveledFace.box.y - crop.y,
            width: leveledFace.box.width,
            height: leveledFace.box.height
          },
          landmarks: leveledFace.landmarks,
          confidence: leveledFace.confidence
        };
        const marginCheck = FaceSafetyChecker.checkFaceMargin(faceInCropSpace, cropped.width, cropped.height, safeMarginPx);
        if (marginCheck.atRisk && marginCheck.warning) {
          Toast.info(marginCheck.warning);
        }
      }
    } catch (err: any) {
      Toast.error(`證件照自動裁切失敗：${err?.message || '未知錯誤'}`);
    }
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

  private updatePaperButtonsUI(activePaper: string): void {
    this.paperButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.paper === activePaper);
    });
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
