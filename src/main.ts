import './styles/index.css';
import './styles/studio.css';
import './styles/components.css';

import { store } from './ui/state';
import { DropZone, type LoadedImageResult } from './ui/dropzone';
import { DiagnosticCard } from './ui/diagnostic-card';
import { CompareSlider } from './ui/compare-slider';
import { PaperSimulator } from './ui/paper-simulator';
import { Paper3DController } from './ui/paper-3d';
import { LoupeController } from './ui/loupe';
import { LaserScanController } from './ui/laser-scan';
import { MockupModal } from './ui/mockup-modal';
import { SpecModal } from './ui/spec-modal';
import { RulerCalibrationModal } from './ui/ruler-calibration';
import { NearbyShopsModal } from './ui/nearby-shops-modal';
import { DirectPrintModal } from './ui/direct-print-modal';
import { BatchBar } from './ui/batch-bar';
import { CropController } from './ui/crop-controller';
import { CloudClient } from './services/cloud-client';
import { Toast } from './ui/toast';
import { SoundEffects } from './core/sound-effects';
import { DpiCalculator } from './core/dpi-calculator';
import { PrintScoreCalculator } from './core/print-score';
import { CmykEngine } from './core/cmyk-engine';
import { getPresetById, detectBestPreset } from './core/presets';
import { SampleArtworks } from './services/sample-artworks';
import { FoilSimulator, type FoilEffectType } from './core/foil-simulator';
import { DoubleSidedManager, type BackTemplateType } from './core/double-sided';
import { VectorOverlayEngine } from './core/vector-overlay';
import { iccProfileEngine, type IccProfileId } from './core/icc-profiles';
import { AiUpscaleClient } from './services/ai-upscale-client';
import { ConveniencePrintModal } from './ui/convenience-print-modal';
import { ImpositionModal } from './ui/imposition-modal';
import { DielineModal } from './ui/dieline-modal';
import { VectorOverlayModal } from './ui/vector-overlay-modal';
import { PdfExporter } from './engines/pdf-exporter';
import { VectorTracer } from './engines/vector-tracer';
import { workerClient } from './workers/worker-client';
import type { BatchItem, PaperType, PrintPresetId } from './types';

/**
 * PrintMagic Studio 3.1 Pro Dual-Engine Main Controller
 */
class App {
  public diagnosticCard!: DiagnosticCard;
  public compareSlider!: CompareSlider;
  public paperSimulator!: PaperSimulator;
  public paper3D!: Paper3DController;
  public foilSimulator!: FoilSimulator;
  public doubleSidedManager = new DoubleSidedManager();
  public vectorOverlayEngine = new VectorOverlayEngine();
  public loupe!: LoupeController;
  public laserScan!: LaserScanController;
  public mockupModal!: MockupModal;
  public specModal!: SpecModal;
  public calibrationModal!: RulerCalibrationModal;
  public shopsModal!: NearbyShopsModal;
  public directPrintModal!: DirectPrintModal;
  public convPrintModal!: ConveniencePrintModal;
  public impositionModal!: ImpositionModal;
  public dielineModal!: DielineModal;
  public vectorOverlayModal!: VectorOverlayModal;
  public batchBar!: BatchBar;
  public cropController!: CropController;

  // DOM references
  private dropZoneContainer = document.getElementById('dropZoneContainer')!;
  private studioWorkspace = document.getElementById('studioWorkspace')!;
  private btnNewArtwork = document.getElementById('btnNewArtwork')!;
  private btnToggleSound = document.getElementById('btnToggleSound')!;
  private soundIcon = document.getElementById('soundIcon')!;
  private btnToggleEngine = document.getElementById('btnToggleEngine')!;
  private engineStatusText = document.getElementById('engineStatusText')!;
  private btnOpenCalibration = document.getElementById('btnOpenCalibration')!;
  private mainPreviewImg = document.getElementById('mainPreviewImg') as HTMLImageElement;
  private canvasSheet = document.getElementById('canvasSheet')!;
  private stageContainer = document.getElementById('stageContainer')!;
  private compareSliderRoot = document.getElementById('compareSliderRoot')!;
  private bleedFrame = document.getElementById('bleedFrame')!;
  private safeFrame = document.getElementById('safeFrame')!;
  private processingOverlay = document.getElementById('processingOverlay')!;
  private processingText = document.getElementById('processingText')!;
  private presetAutoBadge = document.getElementById('presetAutoBadge');

