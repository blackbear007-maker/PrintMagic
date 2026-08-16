import { describe, it, expect } from 'vitest';
import { FOIL_CRAFT_OPTIONS } from '../src/core/foil-simulator';

describe('FoilSimulator Craft Options', () => {
  it('should provide complete set of luxury craft effects', () => {
    expect(FOIL_CRAFT_OPTIONS.length).toBe(6);

    const gold = FOIL_CRAFT_OPTIONS.find((o) => o.type === 'gold');
    expect(gold).toBeDefined();
    expect(gold?.nameZh).toContain('經典亮金');

    const spotUv = FOIL_CRAFT_OPTIONS.find((o) => o.type === 'spot-uv');
    expect(spotUv).toBeDefined();
    expect(spotUv?.tagZh).toContain('水晶凸字');

    const holo = FOIL_CRAFT_OPTIONS.find((o) => o.type === 'holographic');
    expect(holo).toBeDefined();
    expect(holo?.tagZh).toContain('彩虹全息');
  });
});
