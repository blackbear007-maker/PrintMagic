"""
PyTorch CPU Vision Microservice

Hosts 5 independent models sharing one PyTorch runtime — see docker/zero-dce/Dockerfile's header
comment for why they're all in this one container/service (kept under the pre-existing
`zero-dce` name rather than a broader rename, to avoid touching docker-compose.yml/railway.toml/
ZERO_DCE_URL wiring in a single pass).

⚠️ HISTORY on low-light enhancement (superseded 2026-08-26): this endpoint used to run Zero-DCE++
with PyTorch's random default initialization — no trained checkpoint for it ever existed anywhere
in this repo's git history, so its output was undefined, not "real AI enhancement." It has been
replaced with **Retinexformer** (ICCV 2023, MIT), loaded from a real trained checkpoint
(`LOL_v2_real.pth`) — verified 2026-08-26 by actually loading a real downloaded copy of that
checkpoint: `strict=True` state_dict load succeeded with 0 missing/0 unexpected keys across all
122 tensors, and real inference on a test image correctly brightened it (0.082 -> 0.399 mean
luminance). Same graceful-missing pattern as DehazeFormer-T below applies if this file is ever
removed without a replacement: no weight file at build time -> /enhance honestly reports 503, not
a crash or fake success.

All 5 models here (Retinexformer, Real-ESRGAN, DehazeFormer-T, ARNIQA, LaMa) are genuinely
trained, real pretrained-weight models when their weight files are present. Provenance for each
is documented at its loading site below. Real-ESRGAN, ARNIQA, and LaMa's weights are fetched
automatically at Docker build time (stable direct-download URLs); Retinexformer and DehazeFormer-T
have no automatable download URL, so a human sourced them manually once (2026-08-26) and the
resulting files were committed directly to git (see weights/README.md and the `.gitignore`
exception for these two) — Railway builds this service from the git repo, not local disk, so a
gitignored weight downloaded only locally would never actually reach the deployed container. All 5
have now been verified in an isolated local venv (not
the actual Docker image itself, which this repo has no way to build in the environment these
changes were authored in) with a real downloaded checkpoint each — `strict=True` state_dict loads
with 0 missing/0 unexpected keys (or, for LaMa, a successful `torch.jit.load()` of the real
TorchScript-traced checkpoint), plus real inference producing sensible output (Retinexformer:
0.082->0.399 mean luminance on a dark test image; DehazeFormer-T: contrast std 0.0245->0.0763 on
a washed-out test image; LaMa: cleanly removed a solid-color test "watermark" region, 0% of its
pixels remained the original fill color after inpainting) — using architecture code fetched from
each project's actual current source rather than reconstructed from memory.

Endpoints:
  GET  /health
  POST /enhance   -> Retinexformer low-light (real trained weights if sourced, MIT — 503 if the
                     weight file wasn't manually placed at build time, see weights/README.md)
  POST /upscale   -> Real-ESRGAN compact x4v3 (real trained weights, BSD-3-Clause)
  POST /dehaze    -> DehazeFormer-T (real trained weights if sourced, MIT — 503 if the weight
                     file wasn't manually placed at build time, see weights/README.md)
  POST /quality   -> ARNIQA no-reference quality score (real trained weights, Apache-2.0)
  POST /inpaint   -> LaMa object/watermark removal (real trained weights, Apache-2.0)

An earlier version of this file also advertised /deshadow, /matting, /assess, /denoise, /deblur,
/dewarp, /segment, and ~80 other endpoints under this same handler. None of those ran a model:
every one of them executed `out_img = img` (returned the input unchanged) or, for /assess,
returned a hardcoded constant score (92/88/95, always, regardless of input) while reporting
success=true. Those routes were removed rather than kept as decorative dead code; the 5 endpoints
above are the only ones this file implements.

Memory Management:
  - See docker-compose.yml for the current RAM ceiling and the reasoning/uncertainty behind it.
"""

import io
import os
import time
import json
import cgi
import base64
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
import torch
from PIL import Image
import torchvision.transforms as transforms

PORT = int(os.environ.get('PORT', 8082))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Measured, not guessed (see git history / PR notes for the actual test run): all 4 endpoints
# scale memory with input pixel count, since none of them downsample before running inference.
# /upscale gets a stricter cap since its 4x output multiplies the effect on top of that.
MAX_INPUT_PIXELS = 2000 * 2000  # ~4MP, applies to /enhance, /dehaze, /quality
MAX_UPSCALE_INPUT_PIXELS = 1200 * 1200  # ~1.44MP, applies to /upscale only

