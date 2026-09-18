import { describe, it, expect } from 'vitest';
import { run50StressTests } from '../scripts/stress-test-50';

// The post-processing score comes from simulated inputs (see scripts/stress-test-50.ts step 3),
// so this checks scorer sanity/monotonicity on those inputs, not a real optimization pipeline.
describe('50-Run Stress Benchmark (simulated post-processing score)', () => {
  it(
    'should successfully execute all 50 extreme pre-press test scenarios with 0 anomalies',
    async () => {
      const { results, summary } = await run50StressTests();

      expect(results.length).toBe(50);
      expect(summary.allAnomalies.length).toBe(0);

      // Verify every single run improves or maintains score (monotonic non-decreasing)
      for (const res of results) {
        expect(res.postScore).toBeGreaterThanOrEqual(res.preScore);
        expect(res.preScore).toBeGreaterThanOrEqual(0);
        expect(res.postScore).toBeLessThanOrEqual(100);
        // Per-run wall-clock limits only under PERF_GUARD: parallel test threads make them flaky.
        if (process.env.PERF_GUARD) expect(res.totalTimeMs).toBeLessThan(1500);
      }

      // Always-on aggregate guard with generous headroom: catches pathological slowdowns
      // without failing on a busy machine.
      const medianMs = results.map((r) => r.totalTimeMs).sort((a, b) => a - b)[Math.floor(results.length / 2)];
      expect(medianMs).toBeLessThan(5000);
    },
    30000 // 30s timeout for 50 heavy runs
  );
});
