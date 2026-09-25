import { store } from '../ui/state';
import type { LaserScanController } from '../ui/laser-scan';
import type { XiaoxiangAssistant } from '../ui/xiaoxiang-assistant';
import type { DoubleSidedManager } from './double-sided';
import type { VectorOverlayEngine } from './vector-overlay';
import { Toast } from '../ui/toast';
import { SoundEffects } from './sound-effects';
import { DpiCalculator } from './dpi-calculator';
import { PrintScoreCalculator, type ScoreUpscaleContext } from './print-score';
import { iccProfileEngine } from './icc-profiles';
import { AiUpscaleClient } from '../services/ai-upscale-client';
import { PdfExporter } from '../engines/pdf-exporter';
import { TextInspector } from './text-inspector';
import { workerClient } from '../workers/worker-client';
import { ShadowLift } from './shadow-lift';
import { HandShadowBalancer } from './hand-shadow-balancer';
import { AntiBandingFilter } from './anti-banding';
import { PantoneMatcher } from './pantone-matcher';
import { BarcodeVerifier } from './barcode-verifier';
import { MoireRiskPredictor } from './moire-risk-predictor';
import { SceneClassifier } from './scene-classifier';
import { LineArtUpscaler } from './line-art-upscaler';
import { EdgeAwareUpscaler } from './edge-aware-upscaler';
import { FreeLowlightClient } from '../services/free-lowlight-client';
import { FreeMattingClient } from '../services/free-matting-client';
import { BleedExpander } from './bleed-expander';
import { NetworkGuard } from '../services/network-guard';

/**
 * 2026-08-30 抽出自 main.ts 的 `App` 類別：main.ts 身兼「26 個獨立 UI 元件的組裝根」
 * 與「整個印前優化管線的擁有者」兩種角色，後者才是真正的業務邏輯，值得獨立成自己的類別。
 * 只依賴 4 個真正需要的 UI 元件實例（透過建構子注入），其餘用到的都已經是模組層級的
 * 靜態單例（store／workerClient／iccProfileEngine 等），原封不動搬過來即可。
 *
 * `resetPreviewCaches` 是唯一的例外：原本開頭重設的 heatmapDataUrl／softProofDataUrl／
 * cvdPreviewDataUrl／cvdPreviewCachedType 其實是 App 自己的實例欄位（給熱度圖、軟打樣、
 * 色盲模擬預覽做惰性快取用），不是 store 狀態，也不是這個管線類別該擁有的東西——它們被
 * App 的其他方法（切換熱度圖/軟打樣/CVD 預覽、切換 ICC 描述檔）直接讀寫。這裡用一個
 * callback 讓 App 自己決定怎麼重設，管線本身不需要知道這些欄位的存在。
 */
export class PipelineOrchestrator {
  constructor(
    private laserScan: LaserScanController,
    private vectorOverlayEngine: VectorOverlayEngine,
    private doubleSidedManager: DoubleSidedManager,
    private xiangAssistant: XiaoxiangAssistant,
    private resetPreviewCaches: () => void
  ) {}

  /**
   * Monotonic run token. Every call to runOptimizationPipeline takes a new generation; a run that
   * is superseded (new upload, preset/toggle change, batch item switch) discards its results
   * instead of writing them into the store, and only the latest run may clear isProcessing.
   */
  private runGeneration = 0;

  private isStale(gen: number): boolean {
    return gen !== this.runGeneration;
  }