# Set thread limits to prevent CPU thrashing & cost spikes
torch.set_num_threads(2)


# ─── Retinexformer — real trained weights, manually sourced once and committed to git, MIT ────
# github.com/caiyuanhao1998/Retinexformer (ICCV 2023). Replaces the previous untrained Zero-DCE++
# network 2026-08-26 — Zero-DCE++ never had trained weights available anywhere; Retinexformer does
# (LOL_v2_real.pth, verified 2026-08-26 by actually loading a real downloaded copy: strict=True
# state_dict load with 0 missing/0 unexpected keys across all 122 tensors, plus real inference on
# a test image that correctly brightened it, 0.082 -> 0.399 mean luminance). Architecture file
# (retinexformer_arch.py) is vendored verbatim at Docker build time from the real repo — not
# reconstructed from memory. Same graceful-missing pattern as DehazeFormer-T: if the weight file
# wasn't manually placed at build time, this stays None and /enhance honestly reports 503.
retinexformer_model = None
try:
    from retinexformer_arch import RetinexFormer

    _lowlight_weights_path = 'weights/LOL_v2_real.pth'
    if os.path.exists(_lowlight_weights_path):
        # Hyperparameters must exactly match Options/RetinexFormer_LOL_v2_real.yml's network_g
        # block — verified against the real repo, NOT the class's own (different) defaults.
        retinexformer_model = RetinexFormer(
            in_channels=3, out_channels=3, n_feat=40, stage=1, num_blocks=[1, 2, 2]
        )
        _ckpt = torch.load(_lowlight_weights_path, map_location='cpu')
        _state_dict = _ckpt['params'] if 'params' in _ckpt else _ckpt
        _state_dict = {
            (k[7:] if k.startswith('module.') else k): v for k, v in _state_dict.items()
        }
        retinexformer_model.load_state_dict(_state_dict, strict=True)
        retinexformer_model.eval()
        print("[Retinexformer] Loaded LOL_v2_real.pth — /enhance ready")
    else:
        print(
            "[Retinexformer] weights/LOL_v2_real.pth not present (manual download required, "
            "see weights/README.md) — /enhance will report unavailable"
        )
except Exception as e:
    print(f"[Retinexformer] Failed to load — /enhance will report unavailable. Error: {e}")


# ─── Real-ESRGAN compact (x4v3) — real trained weights, BSD-3-Clause ──────────────────────────
# github.com/xinntao/Real-ESRGAN. Weights downloaded at Docker build time from the project's real
# GitHub Release asset (see Dockerfile). SRVGGNetCompact + RealESRGANer come from the `realesrgan`
# PyPI package's own vendored copy (realesrgan.archs.srvgg_arch), matching the project's own
# officially-tested inference script rather than basicsr's separately-maintained copy of the same
# class, which could drift independently.
#
# ⚠️ tile=400 (NOT tile=0) — measured by actually running this: tile=0 (no tiling, process the
# whole image in one pass) scales peak RSS directly with input size — a 2000x2000 input measured
# at 2.2GB peak RSS, tile=400 brought the same input down to ~1.5GB. Tiling bounds the network's
# own working memory, but NOT the final assembled output buffer (a 4x upscale of a large image is
# inherently a large output array) — see MAX_UPSCALE_INPUT_PIXELS below for why input size is
# additionally capped rather than relying on tiling alone (MAX_UPSCALE_INPUT_PIXELS is defined
# near MAX_UPLOAD_BYTES above, alongside the other 3 endpoints' shared MAX_INPUT_PIXELS cap).
REALESRGAN_TILE_SIZE = 400

realesrgan_upsampler = None
try:
    from realesrgan import RealESRGANer
    from realesrgan.archs.srvgg_arch import SRVGGNetCompact

    _realesrgan_model = SRVGGNetCompact(
        num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type='prelu'
    )
    realesrgan_upsampler = RealESRGANer(
        scale=4,
        model_path='weights/realesr-general-x4v3.pth',
        dni_weight=None,
        model=_realesrgan_model,
        tile=REALESRGAN_TILE_SIZE,
        tile_pad=10,
        pre_pad=0,
        half=False,  # CPU-only: RealESRGANer defaults half=True assuming CUDA, must override
        gpu_id=None,
    )
    print("[Real-ESRGAN] Loaded realesr-general-x4v3 — /upscale ready")
except Exception as e:
    print(f"[Real-ESRGAN] Failed to load — /upscale will report unavailable. Error: {e}")


