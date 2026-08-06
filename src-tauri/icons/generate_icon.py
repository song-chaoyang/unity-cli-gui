#!/usr/bin/env python3
"""Generate a professional app icon for Unity CLI GUI.
Inspired by 3D/geometric design language, dark gradient with blue/cyan accent.
No copyrighted elements used."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import os

SIZE = 512
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

def lerp(a, b, t):
    return a + (b - a) * t

def lerp_color(c1, c2, t):
    return tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))

def create_icon(size):
    """Create the icon at the given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background gradient: deep dark navy to dark blue
    top_color = (15, 18, 28)      # #0F121C
    bottom_color = (25, 35, 55)   # #192337

    margin = size // 16
    radius = size // 5

    # Create gradient background
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / size
        color = lerp_color(top_color, bottom_color, t)
        bg_draw.line([(0, y), (size, y)], fill=color)

    # Mask to rounded rectangle
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=255
    )
    img.paste(bg, (0, 0), mask)

    # Add subtle inner glow
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_color = (0, 122, 204, 40)
    glow_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        outline=glow_color,
        width=max(2, size // 48)
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size // 40))
    img = Image.alpha_composite(img, glow)

    draw = ImageDraw.Draw(img)

    # Draw a stylized geometric "cube" shape — evoking 3D/game dev
    # without copying Unity's logo. We draw an isometric hexagonal frame
    # with a central "C" (for CLI) formed by geometric lines.

    cx, cy = size // 2, size // 2
    s = size * 0.28  # scale factor

    # Define hexagonal frame vertices (isometric view)
    angles = [math.radians(a) for a in [-90, -30, 30, 90, 150, 210]]
    hex_pts = [(cx + s * math.cos(a), cy + s * math.sin(a)) for a in angles]

    # Draw the hexagonal frame with a gradient stroke
    # Outer hexagon
    line_width = max(4, size // 40)
    blue_primary = (0, 150, 255, 255)    # bright blue
    blue_accent = (0, 200, 255, 255)     # cyan accent
    blue_dark = (0, 90, 180, 200)        # darker blue

    # Draw hexagon edges with varying brightness for 3D effect
    for i in range(6):
        p1 = hex_pts[i]
        p2 = hex_pts[(i + 1) % 6]
        # Top edges brighter, bottom edges darker
        brightness = 1.0 - abs(i - 2) * 0.12
        color = lerp_color(blue_dark[:3], blue_primary[:3], brightness) + (255,)
        draw.line([p1, p2], fill=color, width=line_width)

    # Draw inner hexagonal shape (smaller, rotated) for depth
    inner_s = s * 0.55
    inner_angles = [math.radians(a) for a in [-90, -30, 30, 90, 150, 210]]
    inner_pts = [(cx + inner_s * math.cos(a), cy + inner_s * math.sin(a)) for a in inner_angles]

    # Draw inner hexagon with thinner lines
    inner_width = max(2, size // 64)
    for i in range(6):
        p1 = inner_pts[i]
        p2 = inner_pts[(i + 1) % 6]
        brightness = 1.0 - abs(i - 2) * 0.15
        color = lerp_color((0, 60, 120), blue_accent[:3], brightness) + (200,)
        draw.line([p1, p2], fill=color, width=inner_width)

    # Draw a central ">" prompt symbol (for CLI identity)
    prompt_s = s * 0.3
    prompt_w = max(3, size // 80)

    # ">" shape: two lines forming a chevron
    p_top = (cx - prompt_s * 0.5, cy - prompt_s * 0.4)
    p_mid = (cx + prompt_s * 0.3, cy)
    p_bot = (cx - prompt_s * 0.5, cy + prompt_s * 0.4)

    draw.line([p_top, p_mid], fill=blue_accent, width=prompt_w)
    draw.line([p_mid, p_bot], fill=blue_accent, width=prompt_w)

    # Draw a cursor "_" line beneath the ">" (terminal cursor)
    cursor_y = cy + prompt_s * 0.6
    cursor_w = int(prompt_s * 0.8)
    draw.line(
        [(cx - cursor_w // 2, cursor_y), (cx + cursor_w // 2, cursor_y)],
        fill=blue_accent,
        width=prompt_w
    )

    # Add small accent dots at hexagon vertices
    dot_size = max(3, size // 80)
    for i, pt in enumerate(hex_pts):
        brightness = 1.0 - abs(i - 2) * 0.1
        color = lerp_color(blue_dark[:3], blue_accent[:3], brightness) + (255,)
        draw.ellipse(
            [pt[0] - dot_size, pt[1] - dot_size, pt[0] + dot_size, pt[1] + dot_size],
            fill=color
        )

    return img

def main():
    icon = create_icon(512)

    icon_path = os.path.join(OUTPUT_DIR, "icon.png")
    icon.save(icon_path, "PNG")
    print(f"Created {icon_path}")

    sizes = {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
    }

    for name, sz in sizes.items():
        resized = icon.resize((sz, sz), Image.LANCZOS)
        path = os.path.join(OUTPUT_DIR, name)
        resized.save(path, "PNG")
        print(f"Created {path}")

    print("\nAll icons generated successfully!")
    print("Run `npx tauri icon icon.png` to generate all platform-specific formats")

if __name__ == "__main__":
    main()
