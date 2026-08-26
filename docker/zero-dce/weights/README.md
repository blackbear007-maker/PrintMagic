# Manually-sourced weights go here

This directory exists in git (via `.gitkeep`) so `docker build` always has something to `COPY`,
even when the files below haven't been sourced yet — the build must succeed either way, and each
endpoint honestly reports itself unavailable at runtime if its weight file is missing, rather than
the whole image failing to build or silently running an untrained network. `.pth` files placed
here are gitignored (see root `.gitignore`) — they're binaries, not source, and don't belong in git.

## LOL_v2_real.pth (required for the `/enhance` endpoint — Retinexformer)

There is no automatable, unauthenticated direct-download URL for this file — the author only
publishes trained checkpoints via a Google Drive folder or Baidu Disk share (verified 2026-08-26).
To enable `/enhance`:

1. Open https://github.com/caiyuanhao1998/Retinexformer and follow the README's download links:
   - Google Drive (folder): https://drive.google.com/drive/folders/1ynK5hfQachzc8y96ZumhkPPDXzHJwaQV
   - Baidu Disk (access code `cyh2`): https://pan.baidu.com/s/13zNqyKuxvLBiQunIxG_VhQ?pwd=cyh2
2. Download `LOL_v2_real.pth` (~6.2 MB) — this is the checkpoint trained on real captured
   low/normal-light photo pairs, the closest match to general consumer photos. (`FiveK.pth` is a
   plausible alternative for general photographic tone correction, but the MIT-Adobe FiveK
   dataset's own license terms restrict it to research/educational use — whether a model trained
   on it inherits that restriction despite the repo's blanket MIT claim is an unresolved ambiguity
   the author's repo doesn't address. `LOL_v2_real.pth` has no such concern.)
3. Save it as `LOL_v2_real.pth` in this directory
4. Rebuild the `zero-dce` image

Without this file present at build time, `/enhance` starts up and immediately returns
`503 { available: false }` on every request instead of crashing or running unverified weights.

## dehazeformer-t.pth (required for the `/dehaze` endpoint)

There is no automatable, unauthenticated direct-download URL for this file — DehazeFormer's
author only publishes trained checkpoints via a Google Drive folder (verified 2026-08-26), which
`curl`/`wget` in a Docker build can't reliably pull from. To enable `/dehaze`:

1. Open https://github.com/IDKiro/DehazeFormer and follow the README's Google Drive link
2. Download `saved_models/indoor/dehazeformer-t.pth` (or `outdoor/`, depending on which domain
   you want to prioritize for typical print-prep photos — indoor was assumed for the RAM sizing
   in `docker-compose.yml`)
3. Save it as `dehazeformer-t.pth` in this directory
4. Rebuild the `zero-dce` image

Without this file present at build time, `/dehaze` starts up and immediately returns
`503 { available: false }` on every request instead of crashing or running unverified weights.

## big-lama.pt (`/inpaint` endpoint — LaMa) — no manual step needed

Unlike the two files above, this one has a real direct-download GitHub Release URL, so the
Dockerfile fetches it automatically at build time (see the `RUN curl ... weights/big-lama.pt` step)
— it never needs to be placed in this directory by hand, and never touches this local checkout.
