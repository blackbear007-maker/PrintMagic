# ─── PyTorch CPU Vision Microservice ──────────────────────────────────────
# Hosts 7 trained models plus 1 stateless color-management engine: Retinexformer (low-light, real
# trained weights if sourced — replaced the old untrained Zero-DCE++ 2026-08-26, see server.py's
# honesty note), Real-ESRGAN compact (upscale), DehazeFormer-T (dehaze), ARNIQA (quality
# assessment), LaMa (object/watermark removal) — all five on PyTorch — plus rembg/u2netp
# (background matting) and YuNet (face detection), both added 2026-08-27 and both running on ONNX
# Runtime/OpenCV's DNN backend instead of PyTorch, since neither had a good small PyTorch-native
# option. The 8th route, /icc/soft-proof (added 2026-08-27), is NOT a trained model and needs no
# weight file — it's real ICC color management via Pillow's ImageCms, which already bundles
# LittleCMS (verified: Pillow==10.3.0 above resolves to a build with lcms2 2.16 linked in), so
# nothing further needs adding to this Dockerfile for it. Kept under the `zero-dce` service/
# container name since that's already wired through docker-compose.yml, railway.toml, and
# ZERO_DCE_URL in the main app — renaming is a separate, larger change than adding routes to the
# existing container.
#
# RAM ceiling: see docker-compose.yml for the current number and the reasoning behind it — grown
# from the original 640MB single-model container as more models joined this one process; the
# number is measured (not guessed) against a real isolated-venv run, see docker-compose.yml's
# header comment for the actual methodology and its limits (not the Docker image itself).
#
# Multi-stage: builder installs deps + downloads what's automatable, runtime copies only what's
# needed.

FROM python:3.12-slim AS base

# Install minimal build deps (+ curl for weight downloads)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch CPU-only + the rest of requirements.txt
COPY requirements.txt ./
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# ─── Retinexformer model definition (vendoring the real source file, not reconstructing it) ───
# Fetched directly from the real repo, not retyped from memory — verified 2026-08-26 by actually
# loading a real trained checkpoint against this exact file (strict=True state_dict load, 0
# missing/0 unexpected keys across 122 tensors).
RUN curl -fsSL -o retinexformer_arch.py \
    https://raw.githubusercontent.com/caiyuanhao1998/Retinexformer/master/basicsr/models/archs/RetinexFormer_arch.py

# ─── Retinexformer weights — CANNOT be auto-downloaded, see docker/zero-dce/weights/README.md ─
# Same situation as DehazeFormer-T: the author only publishes trained checkpoints via a Google
# Drive folder / Baidu Disk share (no stable direct-download URL) — verified 2026-08-26. Unlike a
# typical "manually-sourced weight", this file (and dehazeformer-t.pth) is committed directly to
# git as of 2026-08-26 rather than left gitignored: Railway builds this service from the git repo,
# not local disk, so a gitignored weight downloaded only locally would never reach the deployed
# container. Staged via the same `COPY weights/ ./weights/` step below.

# ─── Real-ESRGAN's `basicsr` dependency is broken on current torchvision ──────────────────────
# basicsr 1.4.2 (its last PyPI release, 2022-08-30, unmaintained) imports
# torchvision.transforms.functional_tensor, which was removed in torchvision 0.17+. Without this
# patch, `import realesrgan` raises ModuleNotFoundError at server startup. Verified against
# xinntao/Real-ESRGAN issues #944/#768/#841 and XPixelGroup/BasicSR #711 — this is a real,
# currently-open upstream compatibility gap, not a hypothetical.
RUN python -c "import basicsr, os; print(os.path.dirname(basicsr.__file__))" > /tmp/basicsr_path.txt && \
    sed -i \
    "s/from torchvision.transforms.functional_tensor import rgb_to_grayscale/from torchvision.transforms.functional import rgb_to_grayscale/" \
    "$(cat /tmp/basicsr_path.txt)/data/degradations.py" && \
    rm /tmp/basicsr_path.txt

# ─── Real-ESRGAN weights (real, direct-downloadable GitHub Release asset) ─────────────────────
RUN mkdir -p weights && curl -fsSL -o weights/realesr-general-x4v3.pth \
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth

# ─── LaMa weights (real, direct-downloadable GitHub Release asset) ────────────────────────────
# TorchScript-traced "big-lama" checkpoint (community export of the official advimman/lama model,
# github.com/enesmsahin/simple-lama-inpainting, Apache-2.0) — needs no architecture class to load,
# just torch.jit.load(). Verified 2026-08-26 by actually downloading this exact URL and running
# inference: cleanly removed a solid-color test "watermark" region. 196MB — by far the largest
# single weight file this container carries, see docker-compose.yml for the resulting RAM ceiling.
RUN curl -fsSL -o weights/big-lama.pt \
    https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt

