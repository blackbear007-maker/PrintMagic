import { describe, it, expect } from 'vitest';
import { STANDARD_SCREEN_ANGLES, HalftoneEngine } from '../src/core/halftone-engine';
import { MOCKUP_SCENES, MockupRenderer } from '../src/engines/mockup-renderer';
import { SoundEffects } from '../src/core/sound-effects';
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

describe('StateStore (Batch Queue & Smart Crop)', () => {
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
