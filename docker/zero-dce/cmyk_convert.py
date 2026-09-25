"""sRGB -> press CMYK separation for the print PDF (real ICC transform via Pillow's ImageCms/LittleCMS).

Added 2026-09-25. Unlike /icc/soft-proof (which only uses a profile the user uploads), this converts
with the press profile the user picked in the app's colour-profile menu. The four profiles are
Adobe's published ones, downloaded from adobe.com when the Docker image is built (see Dockerfile) —
they are not committed to git and never sent to the browser. The PDF the browser builds references
the printing condition by its ICC-registered name (OutputConditionIdentifier) and does not embed
the profile.

Kept free of torch/model imports so it can be exercised on its own:
    python cmyk_convert.py <input.png> <profile-id>
"""

import io
import os
import zlib

import numpy as np
from PIL import Image, ImageCms

ICC_DIR = os.environ.get('CMYK_PROFILE_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icc'))

# id (src/core/icc-profiles.ts) -> Adobe profile file, ICC-registered characterization name
# (registry.color.org/cmyk-registry), and the condition text written into the PDF OutputIntent.
PROFILES = {
    'japan-color-2001-coated': ('JapanColor2001Coated.icc', 'JC200103', 'Japan Color 2001 Coated'),
    'japan-color-2001-uncoated': ('JapanColor2001Uncoated.icc', 'JC200104', 'Japan Color 2001 Uncoated'),
    'iso-coated-v2-fogra39': ('CoatedFOGRA39.icc', 'FOGRA39', 'Coated FOGRA39 (ISO 12647-2:2004)'),
    'gracol-2006-coated': ('CoatedGRACoL2006.icc', 'CGATS TR 006', 'Coated GRACoL 2006 (ISO 12647-2:2004)'),
}

# A3 at 300 DPI with bleed is ~18.5MP; this leaves room for larger presets while bounding memory
# (RGB + CMYK + TAC array for 40MP is well under 1GB).
MAX_CMYK_PIXELS = 40_000_000

_srgb = None
_transforms = {}


def available_profiles():
    return [pid for pid, (fname, _, _) in PROFILES.items() if os.path.isfile(os.path.join(ICC_DIR, fname))]


def _transform(profile_id):
    global _srgb
    if profile_id not in PROFILES:
        raise ValueError(f'Unknown CMYK profile id: {profile_id}')
    if profile_id in _transforms:
        return _transforms[profile_id]
    path = os.path.join(ICC_DIR, PROFILES[profile_id][0])
    if not os.path.isfile(path):
        raise FileNotFoundError(f'Profile file not installed: {PROFILES[profile_id][0]}')
    if _srgb is None:
        _srgb = ImageCms.createProfile('sRGB')
    # Relative colorimetric + black point compensation: Photoshop's default RGB->CMYK conversion,
    # i.e. what a print shop would do to an RGB file it receives.
    t = ImageCms.buildTransform(
        _srgb, ImageCms.ImageCmsProfile(path), 'RGB', 'CMYK',
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
        flags=ImageCms.Flags.BLACKPOINTCOMPENSATION,
    )
    _transforms[profile_id] = t
    return t


def convert_png_to_cmyk(png_bytes, profile_id):
    """Returns (zlib-compressed CMYK samples, info dict).

    The compressed bytes are exactly a PDF /FlateDecode stream of 8-bit DeviceCMYK samples
    (0 = no ink, 255 = full ink), row-major, no predictor — the browser drops them straight into
    the PDF image XObject. Transparent pixels are composited onto white first (print has no alpha).
    """
    if png_bytes[:8] != b'\x89PNG\r\n\x1a\n' or len(png_bytes) < 24:
        raise ValueError('Body must be a PNG image')
    width = int.from_bytes(png_bytes[16:20], 'big')
    height = int.from_bytes(png_bytes[20:24], 'big')
    if width * height > MAX_CMYK_PIXELS:
        raise ValueError(
            f'Image too large ({width}x{height} = {width * height / 1e6:.1f}MP, '
            f'max {MAX_CMYK_PIXELS / 1e6:.0f}MP)'
        )

    # server.py sets Image.MAX_IMAGE_PIXELS to 4MP for the model endpoints, which would reject a
    # 300 DPI print page. The size was checked above and the server is single-threaded
    # (HTTPServer), so lifting the limit for this decode only is safe.
    saved_limit = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = None
    try:
        img = Image.open(io.BytesIO(png_bytes))
        img.load()
    finally:
        Image.MAX_IMAGE_PIXELS = saved_limit

    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        rgba = img.convert('RGBA')
        white = Image.new('RGBA', rgba.size, (255, 255, 255, 255))
        img = Image.alpha_composite(white, rgba)
    img = img.convert('RGB')

    cmyk = ImageCms.applyTransform(img, _transform(profile_id))
    samples = cmyk.tobytes()
    tac = np.frombuffer(samples, dtype=np.uint8).reshape(-1, 4).sum(axis=1, dtype=np.uint32)

    _, condition_id, condition = PROFILES[profile_id]
    info = {
        'width': cmyk.width,
        'height': cmyk.height,
        'profileId': profile_id,
        'outputConditionIdentifier': condition_id,
        'outputCondition': condition,
        'tacMaxPercent': round(float(tac.max()) / 255 * 100, 1),
        'tacMeanPercent': round(float(tac.mean()) / 255 * 100, 1),
    }
    return zlib.compress(samples, 6), info


if __name__ == '__main__':
    import sys
    import time

    src, pid = sys.argv[1], sys.argv[2]
    t0 = time.time()
    data, meta = convert_png_to_cmyk(open(src, 'rb').read(), pid)
    meta['compressedBytes'] = len(data)
    meta['ms'] = int((time.time() - t0) * 1000)
    print(meta)
