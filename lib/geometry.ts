/**
 * Measures a garment's shape by comparing the original photograph with the
 * try-on render.
 *
 * The try-on preserves pose and background and changes the clothing, so the
 * pixels that changed ARE the garment. That gives real geometry - hem height,
 * sleeve reach, coverage - from two 2D images, with no 3D reconstruction and no
 * extra API call.
 *
 * Runs in the browser on <canvas>, like the colour extraction.
 */

import type { GarmentGeometry } from "./describe";

const W = 180;
const H = 260;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be loaded."));
    img.src = src;
  });
}

function pixels(img: HTMLImageElement): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser blocked canvas access.");
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H).data;
}

/** Rows/columns occupied by the subject, found against the studio background. */
function subjectExtent(px: Uint8ClampedArray) {
  const at = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return [px[i], px[i + 1], px[i + 2]] as const;
  };
  const corners = [at(2, 2), at(W - 3, 2), at(2, H - 3), at(W - 3, H - 3)];
  const bg = [0, 1, 2].map((k) => {
    const v = corners.map((c) => c[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
  const isSubject = (x: number, y: number) => {
    const p = at(x, y);
    return Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > 40;
  };
  let top = -1;
  let bottom = -1;
  const rowCounts = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (isSubject(x, y)) n++;
    rowCounts[y] = n;
    if (n > W * 0.03) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  return { top, bottom, rowCounts, isSubject };
}

/**
 * @throws when the two images disagree so much that the diff is meaningless
 *         (different pose, different crop) - better to say "unknown" than to
 *         describe a garment shape we did not actually measure.
 */
export async function measureGarmentGeometry(
  originalSrc: string,
  renderSrc: string,
): Promise<GarmentGeometry> {
  const [a, b] = await Promise.all([loadImage(originalSrc), loadImage(renderSrc)]);
  const pa = pixels(a);
  const pb = pixels(b);

  const { top, bottom, isSubject } = subjectExtent(pa);
  const bodyH = bottom - top;
  if (top < 0 || bodyH < H * 0.25) {
    return { coverage: 0, hem: 0, neckline: 0, sleeveReach: 0, uncertain: true };
  }

  // Changed pixels, restricted to the subject so background regeneration
  // (which the generative try-on does) cannot masquerade as garment.
  const mask = new Uint8Array(W * H);
  let changed = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.hypot(pa[i] - pb[i], pa[i + 1] - pb[i + 1], pa[i + 2] - pb[i + 2]);
      if (d > 46 && isSubject(x, y)) {
        mask[y * W + x] = 1;
        changed++;
      }
    }
  }

  // Too little change means the render barely differs; too much means the whole
  // frame was regenerated and the diff no longer isolates clothing.
  const subjectArea = bodyH * W * 0.35;
  if (changed < subjectArea * 0.04 || changed > subjectArea * 1.6) {
    return { coverage: 0, hem: 0, neckline: 0, sleeveReach: 0, uncertain: true };
  }

  // Row profile of the garment, normalised down the body.
  const rows: number[] = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) n += mask[y * W + x];
    rows.push(n);
  }
  const peak = Math.max(...rows);
  const solid = (n: number) => n > peak * 0.18;

  let first = -1;
  let last = -1;
  for (let y = top; y <= bottom; y++) {
    if (solid(rows[y])) {
      if (first < 0) first = y;
      last = y;
    }
  }
  if (first < 0) {
    return { coverage: 0, hem: 0, neckline: 0, sleeveReach: 0, uncertain: true };
  }

  const neckline = (first - top) / bodyH;
  const hem = (last - top) / bodyH;
  const coverage = (last - first) / bodyH;

  // Sleeve reach: widest garment row in the upper body, against shoulder width.
  let widest = 0;
  let shoulder = 0;
  for (let y = first; y < Math.min(last, first + bodyH * 0.35); y++) {
    let minX = W;
    let maxX = -1;
    let sMin = W;
    let sMax = -1;
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (isSubject(x, y)) {
        if (x < sMin) sMin = x;
        if (x > sMax) sMax = x;
      }
    }
    if (maxX > minX) widest = Math.max(widest, maxX - minX);
    if (sMax > sMin) shoulder = Math.max(shoulder, sMax - sMin);
  }
  const sleeveReach = shoulder > 0 ? widest / shoulder : 0;

  return {
    coverage: Math.max(0, Math.min(1, coverage)),
    hem: Math.max(0, Math.min(1, hem)),
    neckline: Math.max(0, Math.min(1, neckline)),
    sleeveReach: Math.max(0, Math.min(1.4, sleeveReach)),
    uncertain: false,
  };
}
