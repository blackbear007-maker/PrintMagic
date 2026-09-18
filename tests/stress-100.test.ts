import { describe, it, expect } from 'vitest';
import { run100StressTests } from '../scripts/stress-test-100';

describe('100-Run Multi-Paradigm Stress Benchmark (simulated post-processing score)', () => {
  it(
    'should successfully execute all 100 extreme pre-press test scenarios with 0 anomalies and strict score monotonicity',
    async () => {
      const { results, summary } = await run100StressTests();

      expect(results.length).toBe(100);
      expect(summary.allAnomalies.length).toBe(0);

      // Verify every single run improves or maintains score (monotonic non-decreasing)
      for (const res of results) {
        expect(res.postScore).toBeGreaterThanOrEqual(res.preScore);
        expect(res.preScore).toBeGreaterThanOrEqual(0);
        expect(res.postScore).toBeLessThanOrEqual(100);
        // Per-run wall-clock limits only under PERF_GUARD: parallel test threads make them flaky.
        if (process.env.PERF_GUARD) expect(res.totalTimeMs).toBeLessThan(1800);
      }

      // Always-on aggregate guard with generous headroom: catches pathological slowdowns.
      const medianMs = results.map((r) => r.totalTimeMs).sort((a, b) => a - b)[Math.floor(results.length / 2)];
      expect(medianMs).toBeLessThan(5400);
    },
    60000 // 60s timeout for 100 heavy procedural runs
  );
});
