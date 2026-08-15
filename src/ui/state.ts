import type {
  BatchItem,
  CloudHealthStatus,
  CropAnchor,
  CropOffset,
  DpiAnalysis,
  EngineMode,
  ImagePixelStats,
  InkAnalysis,
  PaperType,
  PrintPreset,
  PrintPresetId,
  PrintScoreResult
} from '../types';
import { DEFAULT_PRESET, getPresetById } from '../core/presets';

export interface AppState {
  // Active Image Sources
  originalDataUrl: string | null;
  originalImageData: ImageData | null;
  originalStats: ImagePixelStats | null;
  originalWidth: number;
  originalHeight: number;

  // Active Processed Output
  processedDataUrl: string | null;
  processedImageData: ImageData | null;
  processedStats: ImagePixelStats | null;
  processedWidth: number;
  processedHeight: number;

  // Analysis
  dpiAnalysis: DpiAnalysis | null;
  inkAnalysis: InkAnalysis | null;
  scoreResult: PrintScoreResult | null;

  // Batch Studio Queue
  batchItems: BatchItem[];
  activeBatchId: string | null;

  // Physical 1:1 Scale & PPI Calibration
  screenPpi: number;
  is1to1Scale: boolean;

  // Smart Focal Crop
  cropAnchor: CropAnchor;
  cropOffset: CropOffset;

  // Hybrid Dual-Engine Architecture
  engineMode: EngineMode;
  cloudStatus: CloudHealthStatus;

  // Settings & Modes
  currentPreset: PrintPreset;
  selectedPaper: PaperType;
  showHeatmap: boolean;
  showSoftProof: boolean;
  showSafeZone: boolean;
  isComparing: boolean;
  isProcessing: boolean;
  processingStep: string;
  appliedScale: number;
}

type Listener = (state: AppState) => void;

function loadStoredPpi(): number {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('printmagic_screen_ppi');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 30 && parsed < 600) {
        return parsed;
      }
    }
  }
  return 96; // Standard default desktop display PPI
}

class StateStore {
  private state: AppState = {
    originalDataUrl: null,
    originalImageData: null,
    originalStats: null,
    originalWidth: 0,
    originalHeight: 0,

    processedDataUrl: null,
    processedImageData: null,
    processedStats: null,
    processedWidth: 0,
    processedHeight: 0,

    dpiAnalysis: null,
    inkAnalysis: null,
    scoreResult: null,

    batchItems: [],
    activeBatchId: null,

    screenPpi: loadStoredPpi(),
    is1to1Scale: false,

    cropAnchor: 'center',
    cropOffset: {
      anchor: 'center',
      offsetXPercent: 0,
      offsetYPercent: 0
    },

    engineMode: 'local',
    cloudStatus: 'offline',

    currentPreset: DEFAULT_PRESET,
    selectedPaper: 'glossy',
    showHeatmap: false,
    showSoftProof: false,
    showSafeZone: true,
    isComparing: false,
    isProcessing: false,
    processingStep: '',
    appliedScale: 1
  };

  private listeners: Set<Listener> = new Set();

  public getState(): AppState {
    return this.state;
  }

  public setState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // --- Hybrid Dual-Engine Actions ---

  public toggleEngineMode(): EngineMode {
    const next: EngineMode = this.state.engineMode === 'local' ? 'cloud' : 'local';
    this.setState({ engineMode: next });
    return next;
  }

  public setEngineMode(mode: EngineMode): void {
    this.setState({ engineMode: mode });
  }

  // --- Preset & Paper Actions ---

  public setPreset(presetId: PrintPresetId): void {
    const preset = getPresetById(presetId);
    this.setState({ currentPreset: preset });
  }

  public setPaper(paper: PaperType): void {
    this.setState({ selectedPaper: paper });
  }

  // --- View Mode Toggles ---

  public toggleHeatmap(): void {
    this.setState({ showHeatmap: !this.state.showHeatmap });
  }

  public toggleSoftProof(): void {
    this.setState({ showSoftProof: !this.state.showSoftProof });
  }

  public toggleSafeZone(): void {
    this.setState({ showSafeZone: !this.state.showSafeZone });
  }