  private imageDataToDataUrl(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  public async runOptimizationPipeline(srcImageData: ImageData): Promise<void> {
    const state = store.getState();
    const preset = state.currentPreset;
    const activeId = state.activeBatchId;
    const gen = ++this.runGeneration;

    this.resetPreviewCaches();

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

      // Know which self-hosted services are up before any step tries one (probe is reused for 60s).
      await NetworkGuard.refreshServiceStatus();
      if (this.isStale(gen)) return this.abandonRun(activeId);

      // Step 0: Pre-Processing Diagnostic Evaluation
      const originalDpiAnalysis = DpiCalculator.analyze(
        srcImageData.width,
        srcImageData.height,
        preset
      );
      const { stats: originalStats, inkAnalysis: originalInkAnalysis } = await workerClient.analyze(srcImageData);
      const originalScoreResult = PrintScoreCalculator.calculate(originalStats, preset, originalInkAnalysis);
      if (this.isStale(gen)) return this.abandonRun(activeId);

      store.setState({
        originalStats,
        originalDpiAnalysis,
        originalInkAnalysis,
        originalScoreResult
      });

      let processedImgData = srcImageData;
      let appliedScale = 1;
      // Which upscaler actually ran — the after-score caps resolution by source detail (see print-score.ts).
      let upscaleMethod: ScoreUpscaleContext['method'] | null = null;
      const opts = state.pipelineOptions;

      const setStep = (processingStep: string) => {
        if (!this.isStale(gen)) store.setState({ processingStep });
      };

      // Step 1: Super-Resolution Upscaling (cloud edge-enhance vs local Lanczos pyramid, scale from DPI analysis)
      if (opts.enableUpscale && originalDpiAnalysis.needsUpscale && originalDpiAnalysis.scaleFactor > 1) {
        const targetScale = originalDpiAnalysis.scaleFactor;

        const isCloudAiAllowed = state.engineMode === 'cloud';

        if (isCloudAiAllowed) {
          const srcDataUrl = state.originalDataUrl || this.imageDataToDataUrl(srcImageData);

          setStep('2/4 正在執行邊緣強化放大演算法...');
          const autoModel = AiUpscaleClient.autoSelectModel(srcImageData, targetScale);
          const aiResult = await AiUpscaleClient.upscale(srcDataUrl, autoModel);
          if (this.isStale(gen)) return this.abandonRun(activeId);

          if (aiResult.success && aiResult.imageData) {
            processedImgData = aiResult.imageData;
            // AiUpscaleClient reports success for its local edge-aware fallback too; only the server's model counts as 'ai'.
            upscaleMethod = aiResult.engine === 'real-esrgan' ? 'ai' : 'interpolation';
            // The service may return less than the DPI-derived target (its own scale cap, or the
            // payload was downscaled before upload). Top up with Lanczos so the output really
            // reaches the target width instead of silently under-delivering.
            const targetWidth = Math.round(srcImageData.width * targetScale);
            if (processedImgData.width < targetWidth) {
              setStep('2/4 正在以 Lanczos 補足放大倍率...');
              processedImgData = await workerClient.lanczos(processedImgData, targetWidth / processedImgData.width);
            }
          } else {
            // Graceful automatic fallback to local Lanczos-3 pyramid engine (at the DPI-derived scale)
            setStep('2/4 正在啟用本機金字塔超解析度放大 (備援)...');
            processedImgData = await workerClient.lanczos(srcImageData, targetScale);
            upscaleMethod = 'interpolation';
            if (!this.isStale(gen) && this.isAdvancedMode()) Toast.info('⚡ 雲端放大無法使用，已改用本機 Lanczos 金字塔放大');
          }
        } else {
          // Local engine only (no network call for upscaling)
          setStep('2/4 正在執行本機金字塔超解析度放大...');
          processedImgData = await workerClient.lanczos(srcImageData, targetScale);
          upscaleMethod = 'interpolation';
        }
        if (this.isStale(gen)) return this.abandonRun(activeId);
        appliedScale = processedImgData.width / srcImageData.width;
        if (isCloudAiAllowed && this.isAdvancedMode()) {
          Toast.success(`⚡ 放大完成（實際 ${Number(appliedScale.toFixed(2))}x）`);
        }

        // Apply scene-aware algorithmic post-enhancement (deterministic filters, not neural models)
        const scene = SceneClassifier.classifyImage(processedImgData);
        if (scene.category === 'anime') {
          processedImgData = LineArtUpscaler.upscaleAnime(processedImgData, 1);
        } else if (scene.category === 'portrait' || scene.category === 'landscape') {
          // EdgeAwareUpscaler always doubles the size. Only run it when the result still fits the
          // same 6000px memory cap DpiCalculator applies, and keep appliedScale truthful.
          const MAX_SAFE_DIM = 6000;
          if (Math.max(processedImgData.width, processedImgData.height) * 2 <= MAX_SAFE_DIM) {
            const res = EdgeAwareUpscaler.upscale(processedImgData, 2, scene.category === 'portrait' ? 0.4 : 0.6);
            processedImgData = res.upscaledImageData;
            appliedScale = processedImgData.width / srcImageData.width;
          }
        }

        // Apply low-light dynamic range boost if scene has low-light or shadow traits
        // (自建 Retinexformer 服務優先，離線時自動退回本機曲線估計演算法)
        if (scene.detectedTraits.some((t: string) => t.includes('暗') || t.includes('曝光') || t.includes('黑'))) {
          const lowlightResult = await FreeLowlightClient.enhance(processedImgData);
          processedImgData = lowlightResult.imageData;
          if (this.isStale(gen)) return this.abandonRun(activeId);
        }
        appliedScale = processedImgData.width / srcImageData.width;
      }

      // Step 1.5: Auto Deshadow & Illumination Field Normalization (手機拍照光照均勻化)
      // Opt-in only (default off): it flattens intentional lighting on normal artwork.
      if (opts.enableDeshadow === true) {
        processedImgData = HandShadowBalancer.deshadow(processedImgData, 0.70);
      }

      // Step 1.8: Auto Anti-Banding & Gradient Smoothing (漸層防斷階去噪)
      if (opts.enableAntiBanding !== false) {
        processedImgData = AntiBandingFilter.apply(processedImgData, 0.65);
      }

      // Step 2: Pre-press Unsharp Mask Sharpening
      if (opts.enableSharpening) {
        setStep('3/4 正在套用印刷微細邊緣銳化補償 (USM)...');
        processedImgData = await workerClient.unsharp(processedImgData, 1.5, 1, 3);
        if (this.isStale(gen)) return this.abandonRun(activeId);
      }

      // Step 2.5: Pre-press Shadow Tone Recovery (暗部階調防死黑補償)
      if (opts.enableShadowLift) {
        processedImgData = ShadowLift.apply(processedImgData, 0.10);
      }

      // Step 3: Total Area Coverage (TAC) Clamp & Verification
      //
      // ⚠️ 2026-08-29 修正一個真實存在的問題：這裡原本不管使用者在「ICC 描述檔」下拉選單選了哪個
      // 印刷標準，一律寫死用 300% 當總墨量上限——選擇「Japan Color 2001 Uncoated」（當時設定的上限
      // 260%，針對容易死黑的美術紙設計；2026-09-25 依 Adobe 描述檔更正為 310%，見 icc-profiles.ts）的使用者，
      // 實際上還是被放行到 300%；選擇「Japan Color 2001 Coated」（該標準宣稱上限 350%）的使用者，
      // 反而被限制得比描述檔容許的更嚴格。等於這個選單選了等於沒選，完全不影響實際壓墨結果。
      // 已改成讀取目前選取描述檔真正的 `maxTac`。
      if (opts.enableInkLimiting) {
        const activeMaxTac = iccProfileEngine.getActiveProfile().maxTac;
        setStep(`4/4 正在檢測並修正總墨量 TAC 限制 (${activeMaxTac}%)...`);
        const clampResult = await workerClient.clampInk(processedImgData, activeMaxTac);
        processedImgData = clampResult.imageData;
        if (this.isStale(gen)) return this.abandonRun(activeId);
      }

      // Step 3.5: User-Configured Vector Text Overlay (僅在用戶手動編輯或確認後套用，絕不自動覆蓋假浮水印文字)
      // 2026-08-28 修正：這個條件原本只檢查 getTextItems().length>0，代表使用者如果只加了 Logo、
      // 沒加任何文字項目，這整段（包含 Logo 繪製）會被整個跳過，Logo 永遠不會出現在送印檔案裡。
      if (
        opts.enableVectorOverlay === true &&
        (this.vectorOverlayEngine.getTextItems().length > 0 || this.vectorOverlayEngine.getLogoItems().length > 0)
      ) {
        const canvas = document.createElement('canvas');
        canvas.width = processedImgData.width;
        canvas.height = processedImgData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(processedImgData, 0, 0);
        await this.vectorOverlayEngine.renderOverlay(ctx, canvas.width, canvas.height);
        processedImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (this.isStale(gen)) return this.abandonRun(activeId);
      }

      // Step 3.6: Auto background removal for die-cut sticker presets (2026-09-19). Background
      // removal is only safe to assume as a default for artwork that's explicitly going to be
      // die-cut around its subject — applying it to a poster/postcard/business-card photo would
      // destroy an intentional background, so this is gated on the preset, not a global default.
      if (opts.enableAutoBgRemoval && preset.id === 'sticker') {
        setStep('3/4 正在自動去背（模切貼紙預設）...');
        const mattingResult = await FreeMattingClient.removeBackground(processedImgData);
        processedImgData = mattingResult.imageData;
        if (this.isStale(gen)) return this.abandonRun(activeId);
      }

      // Step 3.7: Auto bleed outpaint (mirror-extend, non-generative — see bleed-expander.ts).
      // 2026-09-19 修正：`enableBleedExpand` 這個選項在「專家管線自訂」面板裡預設是開啟的，UI 文案
      // 也寫「開：自動補齊 3mm」，但這裡從未真的讀取這個旗標去呼叫 BleedExpander —— 唯一會真的
      // 補出血的地方是使用者手動點擊「補足出血」按鈕。等於這個「自動」選項從上線以來從未自動過。
      if (opts.enableBleedExpand && preset.bleedMm > 0) {
        setStep(`3/4 正在自動補齊 ${preset.bleedMm}mm 出血區...`);
        const bleedResult = BleedExpander.expandBleed(processedImgData, preset, preset.bleedMm);
        processedImgData = bleedResult.imageData;
        if (this.isStale(gen)) return this.abandonRun(activeId);
      }

      // Bleed outpaint (and, for stickers, background removal) both change canvas dimensions —
      // recompute so the DPI/scale figures shown to the user reflect the final delivered pixels.
      appliedScale = processedImgData.width / srcImageData.width;

      // Step 4: Post-Processing Comprehensive Diagnostic & Scientific Quality Evaluation
      // Sharpness is measured at the source's scale and resolution is capped by source detail, so an
      // upscale can't score itself as new detail (see print-score.ts, 2026-09-25).
      const { stats, inkAnalysis } = await workerClient.analyze(
        processedImgData,
        Math.max(srcImageData.width, srcImageData.height)
      );
      const dpiAnalysis = DpiCalculator.analyze(
        processedImgData.width,
        processedImgData.height,
        preset
      );
      if (this.isStale(gen)) return this.abandonRun(activeId);
      const scoreResult = PrintScoreCalculator.calculate(stats, preset, inkAnalysis, {
        upscale: upscaleMethod
          ? { sourceWidth: srcImageData.width, sourceHeight: srcImageData.height, method: upscaleMethod }
          : undefined
      });
      const dominantPantones = PantoneMatcher.extractDominantSpotColors(processedImgData, 3);
      const barcodeReport = BarcodeVerifier.verifyImage(processedImgData, 300);

      if (dominantPantones.length > 0) {
        const pantoneSummary = dominantPantones.map((p) => `${p.pantone.code} (${p.pantone.name})`).join(' · ');
        scoreResult.recommendations.push(`🌈 Pantone 專色配對：${pantoneSummary}`);
      }
      if (barcodeReport.hasBarcode && !barcodeReport.isLegible) {
        scoreResult.issues.push(...barcodeReport.issues);
        scoreResult.recommendations.push(...barcodeReport.recommendations);
      }

      // Moiré risk preflight (見 src/core/moire-risk-predictor.ts) — wrapped locally so a failure
      // here can't abort the whole Step 4 diagnostic; this is a bonus check, not core safety math.
      try {
        const { detected, assessments } = MoireRiskPredictor.assess(processedImgData, dpiAnalysis.targetDpi || 300);
        if (detected) {
          const worst = assessments.reduce((a, b) => (b.predictedMoirePeriodMm > a.predictedMoirePeriodMm ? b : a));
          if (worst.riskLevel === 'high') {
            scoreResult.issues.push(
              `🌀 偵測到圖片本身有規律重複圖案（週期約 ${detected.periodPx.toFixed(1)}px），與常見網屏線數（如 ${worst.lpi} LPI）疊印可能產生明顯摩爾紋波紋（預估週期 ${worst.predictedMoirePeriodMm}mm）`
            );
            scoreResult.recommendations.push('💡 建議送印前與印刷廠確認網屏線數，或考慮微調圖片解析度/角度以錯開規律頻率');
          } else if (worst.riskLevel === 'moderate') {
            scoreResult.recommendations.push(
              `🌀 圖片含規律圖案，與部分網屏線數搭配時可能出現輕微摩爾紋（預估週期 ${worst.predictedMoirePeriodMm}mm），建議送印前留意打樣`
            );
          }
        }
      } catch {
        // Preflight nicety only — silently skip on any unexpected failure (e.g. degenerate input).
      }

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
      void this.laserScan.triggerMagicReveal();
      const delta = scoreResult.score - originalScoreResult.score;
      const deltaStr = delta > 0 ? ` (+${delta}分提升)` : '';
      Toast.success(`✓ 印刷優化完成！原圖 ${originalScoreResult.score}分 ➔ 優化後 ${scoreResult.score}分${deltaStr}`);

      // Auto-trigger background AI Text Inspection on the final processed pixels, so the boxes it
      // returns are in the same coordinate space as the processed preview they're drawn on.
      void this.runAutoTextInspection(processedImgData, gen);

      // Smart Contextual Action Hints (Learnability & Proactivity) — they point at advanced-mode tools,
      // so simple mode (which only shows the before/after score) skips them.
      if (this.isAdvancedMode() && stats.transparentRatio > 0.03) {
        setTimeout(() => {
          Toast.info('💡 偵測到透明背景！點擊下方【🏷️ 刀模白墨】可一鍵產生貼紙刀模線與白墨層');
        }, 1200);
      }
    } catch (err: any) {
      if (this.isStale(gen)) return this.abandonRun(activeId);
      console.error('Optimization pipeline error:', err);
      store.setState({ isProcessing: false, processingStep: '' });
      if (activeId) {
        store.updateBatchItem(activeId, { status: 'error', errorMessage: err?.message });
      }
      Toast.error(`處理失敗: ${err?.message || err}`);
    }
  }

