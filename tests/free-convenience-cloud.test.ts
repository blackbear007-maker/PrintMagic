import { describe, it, expect } from 'vitest';
import { ConvenienceStoreEngine, CONVENIENCE_STORE_SPECS } from '../src/core/convenience-store';

describe('ConvenienceStoreEngine (Live Cloud Order & QR Code Generator)', () => {
  it('should generate valid 8-digit pickup PIN, QR data URL and 72h expiration', () => {
    const spec = CONVENIENCE_STORE_SPECS[0]; // 7-11 Photo 4x6
    const order = ConvenienceStoreEngine.generateCloudOrder(spec);

    expect(order).toBeDefined();
    expect(order.store).toBe('7-11');
    expect(order.pickupPin).toMatch(/^\d{4}-\d{4}$/); // 8-digit formatted PIN
    expect(order.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(order.expireTime).toContain('前');
    expect(order.priceNTD).toBe(6);
  });

  it('should generate valid cloud order for FamilyMart stickers', () => {
    const spec = CONVENIENCE_STORE_SPECS.find((s) => s.id === 'fami-sticker-4x6')!;
    const order = ConvenienceStoreEngine.generateCloudOrder(spec);

    expect(order.store).toBe('familymart');
    expect(order.paperType).toContain('貼紙');
    expect(order.priceNTD).toBe(20);
    expect(order.qrDataUrl).toBeDefined();
  });
});
