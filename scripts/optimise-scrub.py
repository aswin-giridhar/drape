#!/usr/bin/env python3
"""
Downscale the pre-rendered scrub frames for web delivery.

The scrub preloads every frame before it can be scrolled, because decoding an
image mid-scroll stutters. Full-size renders are ~250KB each, so a 14-colour
sequence would be ~3.5MB. At the size they are actually displayed (a plate
around 600px tall) 760px wide is indistinguishable and roughly a third of the
weight.

Run:  python3 scripts/optimise-scrub.py
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRUB = os.path.join(ROOT, "public", "scrub")
TARGET_W = 760
QUALITY = 80


def main() -> int:
    if not os.path.isdir(SCRUB):
        print(f"no scrub directory at {SCRUB}", file=sys.stderr)
        return 1

    total_before = total_after = 0
    for sitter in sorted(os.listdir(SCRUB)):
        d = os.path.join(SCRUB, sitter)
        if not os.path.isdir(d):
            continue
        frames = []
        for name in sorted(os.listdir(d)):
            if not name.endswith(".jpg"):
                continue
            p = os.path.join(d, name)
            before = os.path.getsize(p)
            im = Image.open(p).convert("RGB")
            if im.width > TARGET_W:
                im.thumbnail((TARGET_W, TARGET_W * 3), Image.LANCZOS)
                im.save(p, "JPEG", quality=QUALITY, optimize=True, progressive=True)
            after = os.path.getsize(p)
            total_before += before
            total_after += after
            frames.append(name[:-4])

        # Rewrite the manifest from what is actually on disk, so a frame that
        # failed to render can never be referenced by the page.
        with open(os.path.join(d, "frames.json"), "w") as f:
            json.dump(frames, f)
        print(f"  {sitter}: {len(frames)} frames, {sum(os.path.getsize(os.path.join(d, n + '.jpg')) for n in frames) // 1024}KB total")

    if total_before:
        print(f"total {total_before // 1024}KB -> {total_after // 1024}KB "
              f"({100 - total_after * 100 // max(total_before, 1)}% smaller)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
