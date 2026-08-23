"""
VTracer HTTP Wrapper Server
Wraps the vtracer CLI as a JSON REST API microservice.

Endpoint:
  POST /vectorize
  Content-Type: multipart/form-data
  Field: image (binary PNG/JPEG/WebP, max 4MB)

  Optional query params:
    ?colors=8        (1-32, default 8)
    ?tolerance=1.5   (path smoothing, 0.1-5.0, default 1.5)

Response:
  { "svg": "<svg>...</svg>", "elapsed_ms": 123 }

Memory: Rust binary is ~8MB; this wrapper ~15MB Python → total <30MB idle
RAM ceiling: 128MB (set via Docker --memory flag)
"""

import subprocess
import tempfile
import time
import os
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
import cgi


MAX_UPLOAD_BYTES = 4 * 1024 * 1024  # 4 MB hard cap
VTRACER_BIN = os.environ.get('VTRACER_BIN', 'vtracer')
PORT = int(os.environ.get('PORT', 8080))


class VTracerHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress noisy access logs to save RAM
        pass

    def send_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_json(200, {'status': 'ok', 'service': 'vtracer'})
        else:
            self.send_json(404, {'error': 'Not Found'})

    def do_POST(self):
        if self.path != '/vectorize':
            self.send_json(404, {'error': 'Not Found'})
            return

        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > MAX_UPLOAD_BYTES:
            self.send_json(413, {'error': 'Payload too large (max 4MB)'})
            return

        content_type = self.headers.get('Content-Type', '')

        # Parse multipart form data
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': content_type,
                'CONTENT_LENGTH': str(content_length)
            }
        )

        if 'image' not in form:
            self.send_json(400, {'error': 'Missing image field'})
            return

        image_data = form['image'].file.read()
        colors = int(form.getvalue('colors', '8'))
        tolerance = float(form.getvalue('tolerance', '1.5'))

        # Clamp params
        colors = max(1, min(32, colors))
        tolerance = max(0.1, min(5.0, tolerance))

        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = Path(tmpdir) / 'input.png'
            out_path = Path(tmpdir) / 'output.svg'

            in_path.write_bytes(image_data)

            t0 = time.perf_counter()
            result = subprocess.run(
                [
                    VTRACER_BIN,
                    '--input', str(in_path),
                    '--output', str(out_path),
                    '--colormode', 'color',
                    '--num_colors', str(colors),
                    '--path_precision', '2',
                    '--filter_speckle', '4',
                    '--color_precision', '6',
                    '--segment_length', str(tolerance),
                ],
                capture_output=True,
                timeout=30
            )
            elapsed = round((time.perf_counter() - t0) * 1000)

            if result.returncode != 0:
                self.send_json(500, {
                    'error': 'VTracer failed',
                    'detail': result.stderr.decode(errors='replace')[:300]
                })
                return

            svg = out_path.read_text(encoding='utf-8')
            self.send_json(200, {'svg': svg, 'elapsed_ms': elapsed})


if __name__ == '__main__':
    print(f'[VTracer HTTP] Listening on port {PORT}', flush=True)
    HTTPServer(('0.0.0.0', PORT), VTracerHandler).serve_forever()