  // Tool buttons
  private btnToggleCompare = document.getElementById('btnToggleCompare')!;
  private btnToggle1to1 = document.getElementById('btnToggle1to1')!;
  private btnToggleLoupe = document.getElementById('btnToggleLoupe')!;
  private btnFlipBack = document.getElementById('btnFlipBack')!;
  private btnToggleHeatmap = document.getElementById('btnToggleHeatmap')!;
  private btnToggleSoftProof = document.getElementById('btnToggleSoftProof')!;
  private btnToggleSafeZone = document.getElementById('btnToggleSafeZone')!;

  // Action buttons
  private btnOpenMockup = document.getElementById('btnOpenMockup')!;
  private btnOpenSpec = document.getElementById('btnOpenSpec')!;
  private btnOpenShops = document.getElementById('btnOpenShops')!;
  private btnExportPdf = document.getElementById('btnExportPdf')!;
  private btnExportPdfx = document.getElementById('btnExportPdfx')!;
  private btnExportPng = document.getElementById('btnExportPng')!;
  private btnExportSvg = document.getElementById('btnExportSvg')!;

  // Preset & Paper buttons
  private presetButtons = document.querySelectorAll<HTMLButtonElement>('.pm-preset-btn');
  private paperButtons = document.querySelectorAll<HTMLButtonElement>('.pm-paper-btn');

  // Cache of view variations
  private heatmapDataUrl: string | null = null;
  private softProofDataUrl: string | null = null;

  constructor() {
    this.initUIComponents();
    this.bindEvents();
    this.subscribeState();
    this.updateSoundIcon();

    // Check Cloud Backend status on startup
    void CloudClient.checkHealth();
  }

  private initUIComponents(): void {
    // 1. DropZone (Multi-file batch support)
    new DropZone('dropZone', (results) => {
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
      }
    );

    // 3. Compare Slider
    this.compareSlider = new CompareSlider('compareSliderRoot');

    // 4. Paper Simulator
    this.paperSimulator = new PaperSimulator('stageContainer');

    // 5. 3D Paper Physics Controller
    this.paper3D = new Paper3DController('stageContainer', 'canvasSheet', store.getState().currentPreset);

    // 6. 3D Luxury Foil & Spot UV Simulator
    this.foilSimulator = new FoilSimulator('stageContainer', 'canvasSheet');

    // 7. 20x Halftone Loupe
    this.loupe = new LoupeController('stageContainer');

    // 8. Laser Scanline
    this.laserScan = new LaserScanController('stageContainer');

    // 9. Modals
    this.mockupModal = new MockupModal();
    this.specModal = new SpecModal();
    this.calibrationModal = new RulerCalibrationModal();
    this.shopsModal = new NearbyShopsModal();
    this.directPrintModal = new DirectPrintModal(() => this.shopsModal.open());
    this.convPrintModal = new ConveniencePrintModal();
    this.impositionModal = new ImpositionModal();
    this.dielineModal = new DielineModal();
    this.vectorOverlayModal = new VectorOverlayModal(this.vectorOverlayEngine, () => {
      this.renderVectorOverlayOnCanvas();
    });

    // 10. Crop Controller
    this.cropController = new CropController('cropToolbarRoot', 'mainPreviewImg');

    // 11. Batch Studio Filmstrip Bar
    this.batchBar = new BatchBar('batchBarRoot', {
      onAddFiles: (files) => {
        new DropZone('dropZone', () => {}).handleFiles(Array.from(files));
      },
      onBatchOptimize: () => {
        this.runBatchOptimizeAll();
      },
      onBatchExportPdf: () => {
        this.runBatchExportAllPdf();
      }
    });
  }

