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
import math
from urllib.parse import urlsplit, parse_qs


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
        # The Node proxy sends colors/tolerance as query params, so route on the path only.
        url = urlsplit(self.path)
        query = parse_qs(url.query)
        if url.path != '/vectorize':
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
        try:
            colors = int(form.getvalue('colors') or query.get('colors', ['8'])[0])
            tolerance = float(form.getvalue('tolerance') or query.get('tolerance', ['1.5'])[0])
        except ValueError:
            self.send_json(400, {'error': 'colors must be an integer and tolerance a number'})
            return

        # Clamp params, then map onto options the vtracer CLI actually accepts: it has no
        # --num_colors (color_precision is 1-8 significant bits) and segment_length must be 3.5-10.
        colors = max(1, min(32, colors))
        tolerance = max(0.1, min(5.0, tolerance))
        color_precision = max(1, min(8, round(math.log2(colors)) + 1))
        segment_length = max(3.5, min(10.0, 3.5 + tolerance * 1.3))

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
                    '--path_precision', '2',
                    '--filter_speckle', '4',
                    '--color_precision', str(color_precision),
                    '--segment_length', str(segment_length),
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
