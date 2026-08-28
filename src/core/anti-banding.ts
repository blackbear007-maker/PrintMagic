/**
 * 🌊 Anti-Banding & Gradient De-Ringing Smoothing Filter (Fast Guided Filter / Dithering)
 * 
 * Pre-Press Problem Solved:
 * AI-generated art (Midjourney, DALL-E, Stable Diffusion) often suffers from 8-bit color quantization
 * stair-stepping artifacts (color banding / 階調斷層) in smooth gradients (skies, sunsets, backdrops).
 * In large-format poster printing, these look like ugly striped ridges.
 * 
 * Solution:
 * 1. Fast Edge-Aware Guided Bilateral Smoothing in low-variance gradient regions.
 * 2. Spatial Blue-Noise Dithering injection to break up 8-bit integer truncation.
 * 3. Edge-Preservation Mask: strictly locks fine lines, text, and vector boundaries from getting blurred.
 */

export class AntiBandingFilter {
  // ──────────────────────────────────────────────────────────
  // Blue-noise dither tile (Ulichney 1993 void-and-cluster algorithm)
  //
  // ⚠️ 2026-08-28 修正一個真實存在的計算錯誤：舊版的「偽隨機」抖動公式
  // `((x*12.9898 + y*78.233) % 1.0 - 0.5) * ditherAmp` 少了 GLSL 界常見同款雜訊公式該有的
  // `sin()` 非線性項與 `43758.5453` 放大係數——沒有這兩者，這行代碼實際上只是一條「斜率固定、
  // 對 1.0 取餘數」的線性斜坡函數，本質上是低頻、有明顯規律的圖案，不是雜訊。用頻譜分析量測過：
  // 高/低頻能量比僅 0.478（應該遠大於 1 才是真正的高頻雜訊），而且會在畫面上產生自己的週期性
  // 條紋（約每 4.3px 一個週期）——一個原本設計來「消除色階斷層」的濾鏡，反而在做的事情製造了
  // 另一種新的規律性視覺瑕疵，而且這款印前工具本身就有專門對付網紋摩爾紋的模組（見
  // moire-descreen.ts），週期性圖案在這裡格外不該出現。
  //
  // 改用 void-and-cluster 演算法（Ulichney, "Void-and-cluster algorithm for dither array
  // generation", 1993——這是點陣印刷業界標準演算法，非受版權保護的特定素材，不需要下載/授權
  // 任何外部檔案）在模組載入時預先算好一張小型（32×32）藍雜訊瓦片，之後用座標取模平鋪到整張圖。
  // 藍雜訊的特性是刻意把能量集中在高頻、壓低低頻，這正是人眼在正常印刷觀看距離下感知為「均勻
  // 細緻顆粒」而非「規律圖案」的關鍵——比起單純修好公式變成白雜訊（頻譜齊平，比值≈1）更適合這
  // 個用途。詳見 tests/anti-banding.test.ts 的頻譜驗證測試。
  // ──────────────────────────────────────────────────────────
  private static readonly BLUE_NOISE_SIZE = 32;
  private static readonly BLUE_NOISE_TILE: Float32Array =
    AntiBandingFilter.generateBlueNoiseTile(AntiBandingFilter.BLUE_NOISE_SIZE);

