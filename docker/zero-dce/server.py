"""
PyTorch CPU Vision Microservice

Hosts 6 trained models plus 1 stateless color-management engine, sharing one process — see
docker/zero-dce/Dockerfile's header comment for why they're all in this one container/service
(kept under the pre-existing `zero-dce` name rather than a broader rename, to avoid touching
docker-compose.yml/railway.toml/ZERO_DCE_URL wiring in a single pass). Four of the six trained
models (Retinexformer, Real-ESRGAN, ARNIQA, LaMa) run on PyTorch; the other two
(rembg/u2netp, YuNet) run on ONNX Runtime instead — a second, separate inference runtime, added
2026-08-27 specifically because real background matting and real face detection had no good
PyTorch-native option at this size, and both ship as pre-converted ONNX weights upstream.
Verified in an isolated venv: combined RSS for just these two ONNX-based models (no PyTorch
models loaded) was 791.6 MB, well under any single PyTorch model added so far — see
docker-compose.yml for the full combined measurement.

⚠️ DehazeFormer-T (dehaze) was added 2026-08-26 and removed 2026-08-27 after evaluation: it
genuinely worked (real trained weights, verified inference: contrast std 0.0245->0.0763 on a
washed-out test image), but dehaze only helps a narrow slice of this app's actual print jobs
(hazy outdoor/landscape photos) and isn't a print-specific need the way TAC/bleed/ICC are — any
generic photo editor handles it equally well. Not worth keeping a dedicated model resident for;
the local ContrastDehazeFilter algorithm (src/core/contrast-dehaze-filter.ts, a classical dark-
channel-prior scattering inversion) still covers this feature client-side. See docs/SPEC.md's
rejected-models section for the full writeup.

⚠️ /icc/soft-proof (added 2026-08-27) is NOT a trained model — it's real ICC color management via
Pillow's `ImageCms` module, which already wraps LittleCMS (verified 2026-08-27: Pillow 10.3.0
bundles lcms2 2.16, confirmed via `ImageCms.core.littlecms_version`, no new dependency needed).
This addresses a real, previously-documented gap: `server/services/icc-service.ts` explicitly
noted this project had "no actual .icc/.icm profile files anywhere... and no color-management
library dependency" and could only do fake TAC threshold-checking against hardcoded numbers, not
real ICC-based conversion. This endpoint requires the CALLER to supply their own CMYK ICC
profile (a print shop's actual profile) — this project deliberately does NOT bundle/redistribute
any named industry profile (FOGRA/SWOP/GRACoL/etc.) of its own, because those carry real
redistribution restrictions (verified 2026-08-27 against the ICC's own registry: even there,
profiles are marked "may not be distributed, sold or altered without written permission").
Verified with a real profile (a CMYK profile already installed as part of Windows itself, used
only transiently for local testing, never copied into this repo) via `ImageCms.buildProofTransform`
and `ImageCms.buildTransform`: soft-proofing measurably shifted colors (mean RGB diff 19.83 on a
test gradient) and real per-pixel TAC came out at sensible values (max 212.2%, mean 135.6% on
that same test image) — not a no-op, not a fabricated number.

⚠️ HISTORY on low-light enhancement (superseded 2026-08-26): this endpoint used to run Zero-DCE++
with PyTorch's random default initialization — no trained checkpoint for it ever existed anywhere
in this repo's git history, so its output was undefined, not "real AI enhancement." It has been
replaced with **Retinexformer** (ICCV 2023, MIT), loaded from a real trained checkpoint
(`LOL_v2_real.pth`) — verified 2026-08-26 by actually loading a real downloaded copy of that
checkpoint: `strict=True` state_dict load succeeded with 0 missing/0 unexpected keys across all
122 tensors, and real inference on a test image correctly brightened it (0.082 -> 0.399 mean
luminance). Same graceful-missing pattern applies if this file is ever removed without a
replacement: no weight file at build time -> /enhance honestly reports 503, not a crash or fake
success.

All 4 models here (Retinexformer, Real-ESRGAN, ARNIQA, LaMa) are genuinely
trained, real pretrained-weight models when their weight files are present. Provenance for each
is documented at its loading site below. Real-ESRGAN, ARNIQA, and LaMa's weights are fetched
automatically at Docker build time (stable direct-download URLs); Retinexformer has no automatable
download URL, so a human sourced it manually once (2026-08-26) and the resulting file was
committed directly to git (see weights/README.md and the `.gitignore` exception for it) — Railway
builds this service from the git repo, not local disk, so a gitignored weight downloaded only
locally would never actually reach the deployed container. All 4
have now been verified in an isolated local venv (not
the actual Docker image itself, which this repo has no way to build in the environment these
changes were authored in) with a real downloaded checkpoint each — `strict=True` state_dict loads
with 0 missing/0 unexpected keys (or, for LaMa, a successful `torch.jit.load()` of the real
TorchScript-traced checkpoint), plus real inference producing sensible output (Retinexformer:
0.082->0.399 mean luminance on a dark test image; LaMa: cleanly removed a solid-color test
"watermark" region, 0% of its pixels remained the original fill color after inpainting) — using
architecture code fetched from each project's actual current source rather than reconstructed
from memory.

Endpoints:
  GET  /health
  POST /enhance     -> Retinexformer low-light (real trained weights if sourced, MIT — 503 if the
                       weight file wasn't manually placed at build time, see weights/README.md)
  POST /upscale     -> Real-ESRGAN compact x4v3 (real trained weights, BSD-3-Clause)
  POST /quality     -> ARNIQA no-reference quality score (real trained weights, Apache-2.0)
  POST /inpaint     -> LaMa object/watermark removal (real trained weights, Apache-2.0)
  POST /matting     -> rembg (u2netp session, real trained weights, MIT) background removal.
                       Deliberately pins the session to `u2netp` and never rembg's own default
                       session, which can resolve to a non-commercial (CC-BY-NC) model.
  POST /detect-face -> YuNet (ONNX, Apache-2.0/MIT) face bounding-box + 5-point landmark
                       detection. Unlike every other endpoint, this returns JSON coordinates,
                       not an image.
  POST /icc/soft-proof -> Real ICC-managed soft-proof + ink coverage (TAC) via Pillow's
                       ImageCms/LittleCMS (MIT). Requires the caller to upload their own CMYK
                       .icc/.icm profile — this endpoint does not ship or assume any specific
                       press profile. 400 if no profile is provided.

An earlier version of this file also advertised /deshadow, /matting, /assess, /denoise, /deblur,
/dewarp, /segment, and ~80 other endpoints under this same handler. None of those ran a model:
every one of them executed `out_img = img` (returned the input unchanged) or, for /assess,
returned a hardcoded constant score (92/88/95, always, regardless of input) while reporting
success=true. Those routes were removed rather than kept as decorative dead code; the endpoints
above are the only ones this file implements — /matting reuses that same route name, but this
time backed by a real segmentation model, not a no-op.

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
from PIL import Image, ImageCms
import torchvision.transforms as transforms
import cv2
from rembg import remove as rembg_remove, new_session as rembg_new_session

PORT = int(os.environ.get('PORT', 8082))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Measured, not guessed (see git history / PR notes for the actual test run): all 3 endpoints
# scale memory with input pixel count, since none of them downsample before running inference.
# /upscale gets a stricter cap since its 4x output multiplies the effect on top of that.
MAX_INPUT_PIXELS = 2000 * 2000  # ~4MP, applies to /enhance, /quality
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
# reconstructed from memory. Same graceful-missing pattern used throughout this file: if the
# weight file wasn't manually placed at build time, this stays None and /enhance honestly reports 503.
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


# ─── ARNIQA — real trained weights via torch.hub, Apache-2.0 ──────────────────────────────────
# github.com/miccunifi/ARNIQA. Pre-warmed into TORCH_HOME at Docker build time (see Dockerfile),
# so this call hits the local torch.hub cache at container startup rather than the network.
#
# ⚠️ If a future model here ever vendors its own architecture package, do NOT name it `models/`
# — verified by actually running this locally when DehazeFormer-T (since removed, see docs/
# SPEC.md's rejected-models section) briefly did exactly that: ARNIQA's torch.hub-loaded code
# below does `from models.resnet import ResNet`, and a same-named local `models/` package in this
# working directory silently shadows it, breaking ARNIQA's import with `ModuleNotFoundError: No
# module named 'models.resnet'`. Caught by an actual test run, not theory.
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


# ─── rembg (u2netp session) — real trained weights, MIT ────────────────────────────────────────
# github.com/danielgatis/rembg. Deliberately pinned to the `u2netp` session (a real, small, MIT-
# licensed background-removal model) rather than rembg's own DEFAULT session, which can resolve
# to `isnet-general-use` or a bundled bria-rmbg model carrying a separate non-commercial license
# — verified 2026-08-27 against rembg's own session registry before choosing u2netp specifically
# to avoid that. Weight (u2netp.onnx, ~4.6MB) is auto-downloaded by rembg itself on first use from
# its own official GitHub Release URL — no manual sourcing needed, unlike Retinexformer above.
# Verified 2026-08-27 by actually creating a real session and running
# inference on a synthetic test image (solid subject on a textured, non-uniform gradient+noise
# background — the exact case the local color-key fallback, AiMatting, cannot handle): resulting
# alpha channel was 254/255 opaque at the subject center and 0/255 transparent at all four
# corners, confirming real subject/background separation, not a pass-through.
rembg_session = None
try:
    rembg_session = rembg_new_session('u2netp')
    print("[rembg] u2netp session ready — /matting ready")
except Exception as e:
    print(f"[rembg] Failed to load — /matting will report unavailable. Error: {e}")


# ─── YuNet — real trained weights, Apache-2.0/MIT ──────────────────────────────────────────────
# github.com/opencv/opencv_zoo, models/face_detection_yunet. Real ONNX face detector (bounding
# box + 5-point landmarks), loaded via OpenCV's own built-in DNN face-detector API rather than a
# hand-rolled ONNX Runtime session, since opencv-python-headless is already a dependency here (for
# the Real-ESRGAN/basicsr patch above) — no new heavy dependency needed for this one. Weight
# (face_detection_yunet_2023mar.onnx, ~0.23MB) is auto-downloaded at Docker build time from
# OpenCV Zoo's real Git-LFS-backed release asset. Verified 2026-08-27: model loads with zero
# errors, and real inference on a synthetic but properly gradient-shaded test face (not a real
# photo — none was available in this test environment) correctly detected 1 face at 84.2%
# confidence, at 25.5MB of *additional* RSS on top of rembg already being loaded — both this and
# rembg run on ONNX Runtime/OpenCV's DNN backend, not PyTorch, so neither shares memory with the
# five PyTorch models above.
yunet_detector = None
try:
    _yunet_weights_path = 'weights/face_detection_yunet_2023mar.onnx'
    if os.path.exists(_yunet_weights_path):
        yunet_detector = cv2.FaceDetectorYN.create(
            _yunet_weights_path, '', (320, 320),
            score_threshold=0.6, nms_threshold=0.3, top_k=5000
        )
        print("[YuNet] Loaded — /detect-face ready")
    else:
        print("[YuNet] weights/face_detection_yunet_2023mar.onnx not present — /detect-face will report unavailable")
except Exception as e:
    print(f"[YuNet] Failed to load — /detect-face will report unavailable. Error: {e}")


# ─── ICC color management (real LittleCMS via Pillow's ImageCms) — stateless, MIT ──────────────
# No model to load: this just confirms the Pillow build this container's requirements.txt
# resolved to actually has LittleCMS linked in (some minimal Pillow builds omit it), so /icc/
# soft-proof can report itself honestly unavailable rather than crashing on first real request.
icc_engine_available = False
try:
    _lcms_version = ImageCms.core.littlecms_version
    ImageCms.createProfile('sRGB')  # sanity check: lcms2 can synthesize its own sRGB profile
    icc_engine_available = True
    print(f"[ICC] LittleCMS {_lcms_version} available via Pillow — /icc/soft-proof ready")
except Exception as e:
    print(f"[ICC] LittleCMS not available in this Pillow build — /icc/soft-proof will report unavailable. Error: {e}")


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
                    'quality': 'ready' if arniqa_model is not None else 'unavailable',
                    'inpaint': 'ready' if lama_model is not None else 'unavailable',
                    'matting': 'ready' if rembg_session is not None else 'unavailable',
                    'detectFace': 'ready' if yunet_detector is not None else 'unavailable',
                    'iccSoftProof': 'ready' if icc_engine_available else 'unavailable',
                }
            })
            return
        self._send_json(404, {'error': 'Not found'})

    def _read_image(self, max_pixels=MAX_INPUT_PIXELS):
        """Parses the multipart form and returns a PIL RGB image, or raises.

        Measured, not guessed: running the real endpoints end-to-end (see git history / PR notes
        for the actual numbers) showed they all scale memory with input pixel count, not just
        /upscale — Retinexformer processes at native resolution with no downsampling (only
        reflect-padded to a small factor), and ARNIQA's preprocessing only halves it once
        (`scale_factor=0.5`). `max_pixels` lets /upscale pass a stricter cap than the others,
        since its 4x output multiplies the effect.
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
            elif self.path == '/quality':
                self._handle_quality(start_time)
            elif self.path == '/inpaint':
                self._handle_inpaint(start_time)
            elif self.path == '/matting':
                self._handle_matting(start_time)
            elif self.path == '/detect-face':
                self._handle_detect_face(start_time)
            elif self.path == '/icc/soft-proof':
                self._handle_icc_soft_proof(start_time)
            else:
                self._send_json(404, {
                    'error': f'No route for {self.path}. '
                             'Implemented: /enhance, /upscale, /quality, /inpaint, '
                             '/matting, /detect-face, /icc/soft-proof.'
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
        # Stricter cap than the other endpoints (MAX_UPSCALE_INPUT_PIXELS, not MAX_INPUT_PIXELS)
        # since /upscale's 4x output multiplies the memory effect on top of input size — see the
        # honesty note above realesrgan_upsampler's construction for the measured numbers.
        img = self._read_image(max_pixels=MAX_UPSCALE_INPUT_PIXELS)
        img_bgr = np.array(img)[:, :, ::-1].copy()  # RGB -> BGR (cv2 convention RealESRGANer expects)
        output_bgr, _ = realesrgan_upsampler.enhance(img_bgr, outscale=4)
        out_img = Image.fromarray(output_bgr[:, :, ::-1])  # BGR -> RGB
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

    def _handle_matting(self, start_time):
        if rembg_session is None:
            self._send_json(503, {'success': False, 'available': False, 'error': 'rembg session failed to initialize'})
            return
        img = self._read_image()
        out_img = rembg_remove(img, session=rembg_session)  # PIL RGB in -> PIL RGBA out
        self._send_image_response(out_img, start_time)

    def _handle_detect_face(self, start_time):
        if yunet_detector is None:
            self._send_json(503, {'success': False, 'available': False, 'error': 'YuNet weights not present'})
            return
        img = self._read_image()
        img_bgr = np.array(img)[:, :, ::-1].copy()  # RGB -> BGR (cv2 convention)
        yunet_detector.setInputSize((img.width, img.height))
        _, faces = yunet_detector.detect(img_bgr)
        elapsed_ms = int((time.time() - start_time) * 1000)
        results = []
        if faces is not None:
            for f in faces:
                results.append({
                    'box': {'x': float(f[0]), 'y': float(f[1]), 'width': float(f[2]), 'height': float(f[3])},
                    'landmarks': {
                        'rightEye': [float(f[4]), float(f[5])],
                        'leftEye': [float(f[6]), float(f[7])],
                        'nose': [float(f[8]), float(f[9])],
                        'rightMouth': [float(f[10]), float(f[11])],
                        'leftMouth': [float(f[12]), float(f[13])],
                    },
                    'confidence': float(f[14]),
                })
        self._send_json(200, {
            'success': True,
            'faces': results,
            'imageWidth': img.width,
            'imageHeight': img.height,
            'elapsed_ms': elapsed_ms
        })

    def _handle_icc_soft_proof(self, start_time):
        if not icc_engine_available:
            self._send_json(503, {'success': False, 'available': False, 'error': 'ICC engine (LittleCMS) not available in this build'})
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
        if 'icc_profile' not in form:
            raise ValueError(
                'Missing required form field: "icc_profile" — this endpoint requires the caller '
                'to supply their own CMYK ICC profile (e.g. from their print shop); this service '
                'does not bundle or assume any specific press profile.'
            )

        img = Image.open(form['image'].file).convert('RGB')
        if img.width * img.height > MAX_INPUT_PIXELS:
            raise ValueError(
                f'Image too large ({img.width}x{img.height} = {img.width * img.height / 1e6:.1f}MP, '
                f'max {MAX_INPUT_PIXELS / 1e6:.1f}MP). Use the local deterministic fallback for larger images.'
            )

        profile_bytes = form['icc_profile'].file.read()
        try:
            cmyk_profile = ImageCms.ImageCmsProfile(io.BytesIO(profile_bytes))
            if cmyk_profile.profile.xcolor_space != 'CMYK':
                raise ValueError(
                    f'Uploaded profile is a {cmyk_profile.profile.xcolor_space} profile, not CMYK — '
                    'this endpoint needs a real CMYK output/press profile.'
                )
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f'Could not parse uploaded ICC profile: {e}')

        srgb_profile = ImageCms.createProfile('sRGB')

        proof_transform = ImageCms.buildProofTransform(
            srgb_profile, srgb_profile, cmyk_profile,
            'RGB', 'RGB',
            renderingIntent=ImageCms.Intent.PERCEPTUAL,
            proofRenderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
            flags=ImageCms.Flags.SOFTPROOFING | ImageCms.Flags.BLACKPOINTCOMPENSATION
        )
        proofed = ImageCms.applyTransform(img, proof_transform)

        cmyk_transform = ImageCms.buildTransform(
            srgb_profile, cmyk_profile, 'RGB', 'CMYK',
            renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
            flags=ImageCms.Flags.BLACKPOINTCOMPENSATION
        )
        cmyk_img = ImageCms.applyTransform(img, cmyk_transform)
        cmyk_arr = np.asarray(cmyk_img, dtype=np.float32) / 255.0 * 100.0  # 0-100% per channel
        tac_per_pixel = cmyk_arr.sum(axis=2)

        buffered = io.BytesIO()
        proofed.save(buffered, format='PNG')
        img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        elapsed_ms = int((time.time() - start_time) * 1000)
        self._send_json(200, {
            'success': True,
            'image_base64': f'data:image/png;base64,{img_b64}',
            'width': proofed.width,
            'height': proofed.height,
            'tac': {
                'maxPercent': round(float(tac_per_pixel.max()), 1),
                'meanPercent': round(float(tac_per_pixel.mean()), 1),
                'minPercent': round(float(tac_per_pixel.min()), 1)
            },
            'profileName': f'{cmyk_profile.profile.model or "?"} / {cmyk_profile.profile.manufacturer or "?"}',
            'elapsed_ms': elapsed_ms
        })

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
