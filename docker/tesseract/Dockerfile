# ─── Tesseract OCR Microservice Dockerfile ────────────────────────────────
# RAM ceiling: 350MB (enforced by Railway memory limit config)
# Supports: zh-TW (繁中), en (英文), ja (日文) language packs only
# Base: python:3.12-slim (minimal Debian, no build tools in final image)

FROM python:3.12-slim

# Install Tesseract + specific language packs (reduces image size vs installing all)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-chi-tra \
    tesseract-ocr-eng \
    tesseract-ocr-jpn \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Limit Tesseract thread usage to prevent CPU spikes
ENV OMP_THREAD_LIMIT=1
ENV TESSERACT_MAX_THREADS=1

WORKDIR /app

# Install minimal Python deps (flask for HTTP, Pillow for image preprocessing)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py ./

# Non-root user
RUN useradd -m -u 1001 tesseract
USER tesseract

EXPOSE 8081

CMD ["python", "-u", "server.py"]
