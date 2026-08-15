import { describe, it, expect } from 'vitest';
import { STANDARD_SCREEN_ANGLES, HalftoneEngine } from '../src/core/halftone-engine';
import { MOCKUP_SCENES, MockupRenderer } from '../src/engines/mockup-renderer';
import { SoundEffects } from '../src/core/sound-effects';
import { RulerCalibrationModal } from '../src/ui/ruler-calibration';
import { store } from '../src/ui/state';

describe('HalftoneEngine (Screen Angles & Rosette Pattern)', () => {
  it('should match ISO pre-press standard screen angles', () => {
    expect(STANDARD_SCREEN_ANGLES.cyan).toBeCloseTo(15 * (Math.PI / 180), 5);
    expect(STANDARD_SCREEN_ANGLES.magenta).toBeCloseTo(75 * (Math.PI / 180), 5);
    expect(STANDARD_SCREEN_ANGLES.yellow).toBeCloseTo(0, 5);
    expect(STANDARD_SCREEN_ANGLES.black).toBeCloseTo(45 * (Math.PI / 180), 5);
  });

  it('should expose renderHalftonePatch method', () => {
    expect(typeof HalftoneEngine.renderHalftonePatch).toBe('function');
  });
});

describe('MockupRenderer', () => {
  it('should provide 3 distinct physical mockup scenes', () => {
    expect(MOCKUP_SCENES.length).toBe(3);
    const sceneIds = MOCKUP_SCENES.map((s) => s.id);
    expect(sceneIds).toContain('gallery');
    expect(sceneIds).toContain('desk');
    expect(sceneIds).toContain('card_hand');
  });

  it('should have descriptive metadata and icons for each scene', () => {
    MOCKUP_SCENES.forEach((scene) => {
      expect(scene.name.length).toBeGreaterThan(0);
      expect(scene.desc.length).toBeGreaterThan(0);
      expect(scene.icon.length).toBeGreaterThan(0);
    });
  });

  it('should expose renderScene method', () => {
    expect(typeof MockupRenderer.renderScene).toBe('function');
  });
});

describe('RulerCalibration (Physical 1:1 Scale)', () => {
  it('should have standard credit card millimeter dimensions (ISO/IEC 7810 ID-1)', () => {
    expect(RulerCalibrationModal.CARD_WIDTH_MM).toBeCloseTo(85.60, 2);
    expect(RulerCalibrationModal.CARD_HEIGHT_MM).toBeCloseTo(53.98, 2);
  });

  it('should calculate PPI from on-screen pixel card width accurately', () => {
    // For a 96 PPI display: (85.6mm / 25.4) * 96 ≈ 323.5px
    const cardPx = 324;
    const computedPpi = (cardPx / RulerCalibrationModal.CARD_WIDTH_MM) * 25.4;
    expect(computedPpi).toBeCloseTo(96.15, 1);
  });
});

describe('StateStore (Batch Queue & 1:1 Scale & Smart Crop)', () => {
  it('should toggle 1:1 physical scale state', () => {
    const initial = store.getState().is1to1Scale;
    const toggled = store.toggle1to1Scale();
    expect(toggled).toBe(!initial);
    const restored = store.toggle1to1Scale();
    expect(restored).toBe(initial);
  });

  it('should manage batch queue items and active selection', () => {
    store.reset();
    expect(store.getState().batchItems.length).toBe(0);

    const dummyItem = {
      id: 'test-item-1',
      name: 'Artwork 1',
      originalDataUrl: 'data:image/png;base64,dummy',
      originalImageData: {} as any,
      originalWidth: 800,
      originalHeight: 600,
      status: 'idle' as const
    };

    store.addBatchItem(dummyItem);
    expect(store.getState().batchItems.length).toBe(1);
    expect(store.getState().activeBatchId).toBe('test-item-1');

    store.setCropAnchor('top');
    expect(store.getState().cropAnchor).toBe('top');

    store.removeBatchItem('test-item-1');
    expect(store.getState().batchItems.length).toBe(0);
  });
});

describe('SoundEffects', () => {
  it('should toggle mute state reliably', () => {
    const initial = SoundEffects.getIsMuted();
    const toggled = SoundEffects.toggleMute();
    expect(toggled).toBe(!initial);
    const restored = SoundEffects.toggleMute();
    expect(restored).toBe(initial);
  });

  it('should gracefully handle sound triggers without crashing in headless environment', () => {
    expect(() => {
      SoundEffects.paperDrop();
      SoundEffects.laserScan();
      SoundEffects.sliderTick();
      SoundEffects.purityChime();
      SoundEffects.shutterClick();
    }).not.toThrow();
  });
});
