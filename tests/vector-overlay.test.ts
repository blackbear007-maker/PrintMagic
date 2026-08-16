import { describe, it, expect } from 'vitest';
import { VectorOverlayEngine } from '../src/core/vector-overlay';

describe('VectorOverlayEngine (K100 Pure Black & Vector Logo Overlay)', () => {
  it('should add K100 text item and track items accurately', () => {
    const engine = new VectorOverlayEngine();
    const item = engine.addText({
      text: 'CREATIVE DESIGN STUDIO',
      xPercent: 10,
      yPercent: 80,
      fontSizePx: 42,
      fontFamily: 'sans-serif',
      isK100: true,
      color: '#000000',
      isOverprint: true
    });

    expect(item.id).toBeDefined();
    expect(item.isK100).toBe(true);
    expect(engine.getTextItems().length).toBe(1);

    engine.removeText(item.id);
    expect(engine.getTextItems().length).toBe(0);
  });

  it('should support vector logo overlays', () => {
    const engine = new VectorOverlayEngine();
    const logo = engine.addLogo({
      dataUrl: 'data:image/svg+xml;base64,dummy',
      xPercent: 5,
      yPercent: 5,
      widthPercent: 20,
      heightPercent: 10
    });

    expect(logo.id).toBeDefined();
    expect(engine.getLogoItems().length).toBe(1);
  });
});