  private bindEvents(): void {
    // Hybrid Dual-Engine Switcher
    this.btnToggleEngine.addEventListener('click', async () => {
      const current = store.getState().engineMode;
      SoundEffects.sliderTick();

      if (current === 'local') {
        const isOnline = await CloudClient.checkHealth();
        if (isOnline) {
          store.setEngineMode('cloud');
          Toast.info('⚡ 已切換至 雲端工業引擎模式 (支援 ISO 15930 PDF/X-1a 與 雲端 AI 深度學習)');
        } else {
          Toast.info('⚠️ 雲端後端伺服器 (port 3001) 未啟動，維持 100% 本機極速模式');
        }
      } else {
        store.setEngineMode('local');
        store.setState({ aiUpscaleMode: 'local' });
        Toast.info('🖥️ 已切換至 100% 離線本機極速模式 (嚴格僅限本機引擎，零資料上傳)');
      }
    });

    // AI Super-Resolution Mode Toggle
    document.getElementById('btnToggleAiUpscale')?.addEventListener('click', () => {
      const state = store.getState();
      SoundEffects.sliderTick();

      // Strict enforcement: Local mode only allows local engine
      if (state.engineMode === 'local') {
        Toast.info('🔒 目前為【100% 離線本機模式】，嚴格只使用本機 8x 金字塔引擎（零連網、零資料上傳）。若需使用雲端 AI 重建，請先將頂部模式切換為【雲端工業模式】！');
        return;
      }

      const next = store.toggleAiUpscaleMode();
      const icon = document.getElementById('aiUpscaleIcon');
      const txt = document.getElementById('aiUpscaleText');

      if (next === 'cloud-ai') {
        if (icon) icon.textContent = '🧠';
        if (txt) txt.textContent = 'AI 4x 重建';
        Toast.info('🧠 已啟動【雲端 AI 深度學習細節重建 (Real-ESRGAN 4x)】模式！');
      } else {
        if (icon) icon.textContent = '⚡';
        if (txt) txt.textContent = '本機 8x 放大';
        Toast.info('⚡ 已切換回【本機 8x 金字塔超解析度】模式！');
      }

      // Re-run pipeline if image exists
      const updatedState = store.getState();
      if (updatedState.originalImageData) {
        this.runOptimizationPipeline(updatedState.originalImageData);
      }
    });

    // Screen Calibration
    this.btnOpenCalibration.addEventListener('click', () => {
      SoundEffects.sliderTick();
      this.calibrationModal.open();
    });

    // 1:1 Scale Toggle
    this.btnToggle1to1.addEventListener('click', () => {
      const is1to1 = store.toggle1to1Scale();
      SoundEffects.sliderTick();
      Toast.info(is1to1 ? '📏 已開啟 100% 物理 1:1 毫米真實尺寸檢視' : '📐 已切換回螢幕自適應視圖');
    });

    // Sound Toggle
    this.btnToggleSound.addEventListener('click', () => {
      const isMuted = SoundEffects.toggleMute();
      this.updateSoundIcon();
      Toast.info(isMuted ? '🔇 觸覺音效已靜音' : '🔊 觸覺音效已開啟');
    });

    // Reset / New Artwork
    this.btnNewArtwork.addEventListener('click', () => {
      store.reset();
      this.heatmapDataUrl = null;
      this.softProofDataUrl = null;
      this.loupe.setImageData(null);
      this.loupe.setEnabled(false);
      Toast.info('已重置畫布，請拖入新圖片');
    });

    // FTUX Sample Artwork Pills (1-Click Test for New Users)
    document.querySelectorAll('.pm-sample-pill-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sampleType = (btn as HTMLElement).dataset.sample as 'anime' | 'cyberpunk' | 'card';
        if (!sampleType) return;

        SoundEffects.paperDrop();
        Toast.info('✨ 正在載入示範作品並啟動印刷分析...');
        try {
          const file = await SampleArtworks.loadSample(sampleType);
          const dropZone = new DropZone('dropZone', (results) => {
            this.handleImagesUploaded(results);
          });
          await dropZone.handleFiles([file]);
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

    // Preset Selection
    this.presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = btn.dataset.preset as PrintPresetId;
        if (presetId) {
          store.setPreset(presetId);
          this.paper3D.updatePreset(store.getState().currentPreset);
          this.updatePresetButtonsUI(presetId, false);
          SoundEffects.sliderTick();

          // Re-run pipeline for new physical dimensions
          const state = store.getState();
          if (state.originalImageData) {
            this.runOptimizationPipeline(state.originalImageData);
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
          this.paperSimulator.setPaper(paper);
          SoundEffects.sliderTick();
          Toast.info(`已切換實體紙材模擬：${btn.textContent}`);
        }
      });
    });

