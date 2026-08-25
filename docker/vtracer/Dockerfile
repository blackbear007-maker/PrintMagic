# ─── VTracer Vectorization Microservice ───────────────────────────────────
#
# Fixed 2026-08-25: the previous Dockerfile tried to `COPY Cargo.toml Cargo.lock ./`
# and `COPY src ./src` to build a custom Rust HTTP server — but no such Cargo.toml or
# src/ ever existed anywhere in this repo's git history. That Dockerfile could never
# successfully build. This version instead installs the real, published `vtracer`
# crate (github.com/visioncortex/vtracer) as a CLI binary, and runs the existing
# server.py — which already correctly wraps that CLI via subprocess — as the actual
# HTTP service. That matches what server.py has always expected (a `vtracer` binary
# on PATH), instead of a from-scratch Rust HTTP server that was never written.

# ─── Stage 1: Build the real vtracer CLI from the published crate ─────────
FROM rust:1.78-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install vtracer --locked

# ─── Stage 2: Minimal Python runtime wrapping the real binary ─────────────
FROM python:3.12-slim AS runtime

RUN useradd -m -u 1001 vtracer
WORKDIR /app

COPY --from=builder /usr/local/cargo/bin/vtracer /usr/local/bin/vtracer
COPY server.py ./

USER vtracer

EXPOSE 8080
ENV PORT=8080

CMD ["python", "-u", "server.py"]
