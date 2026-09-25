import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/ui/state';
import { DiagnosticCard } from '../src/ui/diagnostic-card';
import { PIPELINE_ITEMS } from '../src/ui/pipeline-matrix-modal';
import { DEFAULT_PRESET, detectBestPreset, getPresetById } from '../src/core/presets';
import type { DpiAnalysis, PrintScoreResult } from '../src/types';

describe('UI Mode (Simple vs Advanced) & Diagnostic Rendering', () => {
  let mockStorage: Record<string, string> = {};
  const elementsMap: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    // @ts-ignore
    global.localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    } as any;

    const createMockElement = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        id: '',
        innerHTML: '',
        style: {},
        classList: {
          add: () => {},
          remove: () => {},
          toggle: () => {}
        },
        querySelector: (sel: string) => {
          if (sel.startsWith('#')) {
            return elementsMap[sel.slice(1)] || null;
          }
          return null;
        },
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        appendChild: (child: any) => child,
        remove: () => {}
      };
      return el;
    };

    // @ts-ignore
    global.document = {
      createElement: (tag: string) => createMockElement(tag),
      getElementById: (id: string) => elementsMap[id] || null,
      body: createMockElement('body')
    } as any;

    store.setUiMode('simple');
  });

  it('should default to beginner-friendly simple mode on first load, and restore a saved choice', async () => {
    // 2026-09-26: beforeEach sets 'simple', so asserting the shared store proved nothing. Load the
    // state module fresh against empty / pre-filled storage instead.
    localStorage.clear();
    vi.resetModules();
    expect((await import('../src/ui/state')).store.getState().uiMode).toBe('simple');

    localStorage.setItem('printmagic_ui_mode', 'advanced');
    vi.resetModules();
    expect((await import('../src/ui/state')).store.getState().uiMode).toBe('advanced');
  });

  it('should switch between simple and advanced modes and persist', () => {
    store.setUiMode('advanced');
    expect(store.getState().uiMode).toBe('advanced');
    expect(localStorage.getItem('printmagic_ui_mode')).toBe('advanced');

    const toggled = store.toggleUiMode();
    expect(toggled).toBe('simple');
    expect(store.getState().uiMode).toBe('simple');
  });

  it('simple mode shows only the before/after score and one download; advanced adds the processing switches', () => {
    const dummyContainer = document.createElement('div');
    dummyContainer.id = 'testDiagCardRoot';
    elementsMap['testDiagCardRoot'] = dummyContainer;
    document.body.appendChild(dummyContainer);

    const card = new DiagnosticCard('testDiagCardRoot');

    const mockScore: PrintScoreResult = {
      score: 96,
      verdict: '極致清晰，達到展覽級印刷標準',
      level: 'high',
      breakdown: {
        resolution: 100,
        aspectRatio: 95,
        brightness: 90,
        saturation: 90,
        contrast: 90,
        sharpness: 95
      },
      issues: [],
      recommendations: []
    };

    const mockDpi: DpiAnalysis = {
      currentDpi: 300,
      targetDpi: 300,
      qualityTier: 'excellent',
      scaleFactor: 1,
      needsUpscale: false,
      widthPx: 2480,
      heightPx: 3508,
      targetWidthPx: 2480,
      targetHeightPx: 3508,
      message: '解析度完美'
    };

    const state = {
      ...store.getState(),
      scoreResult: mockScore,
      originalScoreResult: { ...mockScore, score: 71 },
      dpiAnalysis: mockDpi,
      currentPreset: DEFAULT_PRESET,
      uiMode: 'simple' as const
    };

    card.render(state);

    const html = dummyContainer.innerHTML;
    expect(html).toContain('pm-panel-simple');
    expect(html).toContain('修正前');
    expect(html).toContain('>71<');
    expect(html).toContain('修正後');
    expect(html).toContain('>96<');
    expect(html).toContain('下載印刷檔 (PDF)');
    // Simple mode doesn't explain or expose what was changed.
    expect(html).not.toContain('pipeline-checkbox');
    expect(html).not.toContain('TAC');
    expect(html).not.toContain('DPI');
    expect((html.match(/<button/g) || []).length).toBe(1);

    // Advanced mode: same card, now with a switch for every processing step.
    card.render({ ...state, uiMode: 'advanced' });
    const advHtml = dummyContainer.innerHTML;
    expect(advHtml).toContain('pm-panel-advanced');
    expect(advHtml).toContain('實體解析度');
    // The TAC pill/tile/switch are gone (2026-09-26): their model could never exceed 200%.
    expect(advHtml).not.toContain('總墨量 TAC');
    for (const item of PIPELINE_ITEMS) {
      expect(advHtml).toContain(`class="pipeline-checkbox" data-key="${item.key}"`);
    }

    // Advanced descriptions follow the real switch states instead of claiming every step ran.
    const allOn = dummyContainer.innerHTML;
    expect(allOn).toContain('USM 銳化');
    expect(allOn).not.toContain('總墨量');
    expect(allOn).not.toContain('CMYK 色階校正');
    card.render({
      ...state,
      uiMode: 'advanced',
      pipelineOptions: { ...state.pipelineOptions, enableSharpening: false }
    });
    const someOff = dummyContainer.innerHTML;
    expect(someOff).not.toContain('USM 銳化');

    dummyContainer.remove();
  });

  it('should auto-detect preset on image upload and allow user to switch preset', () => {
    // 1. Verify preset auto-detection for standard aspect ratios
    const squareDetection = detectBestPreset(800, 800);
    expect(squareDetection.id).toBe('sticker');

    const a4Detection = detectBestPreset(2480, 1754);
    expect(a4Detection.id).toBe('poster-a4');

    const cardDetection = detectBestPreset(1060, 636);
    expect(cardDetection.id).toBe('business-card');

    // 2. Set preset to auto-detected preset
    store.setPreset(a4Detection.id);
    expect(store.getState().currentPreset.id).toBe('poster-a4');

    // 3. User manually switches preset
    store.setPreset('postcard');
    expect(store.getState().currentPreset.id).toBe('postcard');
    const switched = getPresetById('postcard');
    expect(switched.widthMm).toBe(148);
    expect(switched.heightMm).toBe(100);
  });
});
