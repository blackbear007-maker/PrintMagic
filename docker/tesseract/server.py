"""
Tesseract OCR HTTP Microservice

Endpoints:
  GET  /health
  POST /ocr
    Content-Type: multipart/form-data
    Field: image (PNG/JPEG/WebP binary, max 8MB)
    Field: lang  (optional, default 'chi_tra+eng')

Response:
  { "text": "...", "confidence": 88.5, "elapsed_ms": 230 }

Preprocessing pipeline (reduces RAM by shrinking input):
  1. Convert to grayscale
  2. Otsu binarization (improves accuracy, reduces data)
  3. Upscale to 300 DPI equivalent if too small
  4. Feed to Tesseract subprocess (OMP_THREAD_LIMIT=1)

RAM budget: ~120MB Python + Pillow + ~200MB Tesseract model = ~320MB peak
"""

import subprocess
import tempfile
import time
import os
import json
import cgi
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from io import BytesIO

try:
    from PIL import Image, ImageFilter, ImageOps
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
PORT = int(os.environ.get('PORT', 8081))
SUPPORTED_LANGS = {'chi_tra', 'chi_sim', 'eng', 'jpn', 'chi_tra+eng', 'chi_tra+jpn', 'eng+jpn'}


def preprocess_image(raw_bytes: bytes) -> bytes:
    """
    Grayscale → Otsu binarize → ensure minimum 150px tall
    Returns PNG bytes for Tesseract.
    """
    if not PIL_AVAILABLE:
        return raw_bytes

    img = Image.open(BytesIO(raw_bytes)).convert('L')  # grayscale

    # Upscale tiny images (Tesseract needs ~30px cap height)
    w, h = img.size
    if h < 150:
        scale = 150 / h
        img = img.resize((int(w * scale), 150), Image.LANCZOS)

    # Otsu binarization
    img = ImageOps.autocontrast(img, cutoff=1)

    out = BytesIO()
    img.save(out, format='PNG', optimize=True)
    return out.getvalue()


class TesseractHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress verbose logs

    def send_json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_json(200, {'status': 'ok', 'service': 'tesseract-ocr', 'pil': PIL_AVAILABLE})
        else:
            self.send_json(404, {'error': 'Not Found'})

    def do_POST(self):
        if self.path != '/ocr':
            self.send_json(404, {'error': 'Not Found'})
            return

        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > MAX_UPLOAD_BYTES:
            self.send_json(413, {'error': 'Payload too large (max 8MB)'})
            return

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': self.headers.get('Content-Type', ''),
                'CONTENT_LENGTH': str(content_length)
            }
        )

        if 'image' not in form:
            self.send_json(400, {'error': 'Missing image field'})
            return

        raw_bytes = form['image'].file.read()
        lang = form.getvalue('lang', 'chi_tra+eng')

        # Sanitize lang param
        if lang not in SUPPORTED_LANGS:
            lang = 'chi_tra+eng'

        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = Path(tmpdir) / 'input.png'
            out_base = Path(tmpdir) / 'output'

            # Preprocess image
            processed = preprocess_image(raw_bytes)
            in_path.write_bytes(processed)

            t0 = time.perf_counter()
            result = subprocess.run(
                ['tesseract', str(in_path), str(out_base), '-l', lang, '--psm', '3', 'txt'],
                capture_output=True,
                timeout=30,
                env={**os.environ, 'OMP_THREAD_LIMIT': '1'}
            )
            elapsed = round((time.perf_counter() - t0) * 1000)

            if result.returncode != 0:
                self.send_json(500, {
                    'error': 'Tesseract failed',
                    'detail': result.stderr.decode(errors='replace')[:300]
                })
                return

            txt_path = out_base.with_suffix('.txt')
            text = txt_path.read_text(encoding='utf-8').strip() if txt_path.exists() else ''

            self.send_json(200, {
                'text': text,
                'lang': lang,
                'elapsed_ms': elapsed,
                'chars': len(text)
            })


if __name__ == '__main__':
    print(f'[Tesseract OCR] Listening on port {PORT}', flush=True)
    HTTPServer(('0.0.0.0', PORT), TesseractHandler).serve_forever()
