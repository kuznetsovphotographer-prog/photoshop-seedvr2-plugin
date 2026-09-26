#!/usr/bin/env python3
from pathlib import Path
import argparse
import struct
import zlib


def rounded_rect_mask(x, y, width, height, radius, px, py):
    left = x + radius
    right = x + width - radius - 1
    top = y + radius
    bottom = y + height - radius - 1
    if left <= px <= right and y <= py <= y + height - 1:
        return True
    if top <= py <= bottom and x <= px <= x + width - 1:
        return True
    return any(
        (px - cx) * (px - cx) + (py - cy) * (py - cy) <= radius * radius
        for cx, cy in ((left, top), (right, top), (left, bottom), (right, bottom))
    )


def fill_rect(pixels, size, x, y, width, height, color):
    x0 = max(0, int(round(x)))
    y0 = max(0, int(round(y)))
    x1 = min(size, int(round(x + width)))
    y1 = min(size, int(round(y + height)))
    for py in range(y0, y1):
        for px in range(x0, x1):
            pixels[py][px] = color


def make_icon(size):
    pixels = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]
    bg = (47, 47, 47, 232)
    fg = (232, 232, 232, 255)

    margin = max(2, round(size * 0.09))
    radius = max(3, round(size * 0.16))
    rect_size = size - margin * 2
    for py in range(size):
        for px in range(size):
            if rounded_rect_mask(margin, margin, rect_size, rect_size, radius, px, py):
                pixels[py][px] = bg

    stroke = max(3, round(size * 0.16))
    left = round(size * 0.31)
    top = round(size * 0.25)
    fill_rect(pixels, size, left, top, stroke, size * 0.5, fg)
    fill_rect(pixels, size, left, top, round(size * 0.44), stroke, fg)
    fill_rect(pixels, size, left, round(size * 0.44), round(size * 0.36), stroke, fg)
    return pixels


def png_chunk(kind, data):
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    )


def save_png(path, pixels):
    height = len(pixels)
    width = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b, a in row:
            raw.extend((r, g, b, a))

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + png_chunk(b"IEND", b"")
    )


def main():
    parser = argparse.ArgumentParser(description="Generate 23x23 and 46x46 PNG icons for Photoshop UXP packaging.")
    parser.add_argument("plugin_root", help="Path to the plugin root containing manifest.json")
    args = parser.parse_args()

    icon_dir = Path(args.plugin_root).resolve() / "icons"
    icon_dir.mkdir(parents=True, exist_ok=True)
    for size in (23, 46):
        save_png(icon_dir / f"icon-{size}.png", make_icon(size))


if __name__ == "__main__":
    main()
