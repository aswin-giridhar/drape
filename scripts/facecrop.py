"""
Cut the head-and-shoulders photograph out of a full-length one, at native
resolution.

The previous crops were enlarged to 1200px wide from roughly 600px of real
detail, so the colour card - the one image the whole product rests on - was
showing a 2x magnification of its own softness. Nothing in CSS fixes that; the
only fix is to stop enlarging.

The crop box is geometric rather than detected. A face detector was tried and
picked a SHOE as the largest "face" on a full-body shot, and a wrong crop that
looks confident is worse than a simple rule that is easy to check by eye.

Usage:
    python3 scripts/facecrop.py --probe    # write previews, change nothing
    python3 scripts/facecrop.py --write
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "public" / "models"

# Fraction of the full-length frame occupied by the head-and-shoulders crop.
# Standing studio shots put the crown a little below the top edge.
TOP = 0.155
HEIGHT = 0.215
# This crop is for DISPLAY ONLY and is written to *_portrait.jpg. The measured
# input, *_face.jpg, is deliberately left alone: the stored readings say they
# came from that file, and quietly swapping the pixels underneath a recorded
# measurement is the kind of thing this project exists to not do.
WIDTH = 0.40

SUBJECTS = ["person_a", "person_b", "person_c"]


def crop(src: Path) -> Image.Image:
    im = Image.open(src)
    w, h = im.size
    cw = int(w * WIDTH)
    left = (w - cw) // 2
    top = int(h * TOP)
    bottom = top + int(h * HEIGHT)
    return im.crop((left, top, left + cw, bottom))


def main() -> int:
    probe = "--probe" in sys.argv
    write = "--write" in sys.argv
    if not (probe or write):
        print("pass --probe or --write")
        return 1

    for name in SUBJECTS:
        src = MODELS / f"{name}.jpg"
        if not src.exists():
            print(f"MISSING {src}")
            continue
        out = crop(src)
        dst = MODELS / (f"{name}_portrait.jpg" if write else f"{name}_facecrop_probe.jpg")
        # No resize anywhere in this path. If the crop is small, it is small, and
        # the interface shows it at the size it actually has.
        out.save(dst, quality=92, subsampling=1)
        print(f"{name}: {out.size[0]}x{out.size[1]} -> {dst.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
