"""Regenerate the Android launcher icon — portrait card with a sparkline.

The kanji-only variant communicated "Japanese" instead of "multi-signal
trading card intelligence." JP is one of nine signals (~40-50% of the
grade), not the headline. This design drops 株 from the icon entirely:
a cream portrait card silhouette holds a stylized rising sparkline,
reading as "trading card + market data" at any size.

Every variant fits inside Android's 66% adaptive-icon safe zone so
Samsung's squircle mask cannot crop the card.
"""

import os
from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RES_DIR = os.path.join(PROJECT_ROOT, "android", "app", "src", "main", "res")

# Font candidates that ship with Windows and support CJK
FONT_CANDIDATES = [
    "C:/Windows/Fonts/YuGothB.ttc",
    "C:/Windows/Fonts/msyhbd.ttc",
    "C:/Windows/Fonts/meiryob.ttc",
    "C:/Windows/Fonts/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/SimHei.ttf",
]

MASTER = 1024
# Safe zone is the inner 66% of the 108dp viewport for adaptive icons.
SAFE_ZONE_PX = int(MASTER * (66 / 108))   # 626

# Density buckets — (suffix, legacy_px, adaptive_layer_px)
DENSITIES = [
    ("mdpi",    48,  108),
    ("hdpi",    72,  162),
    ("xhdpi",   96,  216),
    ("xxhdpi", 144,  324),
    ("xxxhdpi",192,  432),
]

BG_COLOR      = (8, 9, 10, 255)        # #08090A — dark canvas
CARD_FILL     = (245, 241, 232, 255)   # #F5F1E8 — cream off-white
CARD_EDGE     = (196, 64, 64, 255)     # #C44040 — JP red hairline
SPARK_COLOR   = (196, 64, 64, 255)     # #C44040 — sparkline stroke
SPARK_DOT_BG  = (245, 241, 232, 255)   # ring around the terminal dot
CARD_ASPECT   = 0.716                  # TCG card width / height

# Sparkline control points (normalized to card area) — three down-ticks
# absorbed by a strong upward close. Reads as "data trending up."
SPARKLINE_POINTS = [
    (0.10, 0.74),
    (0.27, 0.56),
    (0.43, 0.66),
    (0.60, 0.42),
    (0.77, 0.50),
    (0.92, 0.20),
]


def render_card_with_sparkline(canvas_size):
    """Foreground layer: transparent canvas, centered portrait card silhouette
    with a rising sparkline inside. Safe zone = inner 66% of canvas."""
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    safe = int(canvas_size * (66 / 108))
    card_h = int(safe * 0.96)
    card_w = int(card_h * CARD_ASPECT)
    if card_w > safe:
        card_w = int(safe * 0.96)
        card_h = int(card_w / CARD_ASPECT)
    cx0 = (canvas_size - card_w) // 2
    cy0 = (canvas_size - card_h) // 2
    cx1 = cx0 + card_w
    cy1 = cy0 + card_h
    radius = max(2, card_w // 11)
    edge_w = max(2, canvas_size // 60)
    draw.rounded_rectangle(
        (cx0, cy0, cx1, cy1),
        radius=radius,
        fill=CARD_FILL,
        outline=CARD_EDGE,
        width=edge_w,
    )

    # Sparkline plot area = inner 76% of the card. Vertically centered.
    pad_x = int(card_w * 0.12)
    plot_left = cx0 + pad_x
    plot_right = cx1 - pad_x
    plot_top = cy0 + int(card_h * 0.20)
    plot_bottom = cy1 - int(card_h * 0.18)
    plot_w = plot_right - plot_left
    plot_h = plot_bottom - plot_top

    pts = [
        (plot_left + int(nx * plot_w), plot_top + int(ny * plot_h))
        for (nx, ny) in SPARKLINE_POINTS
    ]
    stroke = max(3, card_w // 14)
    draw.line(pts, fill=SPARK_COLOR, width=stroke, joint="curve")

    # Punctuate the close with a filled dot (with thin cream ring so it
    # remains crisp against the card fill).
    last_x, last_y = pts[-1]
    dot_r = max(stroke, card_w // 10)
    ring_r = dot_r + max(2, stroke // 2)
    draw.ellipse(
        (last_x - ring_r, last_y - ring_r, last_x + ring_r, last_y + ring_r),
        fill=SPARK_DOT_BG,
    )
    draw.ellipse(
        (last_x - dot_r, last_y - dot_r, last_x + dot_r, last_y + dot_r),
        fill=SPARK_COLOR,
    )
    return img


def main():
    print(f"Output dir: {RES_DIR}")
    if not os.path.isdir(RES_DIR):
        raise SystemExit(f"Missing res dir: {RES_DIR}")

    for suffix, legacy_px, layer_px in DENSITIES:
        mipmap_dir = os.path.join(RES_DIR, f"mipmap-{suffix}")
        os.makedirs(mipmap_dir, exist_ok=True)

        # Legacy launcher — composite the card silhouette directly onto the
        # dark canvas (no adaptive masking on legacy Android).
        legacy = Image.new("RGBA", (legacy_px, legacy_px), BG_COLOR)
        legacy.alpha_composite(render_card_with_sparkline(legacy_px))
        legacy.save(os.path.join(mipmap_dir, "ic_launcher.png"))
        legacy.save(os.path.join(mipmap_dir, "ic_launcher_round.png"))

        # Adaptive: background is the dark canvas (visible around the squircle
        # mask), foreground is the card silhouette + sparkline.
        background = Image.new("RGBA", (layer_px, layer_px), BG_COLOR)
        background.save(os.path.join(mipmap_dir, "ic_launcher_background.png"))
        render_card_with_sparkline(layer_px).save(
            os.path.join(mipmap_dir, "ic_launcher_foreground.png")
        )

        print(f"  {suffix:8s}  legacy={legacy_px}px  layer={layer_px}px")

    print("Done.")


if __name__ == "__main__":
    main()
