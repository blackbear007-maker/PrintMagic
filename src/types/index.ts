/**
 * PrintMagic Type Definitions
 * Professional print shop grade data contracts and interfaces
 */

export type PrintPresetId =
  | 'poster-a4'
  | 'poster-a3'
  | 'postcard'
  | 'business-card'
  | 'sticker'
  | 'social'
  | 'id-photo';

export type ColorMode = 'cmyk' | 'rgb' | 'grayscale';

export type PaperType = 'glossy' | 'matte' | 'linen' | 'cotton';

export type ExportFormat = 'pdf' | 'png' | 'jpg' | 'svg';

export type DpiQualityTier = 'excellent' | 'good' | 'warning' | 'critical';

export type CropAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right';

export type EngineMode = 'local' | 'cloud';

export type UiMode = 'simple' | 'advanced';

export type CloudHealthStatus = 'online' | 'offline' | 'checking';

export interface DetectedTextRegion {
  id: string;
  x: number; // percentage (0 - 100) or pixel coords
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number; // 0.0 - 1.0
  isTypo: boolean;
  typoReason?: string;
  suggestion?: string;
  isBlurry?: boolean;
}

export interface TextInspectionResult {
  regions: DetectedTextRegion[];
  totalWords: number;
  typoCount: number;
  hasIssues: boolean;
  summary: string;
  executionTimeMs: number;
}

export interface CropOffset {
  anchor: CropAnchor;
  offsetXPercent: number; // -50 to +50
  offsetYPercent: number; // -50 to +50
}

export interface ScreenCalibration {
  ppi: number;
  isCalibrated: boolean;
}

export interface BatchItem {
  id: string;
  name: string;
  file?: File;
  originalDataUrl: string;
  originalImageData: ImageData;
  originalWidth: number;
  originalHeight: number;
  originalScoreResult?: PrintScoreResult;
  originalDpiAnalysis?: DpiAnalysis;
  originalInkAnalysis?: InkAnalysis;
  processedDataUrl?: string;
  processedImageData?: ImageData;
  processedWidth?: number;
  processedHeight?: number;
  scoreResult?: PrintScoreResult;
  dpiAnalysis?: DpiAnalysis;
  inkAnalysis?: InkAnalysis;
  stats?: ImagePixelStats;
  appliedScale?: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  cropOffset?: CropOffset;
}

export interface PrintPreset {
  id: PrintPresetId;
  name: string;
  nameZh: string;
  desc: string;
  category: 'commercial' | 'art' | 'digital';
  icon: string;
  widthMm: number;
  heightMm: number;
  targetDpi: number;
  bleedMm: number;
  safeMarginMm: number;
  realWorldRef?: string; // e.g. '≈ 健保卡/信用卡大小'
  colorMode: ColorMode;
  recommendedPaper: PaperType;
  cropMarks: boolean;
  colorBars: boolean;
  registrationMarks: boolean;
}

export interface DpiAnalysis {
  currentDpi: number;
  targetDpi: number;
  qualityTier: DpiQualityTier;
  scaleFactor: number;
  needsUpscale: boolean;
  widthPx: number;
  heightPx: number;
  targetWidthPx: number;
  targetHeightPx: number;
  message: string;
}

export interface InkAnalysis {
  maxTotalInk: number; // percentage (0 - 400%)
  averageTotalInk: number;
  exceededPixelCount: number;
  exceededRatio: number; // 0.0 - 1.0
  hasOverflow: boolean;
  limitThreshold: number; // e.g. 300%
}

export interface ImagePixelStats {
  avgLum: number;
  avgSat: number;
  stdLum: number;
  edgeScore: number;
  transparentRatio: number;
  width: number;
  height: number;
  /** Ratio of pixels outside CMYK printable gamut (0–1). Added in analyzePixels v2. */
  gamutOverflowRatio?: number;
  /** Histogram P95 - P5 luminance spread, true contrast indicator (0–1). Added in analyzePixels v2. */
  dynamicRangeSpread?: number;
}


export interface ScoreBreakdown {
  resolution: number; // 0-100
  aspectRatio: number; // 0-100
  brightness: number; // 0-100
  saturation: number; // 0-100
  contrast: number; // 0-100
  sharpness: number; // 0-100
  inkSafety: number; // 0-100
}

export interface PrintScoreResult {
  score: number; // 0 - 100
  verdict: string;
  level: 'high' | 'mid' | 'low';
  breakdown: ScoreBreakdown;
  issues: string[];
  recommendations: string[];
}

export interface PipelineOptions {
  enableUpscale: boolean;       // 🔍 決定性放大演算法 (Lanczos-3)
  enableSharpening: boolean;    // ✨ USM 微米邊緣銳化補償
  enableInkLimiting: boolean;   // 🎨 TAC 300% 總墨量強制壓制保護
  enableShadowLift: boolean;    // 🌓 暗部階調浮起與反差補償
  enableBleedExpand: boolean;   // 📐 3mm 智慧出血自動補足
  enableColorProofing: boolean; // 🌈 CMYK 描述檔色域映射
  enableVectorOverlay: boolean; // 🔤 自動文字清晰防糊重構
  enableAntiBanding: boolean;   // 🌊 漸層防斷階與抗色階條紋平滑 (Auto)
  enableDeshadow: boolean;      // ☀️ 手機拍畫手機倒影與光照均勻化 (Auto)
  enableDehaze: boolean;        // 🌫️ 去霧 (自建 DehazeFormer-T 服務或本機大氣散射模型)
}

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
  enableUpscale: true,
  enableSharpening: true,
  enableInkLimiting: true,
  enableShadowLift: true,
  enableBleedExpand: true,
  enableColorProofing: true,
  enableVectorOverlay: true,
  enableAntiBanding: true,
  enableDeshadow: true,
  enableDehaze: false
};

export interface OptimizationOptions {
  autoUpscale?: boolean;
  applySharpening?: boolean;
  clampInkLimit?: boolean;
  maxTotalInk?: number;
  targetScale?: number;
}

export interface ProcessedImageData {
  dataUrl: string;
  width: number;
  height: number;
  appliedScale: number;
  stats: ImagePixelStats;
  dpiAnalysis: DpiAnalysis;
  inkAnalysis: InkAnalysis;
  score: PrintScoreResult;
}

export interface WorkerRequest {
  id: string;
  operation: 'lanczos' | 'unsharp' | 'analyze' | 'clampInk' | 'generateHeatmap';
  payload: {
    imageData: {
      width: number;
      height: number;
      data: Uint8ClampedArray;
    };
    scale?: number;
    amount?: number;
    radius?: number;
    threshold?: number;
    maxInk?: number;
  };
}

export interface WorkerResponse {
  id: string;
  success: boolean;
  error?: string;
  result?: any;
  imageData?: {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };
}
