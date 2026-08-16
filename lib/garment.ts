/**
 * Extract a garment's dominant colour, in the browser.
 *
 * Runs on <canvas>, so it needs no server-side image library and costs nothing.
 * The hard part is not clustering — it is excluding everything that is not the
 * garment: studio background, and skin when the garment is being worn.
 */

import { deltaE2000, rgbToLab, rgbToHex, type Rgb } from "./colour";

const SAMPLE_W = 120;
const SAMPLE_H = 160;

/** Same YCbCr skin test used on the face side, so worn garments don't sample skin. */
function isSkin(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb > 77 && cb < 127 && cr > 133 && cr < 173 && y > 60;
}

function kmeans(points: Rgb[], k: number, iterations = 12): { centre: Rgb; size: number }[] {
  if (points.length === 0) return [];
  // Deterministic seeding: evenly spaced samples. Random seeds would make the
  // same garment score differently on reload, which users would read as a bug.
  const centres: Rgb[] = [];
  for (let i = 0; i < k; i++) {
    centres.push({ ...points[Math.floor((i * points.length) / k)] });
  }

  let assign = new Array(points.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      let bestIdx = 0;
      let bestD = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const p = points[i];
        const q = centres[c];
        const d = (p.r - q.r) ** 2 + (p.g - q.g) ** 2 + (p.b - q.b) ** 2;
        if (d < bestD) {
          bestD = d;
          bestIdx = c;
        }
      }
      if (assign[i] !== bestIdx) {
        assign[i] = bestIdx;
        moved = true;
      }
    }
    const sums = centres.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    points.forEach((p, i) => {
      const s = sums[assign[i]];
      s.r += p.r;
      s.g += p.g;
      s.b += p.b;
      s.n++;
    });
    sums.forEach((s, c) => {
      if (s.n > 0) centres[c] = { r: s.r / s.n, g: s.g / s.n, b: s.b / s.n };
    });
    if (!moved) break;
  }

  const sizes = centres.map(() => 0);
  assign.forEach((a) => sizes[a]++);
  return centres
    .map((centre, i) => ({ centre, size: sizes[i] }))
    .filter((c) => c.size > 0)
    .sort((a, b) => b.size - a.size);
}

export interface GarmentColour {
  hex: string;
  /** Share of garment pixels in the dominant cluster. Low = patterned. */
  coverage: number;
  patterned: boolean;
}

/**
 * @throws if the image is unreadable or no garment pixels survive filtering —
 *         "no garment found" must not silently become "black".
 */
export async function extractGarmentColour(src: string): Promise<GarmentColour> {
  const img = await loadImage(src);

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser blocked canvas access, so we can't read that image.");
  ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);

  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
  const at = (x: number, y: number): Rgb => {
    const i = (y * SAMPLE_W + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };

  // Background estimate: the median of the four corners.
  const corners = [at(2, 2), at(SAMPLE_W - 3, 2), at(2, SAMPLE_H - 3), at(SAMPLE_W - 3, SAMPLE_H - 3)];
  const bg = {
    r: median(corners.map((c) => c.r)),
    g: median(corners.map((c) => c.g)),
    b: median(corners.map((c) => c.b)),
  };
  const bgLab = rgbToLab(bg);

  /**
   * Sample the central band, where a garment sits in a product or worn photo.
   *
   * `bgTolerance` of 0 disables background removal entirely. We try with it and
   * fall back without it, because a garment photographed against a background of
   * a similar colour would otherwise have every pixel filtered away - which is a
   * failure of our heuristic, not an unreadable image.
   */
  const sample = (bgTolerance: number): Rgb[] => {
    const pts: Rgb[] = [];
    for (let y = Math.floor(SAMPLE_H * 0.12); y < SAMPLE_H * 0.88; y++) {
      for (let x = Math.floor(SAMPLE_W * 0.18); x < SAMPLE_W * 0.82; x++) {
        const p = at(x, y);
        if (data[(y * SAMPLE_W + x) * 4 + 3] < 200) continue; // transparent
        if (isSkin(p.r, p.g, p.b)) continue;
        if (bgTolerance > 0 && deltaE2000(rgbToLab(p), bgLab) < bgTolerance) continue;
        pts.push(p);
      }
    }
    return pts;
  };

  const MIN_POINTS = 150;
  let points = sample(10);
  if (points.length < MIN_POINTS) points = sample(4); // looser background match
  if (points.length < MIN_POINTS) points = sample(0); // keep everything but skin

  if (points.length < MIN_POINTS) {
    throw new Error(
      "We couldn't pick out a garment in that image. Try a photo where the item fills more of the frame.",
    );
  }

  const clusters = kmeans(points, 3);
  const dominant = clusters[0];
  const coverage = dominant.size / points.length;

  return {
    hex: rgbToHex(dominant.centre),
    coverage,
    patterned: coverage < 0.55,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be loaded."));
    img.src = src;
  });
}
