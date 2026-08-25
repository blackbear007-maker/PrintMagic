"""
Zero-DCE++ Low-Light Enhancement Microservice

⚠️ HONESTY NOTE (2026-08-25): the network architecture below (CSDN_Tem / ZeroDCE_Plus) is a
genuine, correctly-structured implementation of the real Zero-DCE++ paper's model — that part is
real code, not fabricated. But it is instantiated with PyTorch's random default initialization and
NEVER loads trained weights: there is no `torch.load()` / `load_state_dict()` call anywhere in
this file, and no `.pth`/`.pt` weight file has ever existed anywhere in this repo's git history
(the Dockerfile's `COPY model/ ./model/` line references a directory that has never existed
either — this container has never actually been buildable as a result). Running inference through
an untrained network does NOT reproduce the paper's learned curve estimation; output quality is
undefined, not "real AI enhancement." A previous version of this file's docstring claimed
"~79KB weights" and called this "a genuine PyTorch network with learned weights" — that
characterization was wrong and has been corrected here. Until real trained weights are sourced or
trained and actually loaded, treat this exactly like the deterministic local fallback in
src/core/zero-dce-enhancer.ts: architecturally-motivated code, not a working trained model.

Endpoints:
  GET  /health
  POST /enhance   -> runs the untrained ZeroDCE_Plus network (see honesty note above)

An earlier version of this file also advertised /deshadow, /matting, /assess, /denoise, /deblur,
/dewarp, /segment, /upscale, and ~80 other endpoints under this same handler. None of those ran a
model: every one of them executed `out_img = img` (returned the input unchanged) or, for /assess,
returned a hardcoded constant score (92/88/95, always, regardless of input) while reporting
success=true. Those routes have been removed rather than kept as decorative dead code.

Memory Management:
  - PyTorch CPU Runtime (~150-200 MB RSS for this single model)
  - Hard cap in Docker: 640MB
"""

import io
import os
import time
import json
import cgi
import base64
from http.server import BaseHTTPRequestHandler, HTTPServer

import torch
import torch.nn as nn
from PIL import Image
import torchvision.transforms as transforms

PORT = int(os.environ.get('PORT', 8082))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Set thread limits to prevent CPU thrashing & cost spikes
torch.set_num_threads(2)


# ─── Zero-DCE++ Network ──────────────────────────────────────────────────
class CSDN_Tem(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.depth_conv = nn.Conv2d(in_ch, in_ch, 3, 1, 1, groups=in_ch, bias=True)
        self.point_conv = nn.Conv2d(in_ch, out_ch, 1, 1, 0, bias=True)

    def forward(self, x):
        return self.point_conv(self.depth_conv(x))


class ZeroDCE_Plus(nn.Module):
    def __init__(self):
        super().__init__()
        self.relu = nn.ReLU(inplace=True)
        number_f = 32
        self.e_conv1 = CSDN_Tem(3, number_f)
        self.e_conv2 = CSDN_Tem(number_f, number_f)
        self.e_conv3 = CSDN_Tem(number_f, number_f)
        self.e_conv4 = CSDN_Tem(number_f, number_f)
        self.e_conv5 = CSDN_Tem(number_f * 2, number_f)
        self.e_conv6 = CSDN_Tem(number_f * 2, number_f)
        self.e_conv7 = CSDN_Tem(number_f * 2, 3)

    def enhance_curve(self, x, r):
        for _ in range(8):
            x = x + r * (torch.pow(x, 2) - x)
        return x

    def forward(self, x):
        x1 = self.relu(self.e_conv1(x))
        x2 = self.relu(self.e_conv2(x1))
        x3 = self.relu(self.e_conv3(x2))
        x4 = self.relu(self.e_conv4(x3))
        x5 = self.relu(self.e_conv5(torch.cat([x3, x4], 1)))
        x6 = self.relu(self.e_conv6(torch.cat([x2, x5], 1)))
        r = torch.tanh(self.e_conv7(torch.cat([x1, x6], 1)))
        return self.enhance_curve(x, r)


print("[Zero-DCE++] Initializing network with random weights (no trained checkpoint available — see honesty note above)")
zero_dce_model = ZeroDCE_Plus()
zero_dce_model.eval()
print("[Zero-DCE++] Ready on port", PORT, "— UNTRAINED, output quality is not representative of the real model")


class ZeroDceHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress verbose logs

    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health' or self.path == '/':
            self._send_json(200, {
                'status': 'healthy',
                'service': 'Zero-DCE++ Low-Light Enhancement',
                'models': ['Zero-DCE++ (untrained — random weights, no checkpoint loaded)']
            })
            return
        self._send_json(404, {'error': 'Not found'})

    def do_POST(self):
        start_time = time.time()

        if self.path != '/enhance':
            self._send_json(404, {'error': f'No route for {self.path}. Only /enhance is implemented.'})
            return

        try:
            content_type = self.headers.get('Content-Type', '')
            content_length = int(self.headers.get('Content-Length', 0))

            if content_length > MAX_UPLOAD_BYTES:
                self._send_json(413, {'error': f'Payload too large (Max {MAX_UPLOAD_BYTES / (1024*1024)}MB)'})
                return

            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type}
            )

            if 'image' not in form:
                self._send_json(400, {'error': 'Missing required form field: "image"'})
                return

            image_file = form['image'].file
            img = Image.open(image_file).convert('RGB')

            transform = transforms.ToTensor()
            img_tensor = transform(img).unsqueeze(0)
            with torch.no_grad():
                enhanced = zero_dce_model(img_tensor)
            enhanced = torch.clamp(enhanced, 0.0, 1.0).squeeze(0)
            out_img = transforms.ToPILImage()(enhanced)

            buffered = io.BytesIO()
            out_img.save(buffered, format='PNG')
            img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            elapsed_ms = int((time.time() - start_time) * 1000)

            self._send_json(200, {
                'success': True,
                'image_base64': f'data:image/png;base64,{img_b64}',
                'width': out_img.width,
                'height': out_img.height,
                'elapsed_ms': elapsed_ms
            })

        except Exception as e:
            self._send_json(500, {'error': str(e)})


def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, ZeroDceHandler)
    print(f"[Zero-DCE++] Listening on port {PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()


if __name__ == '__main__':
    run()
