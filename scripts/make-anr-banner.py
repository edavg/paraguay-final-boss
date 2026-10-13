# Builds assets/webp/environment/banner-anr.webp: the ANR flag (red field, white
# star, "ANR") as a torn cathedral banner. The silhouette, rod, tabs, rips and
# holes are taken from the bone banner (column 1 of banner-atlas.webp) so the
# new banner hangs and tears exactly like the originals; the cloth colour, the
# weathering and the logo are painted here.
#   python3 scripts/make-anr-banner.py
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / 'assets/webp/environment/banner-atlas.webp'
OUT = ROOT / 'assets/webp/environment/banner-anr.webp'
W, H = 512, 1024          # 2x the atlas cell across, so the lettering stays crisp
ROD = 46                  # rows of rod and tabs kept from the original pixels
# A nave banner is ~2.4 x 6.5 m on a 1:2 texture: each texel is 1.35x taller
# than wide in the world, so the logo is drawn squashed by that much.
SQUASH = (W / 2.4) / (H / 6.5)

rng = np.random.default_rng(7)
atlas = Image.open(ATLAS).convert('RGBA')
cell = atlas.crop((256, 0, 512, 1024)).resize((W, H), Image.LANCZOS)
src = np.asarray(cell).astype(np.float32) / 255
alpha = src[..., 3]


def blur(a, r):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def noise(scale, seed):
    small = np.random.default_rng(seed).random((H // scale + 2, W // scale + 2))
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((W + 2 * scale, H + 2 * scale), Image.BICUBIC)
    return np.asarray(img).astype(np.float32)[:H, :W] / 255


# Weave and speckle. Not taken from the original cloth: its painted crown
# showed through as a ghost however hard the detail was clipped.
detail = (.86 + .2 * noise(1, 8)) * (.9 + .16 * noise(3, 9))
# Burnt, darkened edges around every tear and hole, as on the originals.
edge = blur(alpha, 9) ** 1.6
grime = (.55 + .45 * noise(48, 1)) * (.75 + .25 * noise(10, 2))
# Soot and damp climbing from the hem, lighter toward the rod.
ys = np.linspace(0, 1, H)[:, None]
vertical = 1 - .38 * ys ** 1.5
shade = np.clip(detail * (.35 + .65 * edge) * (.55 + .45 * grime) * vertical, 0, 1.2)

red = np.array([.55, .03, .05])
cloth = red[None, None, :] * shade[..., None]

# The logo, drawn at 4x and squashed into the banner's texel aspect.
S = 4
logo = Image.new('L', (W * S, int(H * S * SQUASH)), 0)
draw = ImageDraw.Draw(logo)
# The cloth spans x = 80..426 here; the lettering takes ~70% of it.
CENTER, TEXT_W = 253, 262
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Black.ttf', 100 * S)
font = font.font_variant(size=int(100 * S * TEXT_W * S / draw.textlength('ANR', font=font)))
text_w = draw.textlength('ANR', font=font)
left = CENTER * S - text_w / 2
top = .27 * logo.height
r = TEXT_W * S * .17
cx, cy = left + r * .95, top + r
star = [(cx + np.cos(-np.pi / 2 + i * np.pi / 5) * (r if i % 2 == 0 else r * .382),
         cy + np.sin(-np.pi / 2 + i * np.pi / 5) * (r if i % 2 == 0 else r * .382)) for i in range(10)]
draw.polygon(star, fill=255)
draw.text((left, cy + r * 1.35), 'ANR', font=font, fill=255)
logo = logo.resize((W * S, H * S), Image.LANCZOS).resize((W, H), Image.LANCZOS)
paint = np.asarray(logo).astype(np.float32) / 255
# Worn paint: flaked where coarse noise is low, rubbed thin by the weave.
flake = np.clip((noise(6, 3) * .6 + noise(22, 4) * .4 - .16) * 5, 0, 1)
paint *= flake * (.8 + .2 * noise(3, 5))
bone = np.array([.86, .82, .74])[None, None, :] * shade[..., None] * 1.25
color = cloth * (1 - paint[..., None]) + bone * paint[..., None]

# Rod and tabs: the original pixels, blended into the new cloth below them.
keep = np.clip((ROD + 8 - np.arange(H)) / 8, 0, 1)[:, None, None]
color = src[..., :3] * keep + color * (1 - keep)

out = np.dstack([np.clip(color, 0, 1), alpha])
Image.fromarray((out * 255).astype(np.uint8)).save(OUT, 'WEBP', quality=82, method=6, alpha_quality=90)
print(OUT, OUT.stat().st_size, 'bytes')