    // Toggle Compare View
    this.btnToggleCompare.addEventListener('click', () => {
      store.toggleComparing();
      SoundEffects.sliderTick();
    });

    // Toggle Loupe Magnifier
    this.btnToggleLoupe.addEventListener('click', () => {
      const active = this.loupe.toggle();
      this.btnToggleLoupe.classList.toggle('active', active);
      SoundEffects.sliderTick();
      if (active) {
        Toast.info('🔍 20x 網點顯微放大鏡已啟動');
      }
    });

    // Flip Paper Back / Front
    this.btnFlipBack.addEventListener('click', () => {
      this.paper3D.flip();
      this.btnFlipBack.classList.toggle('active', this.paper3D.getIsFlipped());
    });

    // Toggle TAC Heatmap
    this.btnToggleHeatmap.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.processedImageData) return;

      SoundEffects.sliderTick();

      if (!state.showHeatmap) {
        if (!this.heatmapDataUrl) {
          const heatmap = await workerClient.generateHeatmap(state.processedImageData, 300);
          this.heatmapDataUrl = this.imageDataToDataUrl(heatmap);
        }
      }
      store.toggleHeatmap();
    });

    // Toggle Soft Proof
    this.btnToggleSoftProof.addEventListener('click', () => {
      const state = store.getState();
      if (!state.processedImageData) return;

      SoundEffects.sliderTick();

      if (!state.showSoftProof && !this.softProofDataUrl) {
        const proof = CmykEngine.simulatePrintProof(state.processedImageData);
        this.softProofDataUrl = this.imageDataToDataUrl(proof);
      }
      store.toggleSoftProof();
    });

    // Toggle Safe Zone
    this.btnToggleSafeZone.addEventListener('click', () => {
      store.toggleSafeZone();
      SoundEffects.sliderTick();
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
        // Auto generate default back template if none exists
        const state = store.getState();
        const tmpl = DoubleSidedManager.generateBackTemplate('postcard_standard', state.currentPreset);
        this.doubleSidedManager.setBackImage(tmpl.dataUrl, tmpl.imageData);
        Toast.success('✨ 已為您自動載入標準明信片背面公版！');
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

    // International ICC Profile Selector
    document.getElementById('selectIccProfile')?.addEventListener('change', (e) => {
      const iccId = (e.target as HTMLSelectElement).value as IccProfileId;
      if (iccId) {
        iccProfileEngine.setProfile(iccId);
        const active = iccProfileEngine.getActiveProfile();
        SoundEffects.sliderTick();
        Toast.info(`🎨 已切換印刷色彩描述檔：【${active.name}】(TAC ≤${active.maxTac}%)`);
      }
    });

    // Open Smart Dieline & White Ink Modal
    document.getElementById('btnOpenDieline')?.addEventListener('click', () => {
      this.dielineModal.open();
    });

    // Open K100 Pure Black & Vector Overlay Modal
    document.getElementById('btnOpenVectorOverlay')?.addEventListener('click', () => {
      this.vectorOverlayModal.open();
    });

    // Open Direct Print & Live Quote Modal
    document.getElementById('btnOpenDirectPrint')?.addEventListener('click', () => {
      this.directPrintModal.open();
    });

    // Open Convenience Store Cloud Print Modal (7-11 & FamilyMart)
    document.getElementById('btnOpenConvPrint')?.addEventListener('click', () => {
      this.convPrintModal.open();
    });

    // Open Imposition Gang-Run Sheet Modal (A4/A3)
    document.getElementById('btnOpenImposition')?.addEventListener('click', () => {
      void this.impositionModal.open();
    });

    // Open Nearby Commercial Print Shops Finder
    this.btnOpenShops.addEventListener('click', () => {
      SoundEffects.sliderTick();
      this.shopsModal.open();
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
        if (ds.hasBack && ds.backDataUrl) {
          Toast.info('📄 正在生成 2 頁標準【雙面合版 PDF】(Page 1 正面 + Page 2 背面)...');
          const pdfBlob = await DoubleSidedManager.exportDoubleSidedPdf(
            ds.frontDataUrl || state.processedDataUrl,
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
          Toast.success('✓ 標準雙面 2-Page PDF 已成功輸出！');
        } else {
          Toast.info('📄 正在以本機極速引擎生成標準 PDF (含 0.1mm 裁切標記與 CMYK 色條)...');
          await PdfExporter.export(state.processedDataUrl, state.currentPreset, undefined, state.cropAnchor);
          Toast.success('✓ 本機標準單面 PDF 已成功輸出！');
        }
      } catch (err: any) {
        Toast.error(`PDF 匯出失敗: ${err?.message || err}`);
      }
    });

    // Export Cloud Pro PDF/X-1a (Hybrid Backend + Auto Fallback)
    this.btnExportPdfx.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.processedDataUrl) {
        Toast.error('請先上傳並優化圖片');
        return;
      }

      SoundEffects.shutterClick();
      const activeBatch = state.batchItems.find((b) => b.id === state.activeBatchId);
      const artworkName = activeBatch ? activeBatch.name : 'Artwork';

      await CloudClient.exportPdfx(state.processedDataUrl, state.currentPreset, artworkName);
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

    // Export SVG (Potrace Vector)
    this.btnExportSvg.addEventListener('click', () => {
      const state = store.getState();
      if (!state.processedImageData) {
        Toast.error('請先上傳圖片');
        return;
      }

      try {
        SoundEffects.shutterClick();
        Toast.info('🔄 正在以 Potrace 演算法生成無失真向量路徑...');
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
  }

  private updateSoundIcon(): void {
    const isMuted = SoundEffects.getIsMuted();
    this.soundIcon.textContent = isMuted ? '🔇' : '🔊';
  }

  private subscribeState(): void {
    store.subscribe((state) => {
      const hasImage = !!state.originalDataUrl;

      // 1. Update Hybrid Engine Pill UI
      this.btnToggleEngine.classList.toggle('pm-engine-cloud', state.engineMode === 'cloud');
      this.btnToggleEngine.classList.toggle('pm-engine-offline', state.cloudStatus === 'offline');
      const aiUpscaleIcon = document.getElementById('aiUpscaleIcon');
      const aiUpscaleText = document.getElementById('aiUpscaleText');
      const btnToggleAiUpscale = document.getElementById('btnToggleAiUpscale');

      if (state.engineMode === 'cloud') {
        this.engineStatusText.textContent = state.cloudStatus === 'online' ? '雲端工業模式 (在線)' : '雲端工業模式 (離線降級)';
        if (btnToggleAiUpscale) btnToggleAiUpscale.title = '點擊切換 ⚡ 本機 8x 放大 與 🧠 雲端 AI 4x 重建';
        if (state.aiUpscaleMode === 'cloud-ai') {
          if (aiUpscaleIcon) aiUpscaleIcon.textContent = '🧠';
          if (aiUpscaleText) aiUpscaleText.textContent = 'AI 4x 重建';
        } else {
          if (aiUpscaleIcon) aiUpscaleIcon.textContent = '⚡';
          if (aiUpscaleText) aiUpscaleText.textContent = '本機 8x 放大';
        }
      } else {
        this.engineStatusText.textContent = '本機極速模式 (100% 離線)';
        if (btnToggleAiUpscale) btnToggleAiUpscale.title = '🔒 本機極速模式 (100% 離線隱私保護，嚴格僅限本機引擎)';
        if (aiUpscaleIcon) aiUpscaleIcon.textContent = '⚡';
        if (aiUpscaleText) aiUpscaleText.textContent = '本機 8x 放大';
      }

      // 2. Switch View Containers
      this.dropZoneContainer.style.display = hasImage ? 'none' : 'block';
      this.studioWorkspace.style.display = hasImage ? 'grid' : 'none';
      this.btnNewArtwork.style.display = hasImage ? 'inline-flex' : 'none';

      // 3. Processing Overlay
      this.processingOverlay.style.display = state.isProcessing ? 'flex' : 'none';
      this.processingText.textContent = state.processingStep || '正在處理中...';

      // 4. Comparison Mode
      if (state.isComparing) {
        this.canvasSheet.style.display = 'none';
        this.compareSliderRoot.style.display = 'block';
        this.btnToggleCompare.classList.add('active');
        if (state.originalDataUrl && state.processedDataUrl) {
          this.compareSlider.setImages(state.originalDataUrl, state.processedDataUrl);
        }
      } else {
        this.canvasSheet.style.display = 'inline-block';
        this.compareSliderRoot.style.display = 'none';
        this.btnToggleCompare.classList.remove('active');
      }

      // 5. Update Main Preview Image
      if (!state.isComparing && state.processedDataUrl) {
        if (state.showHeatmap && this.heatmapDataUrl) {
          this.mainPreviewImg.src = this.heatmapDataUrl;
        } else if (state.showSoftProof && this.softProofDataUrl) {
          this.mainPreviewImg.src = this.softProofDataUrl;
        } else {
          this.mainPreviewImg.src = state.processedDataUrl;
        }
      }

      // 6. 1:1 Physical Scale Override
      this.btnToggle1to1.classList.toggle('active', state.is1to1Scale);
      if (state.is1to1Scale && state.currentPreset.widthMm > 0) {
        this.stageContainer.classList.add('pm-stage-1to1');
        const physicalW = (state.currentPreset.widthMm / 25.4) * state.screenPpi;
        const physicalH = (state.currentPreset.heightMm / 25.4) * state.screenPpi;
        this.canvasSheet.style.width = `${physicalW.toFixed(1)}px`;
        this.canvasSheet.style.height = `${physicalH.toFixed(1)}px`;
      } else {
        this.stageContainer.classList.remove('pm-stage-1to1');
        this.canvasSheet.style.width = '';
        this.canvasSheet.style.height = '';
      }

      // 7. Button Active States
      this.btnToggleHeatmap.classList.toggle('active', state.showHeatmap);
      this.btnToggleSoftProof.classList.toggle('active', state.showSoftProof);
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

      // 10. Diagnostic Card
      this.diagnosticCard.render(state);
    });
  }

  private async handleImagesUploaded(results: LoadedImageResult[]): Promise<void> {
    SoundEffects.paperDrop();

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

    Toast.success(`✓ 已載入 ${results.length} 張作品，智慧推薦【${autoPreset.nameZh}】(可隨時手動彈性更換)`);

    // Show First-Time Coachmark Banner if not previously dismissed
    const isDismissed = localStorage.getItem('pm_coachmark_dismissed');
    const coachmark = document.getElementById('coachmarkBanner');
    if (coachmark && !isDismissed) {
      coachmark.style.display = 'flex';
    }

    await this.runOptimizationPipeline(firstItem.originalImageData);
  }

  private async runOptimizationPipeline(srcImageData: ImageData): Promise<void> {
    const state = store.getState();
    const preset = state.currentPreset;
    const activeId = state.activeBatchId;

    this.heatmapDataUrl = null;
    this.softProofDataUrl = null;

    store.setState({
      isProcessing: true,
      processingStep: '1/4 正在分析原圖指標 (DPI、長寬比、溢墨與邊緣銳度)...'
    });

    if (activeId) {
      store.updateBatchItem(activeId, { status: 'processing' });
    }

    try {
      // Trigger Cinematic Laser Scanline
      void this.laserScan.triggerScan();

      // Step 0: Pre-Processing Diagnostic Evaluation
      const originalDpiAnalysis = DpiCalculator.analyze(
        srcImageData.width,
        srcImageData.height,
        preset
      );
      const { stats: originalStats, inkAnalysis: originalInkAnalysis } = await workerClient.analyze(srcImageData);
      const originalScoreResult = PrintScoreCalculator.calculate(originalStats, preset, originalInkAnalysis);

      store.setState({
        originalStats,
        originalDpiAnalysis,
        originalInkAnalysis,
        originalScoreResult
      });

      let processedImgData = srcImageData;
      let appliedScale = 1;

      // Step 1: Super-Resolution Upscaling (AI Neural Reconstructor vs Local 8x Pyramid)
      if (originalDpiAnalysis.needsUpscale && originalDpiAnalysis.scaleFactor > 1) {
        appliedScale = originalDpiAnalysis.scaleFactor;

        const isCloudAiAllowed = state.engineMode === 'cloud' && state.aiUpscaleMode === 'cloud-ai';

        if (isCloudAiAllowed) {
          store.setState({
            processingStep: '2/4 正在呼叫雲端 AI 深度學習神經網路進行 4x 細節重建 (Real-ESRGAN)...'
          });
          const srcDataUrl = state.originalDataUrl || this.imageDataToDataUrl(srcImageData);
          const aiResult = await AiUpscaleClient.upscale(srcDataUrl);

          if (aiResult.success && aiResult.imageData) {
            processedImgData = aiResult.imageData;
            appliedScale = aiResult.scale || 4;
            Toast.success('🧠 AI 深度學習細節重建完成 (Real-ESRGAN 4x)！');
          } else {
            // Graceful automatic fallback to local Lanczos-3 8x pyramid engine
            store.setState({
              processingStep: `2/4 正在啟用本機 ${appliedScale}x 金字塔超解析度放大 (0 延遲備援)...`
            });
            processedImgData = await workerClient.lanczos(srcImageData, appliedScale);
            Toast.info('⚡ 雲端 AI 忙碌中，已無縫啟用本機 8x 金字塔超解析度引擎！');
          }
        } else {
          // Strictly 100% Local Engine (Zero Network Calls)
          store.setState({
            processingStep: `2/4 正在執行 ${appliedScale}x 本機金字塔超解析度放大 (100% 離線防護)...`
          });
          processedImgData = await workerClient.lanczos(srcImageData, appliedScale);
        }
      }

      // Step 2: Pre-press Unsharp Mask Sharpening
      store.setState({
        processingStep: '3/4 正在套用印刷微細邊緣銳化補償 (USM)...'
      });
      processedImgData = await workerClient.unsharp(processedImgData, 1.5, 1, 3);

      // Step 3: Total Area Coverage (TAC 300%) Clamp & Verification
      store.setState({
        processingStep: '4/4 正在檢測並修正總墨量 TAC 限制 (300%)...'
      });
      const clampResult = await workerClient.clampInk(processedImgData, 300);
      processedImgData = clampResult.imageData;

      // Step 4: Post-Processing Diagnostic Evaluation
      const { stats, inkAnalysis } = await workerClient.analyze(processedImgData);
      const dpiAnalysis = DpiCalculator.analyze(
        processedImgData.width,
        processedImgData.height,
        preset
      );
      const scoreResult = PrintScoreCalculator.calculate(stats, preset, inkAnalysis);

      const processedDataUrl = this.imageDataToDataUrl(processedImgData);

      // Update State Store
      store.setState({
        processedDataUrl,
        processedImageData: processedImgData,
        processedStats: stats,
        processedWidth: processedImgData.width,
        processedHeight: processedImgData.height,
        dpiAnalysis,
        inkAnalysis,
        scoreResult,
        appliedScale,
        isProcessing: false,
        processingStep: ''
      });

      // Update Front Image in DoubleSidedManager
      this.doubleSidedManager.setFrontImage(processedDataUrl, processedImgData);

      // Update active batch item
      if (activeId) {
        store.updateBatchItem(activeId, {
          originalScoreResult,
          originalDpiAnalysis,
          originalInkAnalysis,
          processedDataUrl,
          processedImageData: processedImgData,
          processedWidth: processedImgData.width,
          processedHeight: processedImgData.height,
          dpiAnalysis,
          inkAnalysis,
          scoreResult,
          appliedScale,
          stats,
          status: 'done'
        });
      }

      SoundEffects.purityChime();
      const delta = scoreResult.score - originalScoreResult.score;
      const deltaStr = delta > 0 ? ` (+${delta}分提升)` : '';
      Toast.success(`✓ 印刷優化完成！原圖 ${originalScoreResult.score}分 ➔ 優化後 ${scoreResult.score}分${deltaStr}`);
    } catch (err: any) {
      console.error('Optimization pipeline error:', err);
      store.setState({ isProcessing: false, processingStep: '' });
      if (activeId) {
        store.updateBatchItem(activeId, { status: 'error', errorMessage: err?.message });
      }
      Toast.error(`處理失敗: ${err?.message || err}`);
    }
  }

  private renderVectorOverlayOnCanvas(): void {
    const state = store.getState();
    const baseImgData = state.processedImageData || state.originalImageData;
    if (!baseImgData) return;

    const canvas = document.createElement('canvas');
    canvas.width = baseImgData.width;
    canvas.height = baseImgData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(baseImgData, 0, 0);

    // Draw Vector Overlay Elements
    this.vectorOverlayEngine.renderOverlay(ctx, canvas.width, canvas.height);

    const updatedDataUrl = canvas.toDataURL('image/png');
    const updatedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    store.setState({
      processedDataUrl: updatedDataUrl,
      processedImageData: updatedImageData
    });

    if (this.doubleSidedManager.getState().activeSide === 'front') {
      this.doubleSidedManager.setFrontImage(updatedDataUrl, updatedImageData);
      this.mainPreviewImg.src = updatedDataUrl;
    }
  }

  private async runBatchOptimizeAll(): Promise<void> {
    const items = store.getState().batchItems;
    if (items.length === 0) return;

    Toast.info(`⚡ 正在連續批次優化全部 ${items.length} 張作品...`);
    SoundEffects.sliderTick();

    for (const item of items) {
      store.selectBatchItem(item.id);
      await this.runOptimizationPipeline(item.originalImageData);
    }

    Toast.success(`✓ 畫廊內全部 ${items.length} 張作品已完成印刷級優化！`);
  }

  private async runBatchExportAllPdf(): Promise<void> {
    const state = store.getState();
    const items = state.batchItems;
    if (items.length === 0) return;

    Toast.info(`📦 正在連續輸出 ${items.length} 份標準印刷 PDF...`);

    let count = 0;
    for (const item of items) {
      const dataUrl = item.processedDataUrl || item.originalDataUrl;
      const filename = `PrintMagic_${item.name}_${state.currentPreset.id}.pdf`;
      try {
        await PdfExporter.export(dataUrl, state.currentPreset, filename, state.cropAnchor);
        count++;
        await new Promise((r) => setTimeout(r, 200));
      } catch (err: any) {
        console.error(`Export failed for ${item.name}:`, err);
      }
    }

    SoundEffects.shutterClick();
    Toast.success(`✓ 已成功匯出 ${count} 份印刷標準 PDF！`);
  }

  private imageDataToDataUrl(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  private updatePresetButtonsUI(activeId: string, isAuto = false): void {
    this.presetButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === activeId);
    });

    if (this.presetAutoBadge) {
      if (isAuto) {
        const preset = getPresetById(activeId);
        const shortName = preset.nameZh.split(' ')[0] || preset.nameZh;
        this.presetAutoBadge.style.display = 'inline-flex';
        this.presetAutoBadge.textContent = `✨ 智慧適配：${shortName}`;
      } else {
        this.presetAutoBadge.style.display = 'inline-flex';
        this.presetAutoBadge.textContent = '🎨 手動選擇';
      }
    }
  }

  private updatePaperButtonsUI(activePaper: string): void {
    this.paperButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.paper === activePaper);
    });
  }
}

// Clean up obsolete Service Workers and stale caches
function cleanupLegacyServiceWorkers(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  cleanupLegacyServiceWorkers();
  new App();
});
