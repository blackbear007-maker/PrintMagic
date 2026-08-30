import { store } from '../ui/state';
import type { LaserScanController } from '../ui/laser-scan';
import type { XiaoxiangAssistant } from '../ui/xiaoxiang-assistant';
import type { DoubleSidedManager } from './double-sided';
import type { VectorOverlayEngine } from './vector-overlay';
import { Toast } from '../ui/toast';
import { SoundEffects } from './sound-effects';
import { DpiCalculator } from './dpi-calculator';
import { PrintScoreCalculator } from './print-score';
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
      const opts = state.pipelineOptions;

      // Step 1: Super-Resolution Upscaling (AI Neural Reconstructor vs Local 8x Pyramid)
      if (opts.enableUpscale && originalDpiAnalysis.needsUpscale && originalDpiAnalysis.scaleFactor > 1) {
        appliedScale = originalDpiAnalysis.scaleFactor;

        const isCloudAiAllowed = state.engineMode === 'cloud' && state.aiUpscaleMode === 'cloud-ai';

        if (isCloudAiAllowed) {
          const srcDataUrl = state.originalDataUrl || this.imageDataToDataUrl(srcImageData);

          store.setState({
            processingStep: '2/4 正在執行邊緣強化 4x 放大演算法...'
          });
          const aiResult = await AiUpscaleClient.upscale(srcDataUrl);

          if (aiResult.success && aiResult.imageData) {
            processedImgData = aiResult.imageData;
            appliedScale = aiResult.scale || 4;
            Toast.success('⚡ 邊緣強化 4x 放大完成！');
          } else {
            // Graceful automatic fallback to local Lanczos-3 8x pyramid engine
            store.setState({
              processingStep: `2/4 正在啟用本機 ${appliedScale}x 金字塔超解析度放大 (0 延遲備援)...`
            });
            processedImgData = await workerClient.lanczos(srcImageData, appliedScale);
            Toast.info('⚡ 已無縫啟用本機 8x 金字塔超解析度引擎！');
          }
        } else {
          // Strictly 100% Local Engine (Zero Network Calls)
          store.setState({
            processingStep: `2/4 正在執行 ${appliedScale}x 本機金字塔超解析度放大 (100% 離線防護)...`
          });
          processedImgData = await workerClient.lanczos(srcImageData, appliedScale);
        }

        // Apply scene-aware algorithmic post-enhancement (deterministic filters, not neural models)
        const scene = SceneClassifier.classifyImage(processedImgData);
        if (scene.category === 'anime') {
          processedImgData = LineArtUpscaler.upscaleAnime(processedImgData, 1 as 2);
        } else if (scene.category === 'portrait') {
          const res = EdgeAwareUpscaler.upscale(processedImgData, 2, 0.4);
          processedImgData = res.upscaledImageData;
        } else if (scene.category === 'landscape') {
          const res = EdgeAwareUpscaler.upscale(processedImgData, 2, 0.6);
          processedImgData = res.upscaledImageData;
        }

        // Apply low-light dynamic range boost if scene has low-light or shadow traits
        // (自建 Retinexformer 服務優先，離線時自動退回本機曲線估計演算法)
        if (scene.detectedTraits.some((t: string) => t.includes('暗') || t.includes('曝光') || t.includes('黑'))) {
          const lowlightResult = await FreeLowlightClient.enhance(processedImgData);
          processedImgData = lowlightResult.imageData;
        }
      }

      // Step 1.5: Auto Deshadow & Illumination Field Normalization (手機拍照光照均勻化)
      if (opts.enableDeshadow !== false) {
        processedImgData = HandShadowBalancer.deshadow(processedImgData, 0.70);
      }

      // Step 1.8: Auto Anti-Banding & Gradient Smoothing (漸層防斷階去噪)
      if (opts.enableAntiBanding !== false) {
        processedImgData = AntiBandingFilter.apply(processedImgData, 0.65);
      }

      // Step 2: Pre-press Unsharp Mask Sharpening
      if (opts.enableSharpening) {
        store.setState({
          processingStep: '3/4 正在套用印刷微細邊緣銳化補償 (USM)...'
        });
        processedImgData = await workerClient.unsharp(processedImgData, 1.5, 1, 3);
      }

      // Step 2.5: Pre-press Shadow Tone Recovery (暗部階調防死黑補償)
      if (opts.enableShadowLift) {
        processedImgData = ShadowLift.apply(processedImgData, 0.10);
      }

      // Step 3: Total Area Coverage (TAC) Clamp & Verification
      //
      // ⚠️ 2026-08-29 修正一個真實存在的問題：這裡原本不管使用者在「ICC 描述檔」下拉選單選了哪個
      // 印刷標準，一律寫死用 300% 當總墨量上限——選擇「Japan Color 2001 Uncoated」（該標準宣稱上限
      // 260%，針對容易死黑的美術紙設計）的使用者，實際上還是被放行到 300%，比描述檔自己宣稱的安全
      // 上限多了 40 個百分點；選擇「Japan Color 2001 Coated」（該標準宣稱上限 350%）的使用者，
      // 反而被限制得比描述檔容許的更嚴格。等於這個選單選了等於沒選，完全不影響實際壓墨結果。
      // 已改成讀取目前選取描述檔真正的 `maxTac`。
      if (opts.enableInkLimiting) {
        const activeMaxTac = iccProfileEngine.getActiveProfile().maxTac;
        store.setState({
          processingStep: `4/4 正在檢測並修正總墨量 TAC 限制 (${activeMaxTac}%)...`
        });
        const clampResult = await workerClient.clampInk(processedImgData, activeMaxTac);
        processedImgData = clampResult.imageData;
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
      }

      // Step 4: Post-Processing Comprehensive Diagnostic & Scientific Quality Evaluation
      const { stats, inkAnalysis } = await workerClient.analyze(processedImgData);
      const dpiAnalysis = DpiCalculator.analyze(
        processedImgData.width,
        processedImgData.height,
        preset
      );
      const scoreResult = PrintScoreCalculator.calculate(stats, preset, inkAnalysis);
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

      // Auto-trigger background AI Text Inspection
      void this.runAutoTextInspection(srcImageData);

      // Smart Contextual Action Hints (Learnability & Proactivity)
      if (stats.transparentRatio > 0.03) {
        setTimeout(() => {
          Toast.info('💡 偵測到透明背景！點擊下方【🏷️ 刀模白墨】可一鍵產生貼紙刀模線與白墨層');
        }, 1200);
      }
    } catch (err: any) {
      console.error('Optimization pipeline error:', err);
      store.setState({ isProcessing: false, processingStep: '' });
      if (activeId) {
        store.updateBatchItem(activeId, { status: 'error', errorMessage: err?.message });
      }
      Toast.error(`處理失敗: ${err?.message || err}`);
    }
  }

  public async runAutoTextInspection(imgData: ImageData): Promise<void> {
    try {
      const inspectResult = await TextInspector.inspectImage(imgData);
      store.setTextInspectionResult(inspectResult);
      if (inspectResult.typoCount > 0) {
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