  /** A superseded run leaves the store to the newer run; just un-stick its own batch item. */
  private abandonRun(activeId: string | null | undefined): void {
    if (!activeId) return;
    const s = store.getState();
    const item = s.batchItems.find((b) => b.id === activeId);
    if (item && item.status === 'processing' && s.activeBatchId !== activeId) {
      store.updateBatchItem(activeId, { status: 'idle' });
    }
  }

  /** Simple mode only shows the before/after score, so step-by-step notices are advanced-only. */
  private isAdvancedMode(): boolean {
    return store.getState().uiMode === 'advanced';
  }

  public async runAutoTextInspection(imgData: ImageData, gen: number = this.runGeneration): Promise<void> {
    try {
      const inspectResult = await TextInspector.inspectImage(imgData);
      if (this.isStale(gen)) return;
      store.setTextInspectionResult(inspectResult);
      if (inspectResult.typoCount > 0 && this.isAdvancedMode()) {
        this.xiangAssistant?.say(`⚠️ AI 文字檢查：發現 ${inspectResult.typoCount} 處文字疑似拼寫或邊緣發虛，點擊【🔤 文字清晰】可一鍵自動修復！`, 6000);
        setTimeout(() => {
          Toast.info(`📝 發現 ${inspectResult.typoCount} 處文字需注意，點擊【🔤 文字清晰防糊】可一鍵修復！`);
        }, 1500);
      }
    } catch (err) {
      console.warn('Auto text inspection error:', err);
    }
  }

  public async runBatchOptimizeAll(): Promise<void> {
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

  public async runBatchExportAllPdf(): Promise<void> {
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
}
