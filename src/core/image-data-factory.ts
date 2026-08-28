/**
 * Every ImageData-producing module in src/core used to inline the same environment-branch: use
 * the real `ImageData` constructor when the global exists (real browsers, and vitest's Node test
 * environment via tests/setup.ts's polyfill), otherwise fall back to a plain object matching the
 * ImageData shape (a bare Node runtime with no `ImageData` global — e.g. run outside vitest). This
 * is the single shared implementation, used consistently instead of ~20 independent copies.
 */
export function createImageData(data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): ImageData {
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
