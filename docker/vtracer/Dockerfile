# ─── Stage 1: Build (Rust) ────────────────────────────────────────────────
FROM rust:1.78-slim AS builder

WORKDIR /app

# Install system deps for image codec support
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies layer (Cargo.lock + Cargo.toml first)
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src && echo 'fn main(){}' > src/main.rs && cargo build --release && rm -rf src

# Full source build
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ─── Stage 2: Minimal Runtime ─────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/vtracer-server /app/vtracer-server

# Non-root user for security
RUN useradd -m -u 1001 vtracer
USER vtracer

EXPOSE 8080

# Memory-efficient: single-threaded Tokio runtime
ENV TOKIO_WORKER_THREADS=2
ENV RUST_LOG=warn

CMD ["/app/vtracer-server"]
