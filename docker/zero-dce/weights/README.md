# Manually-sourced weights go here

This directory exists in git (via `.gitkeep`) so `docker build` always has something to `COPY`,
even when the files below haven't been sourced yet — the build must succeed either way, and each
endpoint honestly reports itself unavailable at runtime if its weight file is missing, rather than
the whole image failing to build or silently running an untrained network. `.pth` files placed
here are gitignored by default (see root `.gitignore`) — EXCEPT `LOL_v2_real.pth`, which is
explicitly committed (2026-08-26): Railway's `docker/zero-dce`
service builds from this git repo, not from local disk (`railway.toml` uses `builder=DOCKERFILE`),
so a gitignored weight file downloaded only locally would never reach the deployed service — it'd
pass local verification and then still 503 on Railway. At ~6.2MB the file is small
enough that committing it was simpler than switching to CLI-based local-disk deploys.

## LOL_v2_real.pth (`/enhance` endpoint — Retinexformer) — already committed, present after a fresh clone

Already present in this directory as of 2026-08-26 (see the `.gitignore` exception above) — a
fresh `git clone` already has it, no manual step needed. Documented below only in case it ever
needs to be re-sourced or swapped for a different checkpoint.

There is no automatable, unauthenticated direct-download URL for this file — the author only
publishes trained checkpoints via a Google Drive folder or Baidu Disk share (verified 2026-08-26).
To re-source it:

1. Open https://github.com/caiyuanhao1998/Retinexformer and follow the README's download links:
   - Google Drive (folder): https://drive.google.com/drive/folders/1ynK5hfQachzc8y96ZumhkPPDXzHJwaQV
   - Baidu Disk (access code `cyh2`): https://pan.baidu.com/s/13zNqyKuxvLBiQunIxG_VhQ?pwd=cyh2
2. Download `LOL_v2_real.pth` (~6.2 MB) — this is the checkpoint trained on real captured
   low/normal-light photo pairs, the closest match to general consumer photos. (`FiveK.pth` is a
   plausible alternative for general photographic tone correction, but the MIT-Adobe FiveK
   dataset's own license terms restrict it to research/educational use — whether a model trained
   on it inherits that restriction despite the repo's blanket MIT claim is an unresolved ambiguity
   the author's repo doesn't address. `LOL_v2_real.pth` has no such concern.)
3. Replace `LOL_v2_real.pth` in this directory and commit it
4. Rebuild the `zero-dce` image

If this file is ever removed without a replacement, `/enhance` starts up and immediately returns
`503 { available: false }` on every request instead of crashing or running unverified weights.

## big-lama.pt (`/inpaint` endpoint — LaMa) — no manual step needed

Unlike the two files above, this one has a real direct-download GitHub Release URL, so the
Dockerfile fetches it automatically at build time (see the `RUN curl ... weights/big-lama.pt` step)
— it never needs to be placed in this directory by hand, and never touches this local checkout.
