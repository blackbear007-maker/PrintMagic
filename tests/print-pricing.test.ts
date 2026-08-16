import { describe, it, expect } from 'vitest';
import {
  PrintPricingEngine,
  VENDOR_PRINT_SHOPS,
  COMMERCIAL_PAPER_OPTIONS,
  STANDARD_QUANTITY_TIERS
} from '../src/core/print-pricing';

describe('Print Pricing Engine (Taiwan Commercial Print Shops)', () => {
  it('should calculate accurate quotes for all 4 major vendors', () => {
    for (const shop of VENDOR_PRINT_SHOPS) {
      const quote = PrintPricingEngine.calculateQuote(shop.id, 'poster-a4', '250g-matte', 50);

      expect(quote.shopId).toBe(shop.id);
      expect(quote.totalPriceNTD).toBeGreaterThan(50);
      expect(quote.totalPriceNTD).toBeLessThan(1000);
      expect(quote.unitPriceNTD).toBeGreaterThan(0);
      expect(quote.leadTimeDays).toBeGreaterThanOrEqual(1);
      expect(typeof quote.leadTimeFormatted).toBe('string');
    }
  });

  it('should apply volume discounts as quantity increases', () => {
    const q10 = PrintPricingEngine.calculateQuote('gainhow', 'poster-a4', '250g-matte', 10);
    const q100 = PrintPricingEngine.calculateQuote('gainhow', 'poster-a4', '250g-matte', 100);
    const q1000 = PrintPricingEngine.calculateQuote('gainhow', 'poster-a4', '250g-matte', 1000);

    // Unit price should decrease as volume increases
    expect(q10.unitPriceNTD).toBeGreaterThan(q100.unitPriceNTD);
    expect(q100.unitPriceNTD).toBeGreaterThan(q1000.unitPriceNTD);
  });

  it('should calculate quotes for all paper options across all presets', () => {
    for (const paper of COMMERCIAL_PAPER_OPTIONS) {
      const quote = PrintPricingEngine.calculateQuote('cardhome', 'postcard', paper.id, 100);
      expect(quote.paperName).toBe(paper.name);
      expect(quote.totalPriceNTD).toBeGreaterThan(0);
    }
  });

  it('should support all standard quantity tiers', () => {
    expect(STANDARD_QUANTITY_TIERS.length).toBeGreaterThan(0);
    for (const qty of STANDARD_QUANTITY_TIERS) {
      const q = PrintPricingEngine.calculateQuote('lange', 'poster-a4', '150g-art', qty);
      expect(q.quantity).toBe(qty);
      expect(q.totalPriceNTD).toBeGreaterThan(0);
    }
  });
});
