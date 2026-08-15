import { describe, it, expect } from 'vitest';
import { run480StressTests } from '../scripts/stress-test-480';

describe('48-Category 480-Sample Multi-Paradigm Comprehensive Benchmark', () => {
  it(
    'should successfully execute all 480 samples across 48 AI categories with 0 anomalies and strict score monotonicity',
    async () => {
      const { results, summary } = await run480StressTests();

      expect(results.length).toBe(480);
      expect(summary.allAnomalies.length).toBe(0);

      // Verify every single run improves or maintains score (monotonic non-decreasing)
      for (const res of results) {
        expect(res.postScore).toBeGreaterThanOrEqual(res.preScore);
        expect(res.preScore).toBeGreaterThanOrEqual(0);
        expect(res.postScore).toBeLessThanOrEqual(100);
        expect(isNaN(res.preScore)).toBe(false);
        expect(isNaN(res.postScore)).toBe(false);
        expect(res.totalTimeMs).toBeLessThan(2000); // 2s max guard
      }
    },
    180000 // 3 min timeout
  );
});
