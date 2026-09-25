import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The pipeline swallows crashes in its catch block (it only toasts), so every test also checks that
// Toast.error / console.error were never called — otherwise a crash after the store update looks fine.
vi.mock('../src/ui/toast', () => ({
  Toast: { show: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));
// OCR (tesseract.js) is fire-and-forget after the run; not what this test is about.
vi.mock('../src/core/text-inspector', () => ({
  TextInspector: {
    inspectImage: vi.fn(async () => ({ regions: [], totalWords: 0, typoCount: 0, hasIssues: false, summary: '', executionTimeMs: 0 }))
  }
}));

import { PipelineOrchestrator } from '../src/core/pipeline-orchestrator';
import { store } from '../src/ui/state';
import { getPresetById } from '../src/core/presets';
import { workerClient } from '../src/workers/worker-client';
import { SceneClassifier, type SceneCategory } from '../src/core/scene-classifier';
import { DpiCalculator } from '../src/core/dpi-calculator';
import { FreeMattingClient } from '../src/services/free-matting-client';
import { TextInspector } from '../src/core/text-inspector';
import { Toast } from '../src/ui/toast';
import { SoftCanvas } from './helpers/soft-canvas';
import type { BatchItem } from '../src/types';

// First coverage of runOptimizationPipeline itself (2026-09-26): the before/after scores the app shows
// come from here, and several real bugs lived in the glue between its steps.

const scene = (category: SceneCategory) =>
  ({
    category,
    categoryNameZh: '',
    categoryIcon: '',
    confidence: 1,
    detectedTraits: [],
    recommendedPipeline: { superResolutionModel: '', outpaintingModel: '', specialCraft: '', reasonZh: '' }
  }) as ReturnType<typeof SceneClassifier.classifyImage>;

/** High-contrast random blocks: realistic edges, and AntiBanding exits its smooth-area scan early. */
function blocks(w: number, h: number, seed = 1): ImageData {
  const img = new ImageData(w, h);
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = rnd() < 0.5 ? 30 : 220;
    img.data[i + 1] = rnd() < 0.5 ? 30 : 220;
    img.data[i + 2] = rnd() < 0.5 ? 30 : 220;
    img.data[i + 3] = 255;
  }
  return img;
}

const item = (id: string, img: ImageData): BatchItem => ({
  id,
  name: id,
  originalDataUrl: 'data:,',
  originalImageData: img,
  originalWidth: img.width,
  originalHeight: img.height,
  status: 'idle'
});

let fetchSpy: ReturnType<typeof vi.fn>;
let deps: { laser: any; ds: any; xiang: any; reset: any };
let orch: PipelineOrchestrator;

beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error('network used in local mode');
  });
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('document', { createElement: () => new SoftCanvas() });
  vi.spyOn(SceneClassifier, 'classifyImage').mockReturnValue(scene('food')); // no EdgeAware/LineArt/low-light
  vi.spyOn(console, 'error');
  store.reset();
  store.resetPipelineOptions();
  store.setState({
    engineMode: 'local',
    uiMode: 'simple',
    currentPreset: getPresetById('poster-a4'),
    remoteServices: null,
    remoteCheckedAt: 0
  });
  deps = {
    laser: { triggerScan: vi.fn(async () => {}), triggerMagicReveal: vi.fn(async () => {}) },
    ds: { setFrontImage: vi.fn() },
    xiang: { say: vi.fn() },
    reset: vi.fn()
  };
  orch = new PipelineOrchestrator(deps.laser, deps.ds, deps.xiang, deps.reset);
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled(); // local mode: no network, in every test
  expect(Toast.error).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PipelineOrchestrator.runOptimizationPipeline (end to end, local engine)', () => {
  it('upscales, adds bleed in the image orientation, and scores the result on source detail', async () => {
    const src = blocks(240, 170); // landscape, ~21 DPI on A4
    store.addBatchItem(item('a', src));
    store.selectBatchItem('a'); // what the upload handler does (loadBatchItemIntoActive)
    await orch.runOptimizationPipeline(src);
    const s = store.getState();

    const before = DpiCalculator.analyze(240, 170, s.currentPreset);
    expect(s.originalDpiAnalysis).toMatchObject({ currentDpi: before.currentDpi, scaleFactor: 8, needsUpscale: true });
    expect(s.originalScoreResult!.effectiveDpi).toBe(before.currentDpi);

    // Lanczos 8x = 1920x1360; trim turned landscape (297x210) -> bleed round(1920/297*3) = round(1360/210*3) = 19.
    // With the preset's portrait orientation it would be 27 / 16.
    expect([(s.processedWidth - 1920) / 2, (s.processedHeight - 1360) / 2]).toEqual([19, 19]);
    expect(s.processedImageData!.width).toBe(s.processedWidth);
    expect(s.appliedScale).toBeCloseTo(s.processedWidth / 240, 10);

    // After-score: detail DPI = source DPI x 1.5 (interpolation), not the upscaled pixel DPI.
    expect(s.dpiAnalysis!.currentDpi).toBeGreaterThan(150);
    expect(s.scoreResult!.effectiveDpi).toBe(Math.round(before.currentDpi * 1.5));
    expect(s.scoreResult!.score).toBeLessThanOrEqual(Math.round(50 + 34 * (s.scoreResult!.effectiveDpi! / 140)));

    expect(s).toMatchObject({ isProcessing: false, processingStep: '' });
    expect(s.batchItems[0]).toMatchObject({ status: 'done', processedWidth: s.processedWidth, processedHeight: s.processedHeight });

    // 2026-09-24 bug: the right and bottom bleed strips came out fully transparent.
    const { data, width, height } = s.processedImageData!;
    let transparent = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if ((x >= width - 19 || y >= height - 19) && data[(y * width + x) * 4 + 3] === 0) transparent++;
    expect(transparent).toBe(0);

    // OCR boxes are computed in the processed image's coordinate space.
    expect(TextInspector.inspectImage).toHaveBeenCalledWith(s.processedImageData);
    expect(deps.ds.setFrontImage).toHaveBeenCalledWith(s.processedDataUrl, s.processedImageData);
  });

  it('replays manual edits on every re-run (cached) and keeps them per batch item', async () => {
    const a = blocks(96, 68, 3);
    const b = blocks(80, 57, 4);
    store.addBatchItems([item('A', a), item('B', b)]);
    store.selectBatchItem('A');
    const deblock = vi.spyOn(workerClient, 'deblock');
    const matting = vi.spyOn(FreeMattingClient, 'removeBackground');

    store.setSourceEdit('deblock', true);
    store.setSourceEdit('removeBg', true);
    await orch.runOptimizationPipeline(a);
    expect(deblock).toHaveBeenCalledTimes(1);
    expect(deblock.mock.calls[0][0]).toBe(a); // on the source, before upscaling
    expect(matting).toHaveBeenCalledTimes(1);

    // A re-run (e.g. a pipeline switch) used to drop manual results; now it replays them, and the
    // deblock result comes from the cache.
    store.setPipelineOption('enableSharpening', false);
    await orch.runOptimizationPipeline(store.getState().originalImageData!);
    expect(store.getState().sourceEdits).toMatchObject({ deblock: true, removeBg: true });
    expect(store.getState().manualEnhancementsApplied.jpegDeblock).toBe(true);
    expect(deblock).toHaveBeenCalledTimes(1);
    expect(matting).toHaveBeenCalledTimes(2);

    // Edits belong to the image: B starts clean, and A's come back when it is selected again.
    store.selectBatchItem('B');
    expect(store.getState().sourceEdits).toEqual({ deblock: false, descreen: false, removeBg: false });
    store.selectBatchItem('A');
    expect(store.getState().sourceEdits).toMatchObject({ deblock: true, removeBg: true });

    // Pressing the tool again removes the edit.
    store.setSourceEdit('removeBg', false);
    await orch.runOptimizationPipeline(a);
    expect(matting).toHaveBeenCalledTimes(2);
  });

  it('crops 2 吋證件照 in the pipeline, before choosing the upscale, and keeps it on re-runs', async () => {
    store.setState({ currentPreset: getPresetById('id-photo') });
    const src = blocks(300, 200, 5); // landscape; the preset is 35 x 45 mm portrait
    store.addBatchItem(item('p', src));
    store.selectBatchItem('p');

    for (let run = 0; run < 2; run++) {
      await orch.runOptimizationPipeline(src);
      const s = store.getState();
      // No bleed for this preset, so the processed image is exactly the upscaled crop: 35:45.
      expect(s.processedWidth / s.processedHeight).toBeCloseTo(35 / 45, 2);
      // Upscale factor chosen from the cropped size, so the result reaches ~300 DPI.
      expect(s.dpiAnalysis!.currentDpi).toBeGreaterThanOrEqual(280);
    }
    // Local mode: face detection is unavailable, so it falls back to a centre crop and says so.
    expect(Toast.success).toHaveBeenCalledWith(expect.stringContaining('置中裁切'));
  });

  it('abandons a run that a newer one supersedes mid-way', async () => {
    vi.mocked(SceneClassifier.classifyImage).mockReturnValue(scene('landscape')); // EdgeAware doubles
    const A = blocks(90, 64, 1);
    const B = blocks(30, 21, 2);
    store.addBatchItems([item('A', A), item('B', B)]);
    store.selectBatchItem('A');

    const realLanczos = workerClient.lanczos.bind(workerClient);
    let runB!: Promise<void>;
    vi.spyOn(workerClient, 'lanczos').mockImplementationOnce(async (img, scale) => {
      store.selectBatchItem('B');
      runB = orch.runOptimizationPipeline(B);
      return realLanczos(img, scale);
    });
    const idleSnapshots: number[] = [];
    const unsubscribe = store.subscribe((st) => {
      if (!st.isProcessing) idleSnapshots.push(st.processedWidth);
    });
    await orch.runOptimizationPipeline(A);
    await runB;
    unsubscribe();

    const s = store.getState();
    // B: 30x21 -> Lanczos 8x 240x168 -> EdgeAware 480x336 -> bleed clamped to 16 px -> 512x368.
    expect([s.processedWidth, s.processedHeight]).toEqual([512, 368]);
    const itemA = s.batchItems.find((x) => x.id === 'A')!;
    expect(itemA.status).toBe('idle');
    expect(itemA.processedWidth).toBeUndefined(); // the superseded run never wrote its result
    expect(s.batchItems.find((x) => x.id === 'B')).toMatchObject({ status: 'done', processedWidth: 512 });
    expect(idleSnapshots.filter((w) => w > 0).every((w) => w === 512)).toBe(true); // A never wrote its result
    expect(deps.ds.setFrontImage).toHaveBeenCalledTimes(1);
  });
});