  public toggleComparing(): void {
    this.setState({ isComparing: !this.state.isComparing });
  }

  public toggle1to1Scale(): boolean {
    const next = !this.state.is1to1Scale;
    this.setState({ is1to1Scale: next });
    return next;
  }

  public setScreenPpi(ppi: number): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('printmagic_screen_ppi', ppi.toFixed(2));
    }
    this.setState({ screenPpi: ppi });
  }

  // --- Smart Crop Actions ---

  public setCropAnchor(anchor: CropAnchor): void {
    let offsetXPercent = 0;
    let offsetYPercent = 0;

    if (anchor === 'top') offsetYPercent = -25;
    else if (anchor === 'bottom') offsetYPercent = 25;
    else if (anchor === 'left') offsetXPercent = -25;
    else if (anchor === 'right') offsetXPercent = 25;

    this.setState({
      cropAnchor: anchor,
      cropOffset: { anchor, offsetXPercent, offsetYPercent }
    });
  }

  // --- Batch Studio Queue Actions ---

  public addBatchItem(item: BatchItem): void {
    const exists = this.state.batchItems.some((b) => b.id === item.id);
    const newItems = exists
      ? this.state.batchItems.map((b) => (b.id === item.id ? item : b))
      : [...this.state.batchItems, item];

    this.setState({
      batchItems: newItems,
      activeBatchId: item.id
    });
  }

  public addBatchItems(items: BatchItem[]): void {
    const newItems = [...this.state.batchItems, ...items];
    const activeId = items.length > 0 ? items[0].id : this.state.activeBatchId;
    this.setState({
      batchItems: newItems,
      activeBatchId: activeId
    });
  }

  public updateBatchItem(id: string, updates: Partial<BatchItem>): void {
    const newItems = this.state.batchItems.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    this.setState({ batchItems: newItems });
  }

  public removeBatchItem(id: string): void {
    const remaining = this.state.batchItems.filter((b) => b.id !== id);
    if (remaining.length === 0) {
      this.reset();
    } else {
      let nextActiveId = this.state.activeBatchId;
      if (this.state.activeBatchId === id) {
        nextActiveId = remaining[0].id;
      }
      this.setState({
        batchItems: remaining,
        activeBatchId: nextActiveId
      });
      // Load next active item
      const nextActive = remaining.find((b) => b.id === nextActiveId);
      if (nextActive) {
        this.loadBatchItemIntoActive(nextActive);
      }
    }
  }

  public selectBatchItem(id: string): void {
    const target = this.state.batchItems.find((b) => b.id === id);
    if (target) {
      this.setState({ activeBatchId: id });
      this.loadBatchItemIntoActive(target);
    }
  }

  public loadBatchItemIntoActive(item: BatchItem): void {
    this.setState({
      originalDataUrl: item.originalDataUrl,
      originalImageData: item.originalImageData,
      originalWidth: item.originalWidth,
      originalHeight: item.originalHeight,
      processedDataUrl: item.processedDataUrl || null,
      processedImageData: item.processedImageData || null,
      processedWidth: item.processedWidth || 0,
      processedHeight: item.processedHeight || 0,
      dpiAnalysis: item.dpiAnalysis || null,
      inkAnalysis: item.inkAnalysis || null,
      scoreResult: item.scoreResult || null,
      appliedScale: item.appliedScale || 1,
      cropAnchor: item.cropOffset?.anchor || 'center'
    });
  }

  public reset(): void {
    this.setState({
      originalDataUrl: null,
      originalImageData: null,
      originalStats: null,
      originalWidth: 0,
      originalHeight: 0,
      processedDataUrl: null,
      processedImageData: null,
      processedStats: null,
      processedWidth: 0,
      processedHeight: 0,
      dpiAnalysis: null,
      inkAnalysis: null,
      scoreResult: null,
      batchItems: [],
      activeBatchId: null,
      showHeatmap: false,
      showSoftProof: false,
      isComparing: false,
      isProcessing: false,
      processingStep: '',
      appliedScale: 1,
      is1to1Scale: false,
      cropAnchor: 'center'
    });
  }
}

export const store = new StateStore();
