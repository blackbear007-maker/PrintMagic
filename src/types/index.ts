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
  | 'social';

export type ColorMode = 'cmyk' | 'rgb' | 'grayscale';

export type PaperType = 'glossy' | 'matte' | 'linen' | 'cotton';

export type ExportFormat = 'pdf' | 'png' | 'jpg' | 'svg';

export type DpiQualityTier = 'excellent' | 'good' | 'warning' | 'critical';

export type CropAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right';

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
