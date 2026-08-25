# ─── Zero-DCE++ Low-Light Enhancement Microservice ────────────────────────
# RAM ceiling: 600MB  (CPU-only PyTorch; no CUDA, no GPU billing)
# ⚠️ No trained weights exist for this model (see server.py's honesty note) — this Dockerfile
#    used to `COPY model/ ./model/`, referencing a directory that has never existed in this repo,
#    which meant the build always failed at that step. Removed so the container can at least
#    build and run (as an honestly-labeled untrained network) until real weights are sourced.
# Multi-stage: builder installs deps, runtime copies only what's needed

FROM python:3.12-slim AS base

# Install minimal build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch CPU-only (much smaller than CUDA version: ~250MB vs ~2GB)
# --extra-index-url ensures we get the CPU build specifically
COPY requirements.txt ./
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Copy server (no weight checkpoint to copy — see honesty note above)
COPY server.py ./

# Non-root user
RUN useradd -m -u 1001 zerodce
USER zerodce

EXPOSE 8082

# Limit PyTorch to 2 threads to prevent CPU thrashing
ENV OMP_NUM_THREADS=2
ENV TORCH_NUM_THREADS=2
ENV MKL_NUM_THREADS=2

CMD ["python", "-u", "server.py"]