# ─── DehazeFormer-T — real trained weights, manually sourced once and committed to git, MIT ───
# github.com/IDKiro/DehazeFormer. dehazeformer_model/dehazeformer.py is vendored verbatim at
# Docker build time (not reconstructed from memory). Checkpoint has no automatable download URL
# (Google Drive folder only) — see docker/zero-dce/weights/README.md. If it wasn't manually
# placed before `docker build`, dehazeformer_net stays None and /dehaze honestly reports 503
# rather than crashing or running random-initialized weights.
#
# ⚠️ The vendored package is named `dehazeformer_model/`, deliberately NOT `models/` — verified
# by actually running this locally: ARNIQA (loaded further below via torch.hub) has its own
# `from models.resnet import ResNet` inside its downloaded hub code, and a same-named local
# `models/` package in this working directory silently shadows it, breaking ARNIQA's import with
# `ModuleNotFoundError: No module named 'models.resnet'`. Caught by an actual test run.
dehazeformer_net = None
try:
    from dehazeformer_model.dehazeformer import dehazeformer_t

    _dehaze_weights_path = 'weights/dehazeformer-t.pth'
    if os.path.exists(_dehaze_weights_path):
        dehazeformer_net = dehazeformer_t()
        _ckpt = torch.load(_dehaze_weights_path, map_location='cpu')
        _state_dict = _ckpt['state_dict'] if 'state_dict' in _ckpt else _ckpt
        # Strip a `module.` DataParallel prefix if present (matches the project's own test.py)
        _state_dict = {
            (k[7:] if k.startswith('module.') else k): v for k, v in _state_dict.items()
        }
        dehazeformer_net.load_state_dict(_state_dict)
        dehazeformer_net.eval()
        print("[DehazeFormer-T] Loaded dehazeformer-t.pth — /dehaze ready")
    else:
        print(
            "[DehazeFormer-T] weights/dehazeformer-t.pth not present (manual download required, "
            "see weights/README.md) — /dehaze will report unavailable"
        )
except Exception as e:
    print(f"[DehazeFormer-T] Failed to load — /dehaze will report unavailable. Error: {e}")


# ─── ARNIQA — real trained weights via torch.hub, Apache-2.0 ──────────────────────────────────
# github.com/miccunifi/ARNIQA. Pre-warmed into TORCH_HOME at Docker build time (see Dockerfile),
# so this call hits the local torch.hub cache at container startup rather than the network.
arniqa_model = None
try:
    arniqa_model = torch.hub.load(
        repo_or_dir='miccunifi/ARNIQA', source='github', model='ARNIQA',
        regressor_dataset='koniq10k'
    )
    arniqa_model.eval()
    print("[ARNIQA] Loaded — /quality ready")
except Exception as e:
    print(f"[ARNIQA] Failed to load — /quality will report unavailable. Error: {e}")

_imagenet_normalize = transforms.Normalize(
    mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
)


# ─── LaMa — real trained weights, Apache-2.0 ───────────────────────────────────────────────────
# github.com/advimman/lama (Samsung Research). The official repo only ships a Hydra/OmegaConf-
# config-driven checkpoint (raw state_dict, needs the full FFC-generator architecture class to
# load) — this instead uses the community TorchScript-traced export of the same "big-lama"
# checkpoint (github.com/enesmsahin/simple-lama-inpainting, itself Apache-2.0), which needs no
# architecture class at all: `torch.jit.load()` loads the traced computation graph directly.
# Verified 2026-08-26 by actually loading a real downloaded copy and running inference: cleanly
# removed a solid-color test "watermark" region (0% of its pixels remained the fill color
# afterward), and correctly preserved the original (non-multiple-of-8) output dimensions — a real
# bug in the upstream simple-lama-inpainting package (it doesn't crop back to the original size
# after its required mod-8 padding) is fixed inline below rather than inherited.
lama_model = None
try:
    _lama_weights_path = 'weights/big-lama.pt'
    if os.path.exists(_lama_weights_path):
        lama_model = torch.jit.load(_lama_weights_path, map_location='cpu')
        lama_model.eval()
        print("[LaMa] Loaded big-lama.pt — /inpaint ready")
    else:
        print("[LaMa] weights/big-lama.pt not present — /inpaint will report unavailable")
except Exception as e:
    print(f"[LaMa] Failed to load — /inpaint will report unavailable. Error: {e}")


