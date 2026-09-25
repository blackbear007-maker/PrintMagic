import { describe, it, expect } from 'vitest';
import {
  ICC_PROFILE_SPECS,
  IccProfileEngine
} from '../src/core/icc-profiles';

describe('IccProfileEngine (International ICC Profiles)', () => {
  it('should define 4 core global ICC standards', () => {
    expect(ICC_PROFILE_SPECS.length).toBe(4);

    const japanCoated = ICC_PROFILE_SPECS.find((p) => p.id === 'japan-color-2001-coated')!;
    expect(japanCoated).toBeDefined();
    expect(japanCoated.maxTac).toBe(350);
    expect(japanCoated.isDefault).toBe(true);

    const isoFogra = ICC_PROFILE_SPECS.find((p) => p.id === 'iso-coated-v2-fogra39')!;
    expect(isoFogra).toBeDefined();
    // Max. total ink from Adobe's Profile Information for the profiles /icc/to-cmyk separates with (2026-09-25).
    expect(isoFogra.maxTac).toBe(330);

    const gracol = ICC_PROFILE_SPECS.find((p) => p.id === 'gracol-2006-coated')!;
    expect(gracol).toBeDefined();
    expect(gracol.maxTac).toBe(340);

    const uncoated = ICC_PROFILE_SPECS.find((p) => p.id === 'japan-color-2001-uncoated')!;
    expect(uncoated).toBeDefined();
    expect(uncoated.maxTac).toBe(310);
  });

  it('should evaluate TAC threshold clamping per profile', () => {
    const engine = new IccProfileEngine();
    engine.setProfile('iso-coated-v2-fogra39'); // maxTac = 330

    expect(engine.isTacExceeded(320)).toBe(false);
    expect(engine.isTacExceeded(340)).toBe(true);

    engine.setProfile('japan-color-2001-uncoated'); // maxTac = 310
    expect(engine.isTacExceeded(300)).toBe(false);
    expect(engine.isTacExceeded(320)).toBe(true);
  });
});