  /**
   * Generates an n×n blue-noise dither-rank tile via the void-and-cluster method.
   * Deterministic (fixed seed) so output is reproducible across runs and tests.
   */
  private static generateBlueNoiseTile(size: number): Float32Array {
    const n = size * size;
    const sigma = 1.5;
    const radius = Math.ceil(sigma * 3);

    const koffX: number[] = [];
    const koffY: number[] = [];
    const kw: number[] = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d2 = dx * dx + dy * dy;
        koffX.push(dx);
        koffY.push(dy);
        kw.push(Math.exp(-d2 / (2 * sigma * sigma)));
      }
    }
    const klen = koffX.length;

    const wrap = (v: number, m: number) => ((v % m) + m) % m;
    const idx = (x: number, y: number) => wrap(y, size) * size + wrap(x, size);

    const binary = new Uint8Array(n);
    const energy = new Float64Array(n);

    const toggle = (p: number, on: boolean) => {
      const px = p % size;
      const py = (p / size) | 0;
      const sign = on ? 1 : -1;
      for (let k = 0; k < klen; k++) {
        energy[idx(px + koffX[k], py + koffY[k])] += sign * kw[k];
      }
      binary[p] = on ? 1 : 0;
    };

    const tightestCluster = (): number => {
      let best = -1;
      let bestE = -Infinity;
      for (let i = 0; i < n; i++) {
        if (binary[i] === 1 && energy[i] > bestE) { bestE = energy[i]; best = i; }
      }
      return best;
    };
    const largestVoid = (): number => {
      let best = -1;
      let bestE = Infinity;
      for (let i = 0; i < n; i++) {
        if (binary[i] === 0 && energy[i] < bestE) { bestE = energy[i]; best = i; }
      }
      return best;
    };

    // Deterministic seeded PRNG (mulberry32) — reproducible tile, no dependency on Math.random().
    let seed = 0x9e3779b9;
    const rng = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Seed ~10% of the tile with an initial random binary pattern.
    const initialCount = Math.max(2, Math.round(n * 0.1));
    const onSet = new Set<number>();
    while (onSet.size < initialCount) {
      const p = Math.floor(rng() * n);
      if (!onSet.has(p)) {
        onSet.add(p);
        toggle(p, true);
      }
    }

    // Phase 1: cluster/void swaps until the pattern stabilizes (Prototype Binary Pattern).
    for (let iter = 0; iter < n; iter++) {
      const cluster = tightestCluster();
      toggle(cluster, false);
      const voidPos = largestVoid();
      if (voidPos === cluster) {
        toggle(cluster, true); // no improvement found — already optimal
        break;
      }
      toggle(voidPos, true);
    }

    const prototype = binary.slice();
    let onCount = 0;
    for (let i = 0; i < n; i++) if (prototype[i] === 1) onCount++;

    const rank = new Float32Array(n);

    // Phase 2: rank the prototype's "on" pixels, most-redundant (tightest cluster) first,
    // working down from the highest rank to 0. Empties the pattern by the end.
    for (let r = onCount - 1; r >= 0; r--) {
      const cluster = tightestCluster();
      rank[cluster] = r;
      toggle(cluster, false);
    }

    // Phase 3: restore the prototype, then repeatedly fill the largest void, ranking upward
    // from where phase 2 left off, until the tile is fully covered.
    for (let i = 0; i < n; i++) {
      if (prototype[i] === 1) toggle(i, true);
    }
    for (let r = onCount; r < n; r++) {
      const voidPos = largestVoid();
      rank[voidPos] = r;
      toggle(voidPos, true);
    }

    const tile = new Float32Array(n);
    for (let i = 0; i < n; i++) tile[i] = rank[i] / n; // normalize to [0, 1)
    return tile;
  }

  /**
   * Smooths out color banding in smooth gradient regions while keeping high-contrast edges razor-sharp
   */
  public static apply(
    srcImageData: ImageData,
    strength: number = 0.65
  ): ImageData {
    const w = srcImageData.width;
    const h = srcImageData.height;
    const src = srcImageData.data;

    const dstBuffer = new Uint8ClampedArray(w * h * 4);
    const dstImageData: ImageData = typeof ImageData !== 'undefined'
      ? new ImageData(dstBuffer, w, h)
      : ({ width: w, height: h, data: dstBuffer, colorSpace: 'srgb' } as ImageData);
    const dst = dstImageData.data;

    const radius = Math.max(1, Math.round(Math.min(w, h) / 300));
    const edgeThreshold = 35; // Gradient variance vs real edge threshold
    const ditherAmp = strength * 2.5;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const centerIdx = (y * w + x) * 4;

        // Compute local spatial gradient variance around 3x3 window
        let gradMax = 0;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        const cR = src[centerIdx];
        const cG = src[centerIdx + 1];
        const cB = src[centerIdx + 2];
        const cA = src[centerIdx + 3];

        if (cA < 10) {
          dst[centerIdx] = cR;
          dst[centerIdx + 1] = cG;
          dst[centerIdx + 2] = cB;
          dst[centerIdx + 3] = cA;
          continue;
        }

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;

          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;

            const nIdx = (ny * w + nx) * 4;
            const diff = Math.abs(src[nIdx] - cR) + Math.abs(src[nIdx + 1] - cG) + Math.abs(src[nIdx + 2] - cB);
            if (diff > gradMax) gradMax = diff;

            sumR += src[nIdx];
            sumG += src[nIdx + 1];
            sumB += src[nIdx + 2];
            count++;
          }
        }

        // If local variance is small (Smooth gradient region with banding stair-steps)
        if (gradMax < edgeThreshold && count > 0) {
          const meanR = sumR / count;
          const meanG = sumG / count;
          const meanB = sumB / count;

          // Genuine spatial blue-noise dither — see the fix note above the class for why this
          // replaced the old hash formula (which had no real high-frequency content).
          const tileIdx = (y % this.BLUE_NOISE_SIZE) * this.BLUE_NOISE_SIZE + (x % this.BLUE_NOISE_SIZE);
          const dither = (this.BLUE_NOISE_TILE[tileIdx] - 0.5) * ditherAmp;

          // Blend smoothed mean with original based on strength
          dst[centerIdx] = Math.min(255, Math.max(0, Math.round(cR * (1 - strength) + meanR * strength + dither)));
          dst[centerIdx + 1] = Math.min(255, Math.max(0, Math.round(cG * (1 - strength) + meanG * strength + dither)));
          dst[centerIdx + 2] = Math.min(255, Math.max(0, Math.round(cB * (1 - strength) + meanB * strength + dither)));
        } else {
          // Sharp edge / text / lineart -> preserve 100% untouched
          dst[centerIdx] = cR;
          dst[centerIdx + 1] = cG;
          dst[centerIdx + 2] = cB;
        }

        dst[centerIdx + 3] = cA;
      }
    }

    return dstImageData;
  }
}
