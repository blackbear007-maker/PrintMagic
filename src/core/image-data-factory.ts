/**
 * Every ImageData-producing module in src/core used to inline the same environment-branch: use
 * the real `ImageData` constructor when the global exists (real browsers, and vitest's Node test
 * environment via tests/setup.ts's polyfill), otherwise fall back to a plain object matching the
 * ImageData shape (a bare Node runtime with no `ImageData` global — e.g. run outside vitest). This
 * is the single shared implementation, used consistently instead of ~20 independent copies.
 */
export function createImageData(data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): ImageData {
  // ⚠️ 2026-08-29 修正（防禦性，目前沒有真實呼叫端會傳入 0/負值寬高）：真實瀏覽器的原生
  // ImageData 建構子規格上明確規定寬或高為 0 時要丟出 IndexSizeError，但 tests/setup.ts
  // 裡給 Node 測試環境用的 ImageData polyfill完全沒有做這個驗證——寬度 0 會被靜靜接受，
  // 產生一個空的 ImageData 而不報錯。這造成「測試環境 vs. 正式環境」行為不一致：任何在
  // 正式瀏覽器會直接拋錯的 0 寬高輸入，寫成測試反而會靜默通過，掩蓋掉真實的上游計算錯誤
  // （例如裁切/選取範圍算出負值或零寬高）。這裡在共用工廠函式層級統一驗證，讓兩種環境
  // 的行為一致，且提前失敗、訊息清楚，而不是等到後面某個像素索引運算才產生更難懂的錯誤。
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`createImageData: width and height must be positive finite numbers (got ${width}x${height}).`);
  }
  return typeof ImageData !== 'undefined'
    ? new ImageData(data, width, height)
    : ({ width, height, data, colorSpace: 'srgb' } as ImageData);
}

/**
 * Same as createImageData, but allocates a fresh zero-filled RGBA buffer instead of taking one —
 * for call sites building an output image pixel-by-pixel rather than transforming an existing one.
 */
export function createBlankImageData(width: number, height: number): ImageData {
  return createImageData(new Uint8ClampedArray(width * height * 4), width, height);
}