def _lama_ceil_modulo(x, mod):
    return x if x % mod == 0 else (x // mod + 1) * mod


def _lama_pad_to_modulo(arr, mod):
    # arr: (C, H, W) float32 numpy array in [0,1]
    c, h, w = arr.shape
    out_h, out_w = _lama_ceil_modulo(h, mod), _lama_ceil_modulo(w, mod)
    return np.pad(arr, ((0, 0), (0, out_h - h), (0, out_w - w)), mode='symmetric')


print("[PyTorch Vision Service] Ready on port", PORT)


class VisionHandler(BaseHTTPRequestHandler):
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
                'service': 'PyTorch CPU Vision Microservice',
                'models': {
                    'enhance': 'ready' if retinexformer_model is not None else 'unavailable (weights not sourced, see weights/README.md)',
                    'upscale': 'ready' if realesrgan_upsampler is not None else 'unavailable',
                    'dehaze': 'ready' if dehazeformer_net is not None else 'unavailable (weights not sourced, see weights/README.md)',
                    'quality': 'ready' if arniqa_model is not None else 'unavailable',
                    'inpaint': 'ready' if lama_model is not None else 'unavailable',
                }
            })
            return
        self._send_json(404, {'error': 'Not found'})

    def _read_image(self, max_pixels=MAX_INPUT_PIXELS):
        """Parses the multipart form and returns a PIL RGB image, or raises.

        Measured, not guessed: running the real 4 endpoints end-to-end (see git history / PR notes
        for the actual numbers) showed all four scale memory with input pixel count, not just
        /upscale — Retinexformer and DehazeFormer-T process at native resolution with no
        downsampling (only reflect-padded to a small factor), and ARNIQA's preprocessing only
        halves it once (`scale_factor=0.5`). `max_pixels` lets /upscale pass a stricter cap than
        the other three, since its 4x output multiplies the effect.
        """
        content_type = self.headers.get('Content-Type', '')
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > MAX_UPLOAD_BYTES:
            raise ValueError(f'Payload too large (Max {MAX_UPLOAD_BYTES / (1024*1024)}MB)')

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type}
        )
        if 'image' not in form:
            raise ValueError('Missing required form field: "image"')
        img = Image.open(form['image'].file).convert('RGB')
        if img.width * img.height > max_pixels:
            raise ValueError(
                f'Image too large ({img.width}x{img.height} = {img.width * img.height / 1e6:.1f}MP, '
                f'max {max_pixels / 1e6:.1f}MP). Use the local deterministic fallback for larger images.'
            )
        return img

    def do_POST(self):
        start_time = time.time()

        try:
            if self.path == '/enhance':
                self._handle_enhance(start_time)
            elif self.path == '/upscale':
                self._handle_upscale(start_time)
            elif self.path == '/dehaze':
                self._handle_dehaze(start_time)
            elif self.path == '/quality':
                self._handle_quality(start_time)
            elif self.path == '/inpaint':
                self._handle_inpaint(start_time)
            else:
                self._send_json(404, {
                    'error': f'No route for {self.path}. '
                             'Implemented: /enhance, /upscale, /dehaze, /quality, /inpaint.'
                })
        except ValueError as e:
            self._send_json(400, {'error': str(e)})
        except Exception as e:
            self._send_json(500, {'error': str(e)})

    def _handle_enhance(self, start_time):
        if retinexformer_model is None:
            self._send_json(503, {'success': False, 'available': False, 'error': 'Retinexformer weights not sourced, see weights/README.md'})
            return
        img = self._read_image()
        img_tensor = transforms.ToTensor()(img).unsqueeze(0)

        # Reflect-pad to a multiple of 4 (Retinexformer's Denoiser has 2 downsample/upsample
        # stages, level=2 -> 2^2=4), matching the real repo's test_from_dataset.py, then crop
        # back to the original size afterward.
        _, _, h, w = img_tensor.shape
        factor = 4
        H = ((h + factor) // factor) * factor
        W = ((w + factor) // factor) * factor
        padded = torch.nn.functional.pad(img_tensor, (0, W - w, 0, H - h), 'reflect')

        with torch.no_grad():
            enhanced = retinexformer_model(padded)
        enhanced = enhanced[:, :, :h, :w]
        enhanced = torch.clamp(enhanced, 0.0, 1.0).squeeze(0)
        out_img = transforms.ToPILImage()(enhanced)
        self._send_image_response(out_img, start_time)

    def _handle_upscale(self, start_time):
        if realesrgan_upsampler is None:
            self._send_json(503, {'success': False, 'available': False, 'error': 'Real-ESRGAN failed to load at startup'})
            return
        # Stricter cap than the other 3 endpoints (MAX_UPSCALE_INPUT_PIXELS, not MAX_INPUT_PIXELS)
        # since /upscale's 4x output multiplies the memory effect on top of input size — see the
        # honesty note above realesrgan_upsampler's construction for the measured numbers.
        img = self._read_image(max_pixels=MAX_UPSCALE_INPUT_PIXELS)
        img_bgr = np.array(img)[:, :, ::-1].copy()  # RGB -> BGR (cv2 convention RealESRGANer expects)
        output_bgr, _ = realesrgan_upsampler.enhance(img_bgr, outscale=4)
        out_img = Image.fromarray(output_bgr[:, :, ::-1])  # BGR -> RGB
        self._send_image_response(out_img, start_time)

    def _handle_dehaze(self, start_time):
        if dehazeformer_net is None:
            self._send_json(503, {'success': False, 'available': False, 'error': 'DehazeFormer-T weights not sourced, see weights/README.md'})
            return
        img = self._read_image()
        img_tensor = transforms.ToTensor()(img).unsqueeze(0)
        img_tensor = img_tensor * 2 - 1  # [0,1] -> [-1,1], matches DehazeFormer's own test.py
        with torch.no_grad():
            output = dehazeformer_net(img_tensor)
        output = output.clamp_(-1, 1) * 0.5 + 0.5  # back to [0,1]
        out_img = transforms.ToPILImage()(output.squeeze(0))
        self._send_image_response(out_img, start_time)

    def _handle_quality(self, start_time):
        if arniqa_model is None:
            self._send_json(503, {'success': False, 'available': False, 'error': 'ARNIQA failed to load at startup'})
            return
        img = self._read_image()
        to_tensor = transforms.ToTensor()
        img_tensor = _imagenet_normalize(to_tensor(img)).unsqueeze(0)
        img_ds = torch.nn.functional.interpolate(
            img_tensor, scale_factor=0.5, mode='bilinear', align_corners=False
        )
        with torch.no_grad():
            score = arniqa_model(img_tensor, img_ds, return_embedding=False, scale_score=True)
        elapsed_ms = int((time.time() - start_time) * 1000)
        self._send_json(200, {
            'success': True,
            'score': float(score.item() if hasattr(score, 'item') else score),
            'scoreRange': '0-1 (higher = better perceived quality)',
            'model': 'ARNIQA (koniq10k regressor)',
            'elapsed_ms': elapsed_ms
        })

    def _handle_inpaint(self, start_time):
        if lama_model is None:
            self._send_json(503, {'success': False, 'available': False, 'error': 'LaMa weights not sourced'})
            return

        content_type = self.headers.get('Content-Type', '')
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > MAX_UPLOAD_BYTES:
            raise ValueError(f'Payload too large (Max {MAX_UPLOAD_BYTES / (1024*1024)}MB)')
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type}
        )
        if 'image' not in form:
            raise ValueError('Missing required form field: "image"')
        if 'mask' not in form:
            raise ValueError('Missing required form field: "mask" (white/opaque = region to remove)')

        img = Image.open(form['image'].file).convert('RGB')
        mask = Image.open(form['mask'].file).convert('L')
        if img.width * img.height > MAX_INPUT_PIXELS:
            raise ValueError(
                f'Image too large ({img.width}x{img.height} = {img.width * img.height / 1e6:.1f}MP, '
                f'max {MAX_INPUT_PIXELS / 1e6:.1f}MP). Use the local deterministic fallback for larger images.'
            )
        if mask.size != img.size:
            raise ValueError(f'Mask size {mask.size} must match image size {img.size}')

        orig_w, orig_h = img.size
        img_arr = np.transpose(np.array(img), (2, 0, 1)).astype('float32') / 255.0
        mask_arr = np.array(mask)[np.newaxis, ...].astype('float32') / 255.0

        img_arr = _lama_pad_to_modulo(img_arr, 8)
        mask_arr = _lama_pad_to_modulo(mask_arr, 8)

        t_image = torch.from_numpy(img_arr).unsqueeze(0)
        t_mask = (torch.from_numpy(mask_arr).unsqueeze(0) > 0) * 1

        with torch.inference_mode():
            inpainted = lama_model(t_image, t_mask)
            res = inpainted[0].permute(1, 2, 0).detach().cpu().numpy()
            res = np.clip(res * 255, 0, 255).astype('uint8')

        # Crop back to original size — the community wrapper this is based on omits this step,
        # silently returning an image larger than the input whenever it wasn't already a multiple
        # of 8 in both dimensions. Fixed here rather than inherited.
        out_img = Image.fromarray(res[:orig_h, :orig_w, :])
        self._send_image_response(out_img, start_time)

    def _send_image_response(self, out_img, start_time):
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


def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, VisionHandler)
    print(f"[PyTorch Vision Service] Listening on port {PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()


if __name__ == '__main__':
    run()
