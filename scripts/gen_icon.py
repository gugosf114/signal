"""Regenerate the Android launcher icon — 株 logomark.

George's call: the icon is just the 株 kanji from the wordmark. Single
character, JP red on dark canvas, vertical-gradient sheen to match the
wordmark inside the app. Sized to ~55% of the canvas so it sits well
inside Android's 66% adaptive-icon safe zone — Samsung's squircle mask
can't crop it.

  - Background: dark canvas #08090A.
  - 株 rendered in JP red (#C44040 base, light-to-dark vertical
    gradient #E96565 → #C44040 → #9C3030) for ambient sheen — same
    gradient the wordmark uses inside the app.
  - Bold CJK font (Yu Gothic Bold / Noto Sans CJK Bold / Microsoft
    YaHei Bold), centered both axes, optical adjustments for kanji
    metrics so the glyph reads centered.
"""

import os
import glob
from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RES_DIR = os.path.join(PROJECT_ROOT, "android", "app", "src", "main", "res")

# Bold CJK fonts available on Windows. Yu Gothic Bold is the canonical
# choice for Japanese typography on Windows.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/YuGothB.ttc",       # Yu Gothic Bold
    "C:/Windows/Fonts/YuGothic-Bold.ttf",
    "C:/Windows/Fonts/msyhbd.ttc",        # Microsoft YaHei Bold
    "C:/Windows/Fonts/meiryob.ttc",       # Meiryo Bold
    "C:/Windows/Fonts/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/SimHei.ttf",
    "/system/fonts/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    "/data/data/com.termux/files/usr/var/lib/proot-distro/containers/debian/rootfs/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
]

MASTER = 1024
SAFE_ZONE_PX = int(MASTER * (66 / 108))   # 626

DENSITIES = [
    ("ldpi",    36,   81),
    ("mdpi",    48,  108),
    ("hdpi",    72,  162),
    ("xhdpi",   96,  216),
    ("xxhdpi", 144,  324),
    ("xxxhdpi",192,  432),
]

BG_CANVAS_DARK = (8, 9, 10, 255)        # #08090A — dark canvas
RED_LIGHT      = (233, 101, 101, 255)   # #E96565 — gradient top
RED_BASE       = (196, 64, 64, 255)     # #C44040 — JP red, gradient mid
RED_DARK       = (156, 48, 48, 255)     # #9C3030 — gradient bottom

KANJI = "株"


def load_font(size_px):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size_px)
            except Exception:
                continue
    raise RuntimeError(
        "No CJK font found. Install Noto Sans CJK or add its exact path to FONT_CANDIDATES; "
        "refusing to create a tofu-box launcher icon."
    )


def _vertical_gradient_layer(canvas_size, top_rgba, mid_rgba, bot_rgba):
    """A full-canvas vertical gradient: top → mid (55%) → bot."""
    grad = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    px = grad.load()
    mid = int(canvas_size * 0.55)
    for y in range(canvas_size):
        if y <= mid:
            t = y / max(1, mid)
            r = int(top_rgba[0] + (mid_rgba[0] - top_rgba[0]) * t)
            g = int(top_rgba[1] + (mid_rgba[1] - top_rgba[1]) * t)
            b = int(top_rgba[2] + (mid_rgba[2] - top_rgba[2]) * t)
        else:
            t = (y - mid) / max(1, canvas_size - mid)
            r = int(mid_rgba[0] + (bot_rgba[0] - mid_rgba[0]) * t)
            g = int(mid_rgba[1] + (bot_rgba[1] - mid_rgba[1]) * t)
            b = int(mid_rgba[2] + (bot_rgba[2] - mid_rgba[2]) * t)
        for x in range(canvas_size):
            px[x, y] = (r, g, b, 255)
    return grad


def render_kanji(canvas_size):
    """Foreground layer: 株 kanji centered on a transparent canvas, JP-red gradient."""
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    safe = int(canvas_size * (66 / 108))
    # Target glyph height ~85% of the safe zone — sits well inside the mask.
    target_h = int(safe * 0.85)

    # Auto-fit: find a font size whose rendered glyph is just under target_h.
    font_size = target_h
    while font_size > 8:
        font = load_font(font_size)
        # Use anchor="mm" to get bbox centered at origin
        tmp_draw = ImageDraw.Draw(img)
        bbox = tmp_draw.textbbox((0, 0), KANJI, font=font, anchor="mm")
        gh = bbox[3] - bbox[1]
        gw = bbox[2] - bbox[0]
        if gh <= target_h and gw <= safe * 0.92:
            break
        font_size = int(font_size * 0.94)
    font = load_font(font_size)

    # Render the kanji into a single-channel mask, then color it with the
    # vertical gradient so the glyph carries the same ambient sheen as the
    # wordmark inside the app.
    glyph_mask = Image.new("L", (canvas_size, canvas_size), 0)
    glyph_draw = ImageDraw.Draw(glyph_mask)
    cx = canvas_size // 2
    cy = canvas_size // 2
    # Yu Gothic puts noticeable side bearing on kanji — nudge the glyph
    # so its optical center sits dead-centered visually.
    glyph_draw.text((cx, cy), KANJI, font=font, fill=255, anchor="mm")

    gradient = _vertical_gradient_layer(canvas_size, RED_LIGHT, RED_BASE, RED_DARK)
    # Apply glyph_mask as alpha to gradient
    gradient.putalpha(glyph_mask)
    img.alpha_composite(gradient)

    return img


def render_splash(width, height):
    """Dark launch canvas with one centered, safe-zone-aware 株 mark."""
    splash = Image.new("RGBA", (width, height), BG_CANVAS_DARK)
    side = max(64, int(min(width, height) * 0.42))
    logo = render_kanji(side)
    splash.alpha_composite(logo, ((width - side) // 2, (height - side) // 2))
    return splash


def main():
    print(f"Output dir: {RES_DIR}")
    if not os.path.isdir(RES_DIR):
        raise SystemExit(f"Missing res dir: {RES_DIR}")

    for suffix, legacy_px, layer_px in DENSITIES:
        mipmap_dir = os.path.join(RES_DIR, f"mipmap-{suffix}")
        os.makedirs(mipmap_dir, exist_ok=True)

        # Legacy launcher (pre-Android 8) — composite flap onto dark canvas.
        legacy = Image.new("RGBA", (legacy_px, legacy_px), BG_CANVAS_DARK)
        legacy.alpha_composite(render_kanji(legacy_px))
        legacy.save(os.path.join(mipmap_dir, "ic_launcher.png"))
        legacy.save(os.path.join(mipmap_dir, "ic_launcher_round.png"))

        # Adaptive (Android 8+) — background = dark canvas, foreground = flap.
        background = Image.new("RGBA", (layer_px, layer_px), BG_CANVAS_DARK)
        background.save(os.path.join(mipmap_dir, "ic_launcher_background.png"))
        render_kanji(layer_px).save(
            os.path.join(mipmap_dir, "ic_launcher_foreground.png")
        )

        print(f"  {suffix:8s}  legacy={legacy_px}px  layer={layer_px}px")

    splash_paths = sorted(glob.glob(os.path.join(RES_DIR, "drawable*", "splash.png")))
    for splash_path in splash_paths:
        with Image.open(splash_path) as current:
            width, height = current.size
        render_splash(width, height).save(splash_path)
    print(f"  splash   regenerated {len(splash_paths)} density/orientation files")

    print("Done.")


if __name__ == "__main__":
    main()