# ─── YuNet weights (real, direct-downloadable Git-LFS-backed release asset) ────────────────────
# github.com/opencv/opencv_zoo, models/face_detection_yunet (Apache-2.0 repo / MIT for this
# specific model directory). ~0.23MB ONNX file, loaded via cv2.FaceDetectorYN — no architecture
# class or extra Python package needed beyond opencv-python-headless already in requirements.txt.
# Verified 2026-08-27 by actually downloading this exact URL and running inference: correctly
# detected a face on a synthetic test image at 84.2% confidence.
RUN curl -fsSL -o weights/face_detection_yunet_2023mar.onnx \
    https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx

# ─── rembg (u2netp) weights, pre-warmed at build time (real GitHub Release, no auth) ───────────
# github.com/danielgatis/rembg (MIT). Deliberately creates a session for the `u2netp` model by
# name — never rembg's own DEFAULT session (`bria-rmbg`), which carries a separate non-commercial
# license — verified 2026-08-27 against rembg's own session registry. U2NET_HOME is pinned to a
# path under /app (matching the ARNIQA TORCH_HOME pattern below) so the downloaded weight lands
# somewhere the non-root `zerodce` user (created further down) can actually read, and so it's
# baked into this image layer rather than re-downloaded on first request in production.
ENV U2NET_HOME=/app/.u2net
RUN python -c "from rembg import new_session; new_session('u2netp')"

# ─── DehazeFormer-T model definition (vendoring the real source file, not reconstructing it) ──
# Only this one file is needed: verified to import nothing from the rest of the DehazeFormer
# repo (just torch/torch.nn/torch.nn.functional/math/numpy/timm.models.layers).
# ⚠️ Deliberately named `dehazeformer_model/`, NOT `models/` — verified by actually running this:
# ARNIQA's own torch.hub-loaded code does `from models.resnet import ResNet` at import time, and
# a same-named local `models/` package in this working directory silently shadows it (Python
# resolves the working directory before the hub cache), making ARNIQA fail to load with
# `ModuleNotFoundError: No module named 'models.resnet'`. Caught by an actual test run, not
# theory — see the commit message / PR notes for the reproduction.
RUN mkdir -p dehazeformer_model && curl -fsSL -o dehazeformer_model/dehazeformer.py \
    https://raw.githubusercontent.com/IDKiro/DehazeFormer/main/models/dehazeformer.py

# ─── DehazeFormer-T weights — CANNOT be auto-downloaded, see docker/zero-dce/weights/README.md ─
# The author only publishes trained checkpoints via a Google Drive folder (no stable direct-
# download URL that works from an unauthenticated `curl`/CI context — verified 2026-08-26).
# `dehazeformer-t.pth` (like `LOL_v2_real.pth` above) is committed directly to git as of
# 2026-08-26 — small enough (2.9MB) that this was simpler than any local-disk-only deploy path,
# and necessary since Railway builds from git, not local disk. The `weights/` directory is always
# present in git regardless (a tracked `.gitkeep`), so this COPY never fails the build even if a
# weight file were ever missing — Docker's COPY only fails on a missing SOURCE PATH, not on a
# directory that exists but is otherwise empty. server.py checks for each weight file at startup
# and honestly reports the corresponding endpoint unavailable (503) rather than crashing or running
# unverified weights if one isn't there.
COPY weights/ ./weights/

# ─── ARNIQA weights + code cache, pre-warmed at build time (real GitHub Releases, no auth) ────
ENV TORCH_HOME=/app/.torch_cache
RUN python -c "\
import torch; \
torch.hub.load(repo_or_dir='miccunifi/ARNIQA', source='github', model='ARNIQA', regressor_dataset='koniq10k')" \
    && rm -f /app/.torch_cache/hub/checkpoints/resnet50-*.pth
# The rm above deletes the incidental ImageNet-pretrained ResNet50 weights that
# torchvision.models.resnet50(weights=...) downloads while constructing ARNIQA's encoder — they
# get immediately overwritten by ARNIQA's own trained encoder state_dict on the very next line of
# hubconf.py, so the file is genuinely dead weight (~100MB) if left in the image layer.

# Copy server code (weights/models already staged above)
COPY server.py ./

# Non-root user (create before chown so weights/.torch_cache are readable)
RUN useradd -m -u 1001 zerodce && chown -R zerodce:zerodce /app
USER zerodce

EXPOSE 8082

# Limit PyTorch to 2 threads to prevent CPU thrashing
ENV OMP_NUM_THREADS=2
ENV TORCH_NUM_THREADS=2
ENV MKL_NUM_THREADS=2

CMD ["python", "-u", "server.py"]
