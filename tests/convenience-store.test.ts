import { describe, it, expect } from 'vitest';
import {
  CONVENIENCE_STORE_SPECS
} from '../src/core/convenience-store';

describe('ConvenienceStoreEngine (7-11 ibon & FamilyMart FamiPort)', () => {
  it('should define accurate specs for 7-11 4x6 photo paper', () => {
    const spec = CONVENIENCE_STORE_SPECS.find((s) => s.id === '711-photo-4x6')!;
    expect(spec).toBeDefined();
    expect(spec.store).toBe('7-11');
    expect(spec.widthMm).toBe(100);
    expect(spec.heightMm).toBe(148);
    expect(spec.priceNTD).toBe(6);
    expect(spec.nonPrintableMarginMm).toBe(2);
    expect(spec.uploadUrl).toContain('ibon.com.tw');
  });

  it('should define accurate specs for 7-11 A4 special snow copper paper', () => {
    const spec = CONVENIENCE_STORE_SPECS.find((s) => s.id === '711-a4-special')!;
    expect(spec).toBeDefined();
    expect(spec.widthMm).toBe(210);
    expect(spec.heightMm).toBe(297);
    expect(spec.priceNTD).toBe(15);
  });

  it('should define accurate specs for FamilyMart 4x6 sticker paper', () => {
    const spec = CONVENIENCE_STORE_SPECS.find((s) => s.id === 'fami-sticker-4x6')!;
    expect(spec).toBeDefined();
    expect(spec.store).toBe('familymart');
    expect(spec.priceNTD).toBe(20);
  });
});
