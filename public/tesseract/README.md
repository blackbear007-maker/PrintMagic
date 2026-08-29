# Self-hosted Tesseract.js OCR assets

These files back `src/services/free-ocr-client.ts` (real Tesseract OCR via the `tesseract.js` /
`tesseract.js-core` npm packages, Apache-2.0). They are committed directly to git rather than
fetched from tesseract.js's default jsDelivr CDN or downloaded at build time, for the same reason
`docker/zero-dce/weights/LOL_v2_real.pth` is committed: the root `Dockerfile` does `COPY public
./public` straight from the git-cloned build context (see `[build] builder = "DOCKERFILE"` in
`railway.toml`) — a file that only exists on a local disk, or that would need a build-time
download step, adds risk (network flakiness during CI, an extra script to maintain) for assets
that are small enough and stable enough to just commit. Total footprint ~13.4MB, none of it loads
on initial page view — everything here is fetched lazily, once, only when OCR is actually invoked
(the "auto-detect text zones" flow in `src/ui/vector-overlay-modal.ts`).

Loading these locally instead of the default CDN also keeps OCR consistent with this project's
self-hosted-first architecture: no third-party network dependency, works the same whether the
deploy has outbound internet access or not (after the first same-origin fetch of these files).

## Files (all Apache-2.0)

| File | Source | Size | Purpose |
| :--- | :--- | ---: | :--- |
| `worker.min.js` | `node_modules/tesseract.js/dist/worker.min.js` (built by the `tesseract.js` npm package itself) | ~109 KB | Web Worker entry script |
| `tesseract-core-lstm.wasm` + `tesseract-core-lstm.wasm.js` | `node_modules/tesseract.js-core/` | ~2.7 MB + ~3.7 MB | Tesseract's WASM engine, LSTM-only (neural net) build. `corePath` in `free-ocr-client.ts` points at this exact `.js` file rather than a directory, which skips tesseract.js's runtime SIMD-capability feature-detection entirely (see `getCore.js` in the `tesseract.js` source — a directory path makes it choose between `tesseract-core-lstm.wasm.js` / `tesseract-core-simd-lstm.wasm.js` / `tesseract-core-relaxedsimd-lstm.wasm.js` at runtime, each of which would need to be self-hosted too). Deliberately using the plain non-SIMD build trades a little speed for correctness on every browser without needing 2-3x the asset weight — recognizing a small cropped text region doesn't need SIMD's speed the way full-page OCR would.
| `lang-data/eng.traineddata` | `github.com/tesseract-ocr/tessdata_fast` (official Tesseract project, "fast" variant — smaller/quicker than `tessdata_best`, tradeoff accepted since this app is doing zone-level recognition, not archival-quality document OCR) | ~3.9 MB | English language model |
| `lang-data/chi_tra.traineddata` | same source | ~2.3 MB | Traditional Chinese language model — this app's UI and its expected users are Traditional-Chinese-speaking, so both scripts are loaded into one worker (`createWorker(['eng', 'chi_tra'], ...)`). Honestly expect meaningfully lower accuracy on chi_tra than eng, especially on stylized/decorative poster fonts — CJK OCR is a harder problem in general, and `tessdata_fast` trades accuracy for size/speed on top of that. |

## Refreshing

```bash
npm install tesseract.js@latest  # pulls a matching tesseract.js-core into node_modules
cp node_modules/tesseract.js/dist/worker.min.js public/tesseract/worker.min.js
cp node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js public/tesseract/
cp node_modules/tesseract.js-core/tesseract-core-lstm.wasm public/tesseract/
curl -L -o public/tesseract/lang-data/eng.traineddata \
  https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata
curl -L -o public/tesseract/lang-data/chi_tra.traineddata \
  https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/chi_tra.traineddata
```

`gzip: false` is passed in `free-ocr-client.ts`'s worker options to match these being the plain
(uncompressed) `.traineddata` files rather than the `.traineddata.gz` tesseract.js expects by
default.
