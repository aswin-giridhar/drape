/**
 * Colour science for Drape.
 *
 * Everything here is pure maths on measured values - no API calls, no units.
 * That is deliberate: it means the whole recommendation engine can be tested
 * and iterated for free against captured fixtures.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Lab {
  L: number;
  a: number;
  b: number;
}
export interface Lch {
  L: number;
  C: number;
  h: number;
}

/* ------------------------------------------------------------------ */
/* Conversions                                                         */
/* ------------------------------------------------------------------ */

export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`not a 6-digit hex colour: ${hex}`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** sRGB (0-255) -> CIE L*a*b* under D65. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];

  // sRGB -> XYZ (D65), then normalise by the D65 white point
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 1.0;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;

  const e = 216 / 24389;
  const k = 24389 / 27;
  const f = (t: number) => (t > e ? Math.cbrt(t) : (k * t + 16) / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToLch({ L, a, b }: Lab): Lch {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

export const hexToLab = (hex: string): Lab => rgbToLab(hexToRgb(hex));

/* ------------------------------------------------------------------ */
/* Perceptual difference                                               */
/* ------------------------------------------------------------------ */

/**
 * CIEDE2000. Used instead of Euclidean Lab distance because plain Lab
 * distance misjudges perceived difference badly in blues and near-neutrals -
 * exactly the regions a wardrobe lives in.
 *
 * Roughly: dE < 2 imperceptible, < 10 same colour family, > 20 clearly different.
 */
export function deltaE2000(l1: Lab, l2: Lab): number {
  const rad = Math.PI / 180;
  const { L: L1, a: a1, b: b1 } = l1;
  const { L: L2, a: a2, b: b2 } = l2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;

  const C7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const hp = (b: number, ap: number) => {
    if (b === 0 && ap === 0) return 0;
    const h = (Math.atan2(b, ap) * 180) / Math.PI;
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;

  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
    hbp /= 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);

  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Cbp7 = Math.pow(Cbp, 7);
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
  const Sl =
    1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;

  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

/** Smallest signed angle between two hues, in degrees (-180..180]. */
export function hueDelta(h1: number, h2: number): number {
  let d = ((h2 - h1 + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

/* ------------------------------------------------------------------ */
/* Skin descriptors                                                    */
/* ------------------------------------------------------------------ */

/**
 * Individual Typology Angle - the standard dermatological measure of
 * constitutive skin tone depth. Higher = lighter.
 */
export function ita(lab: Lab): number {
  return (Math.atan2(lab.L - 50, lab.b) * 180) / Math.PI;
}

export type Depth = "very light" | "light" | "intermediate" | "tan" | "brown" | "dark";

/** Fitzpatrick-adjacent depth bands, from the standard ITA thresholds. */
export function depthFromIta(angle: number): Depth {
  if (angle > 55) return "very light";
  if (angle > 41) return "light";
  if (angle > 28) return "intermediate";
  if (angle > 10) return "tan";
  if (angle > -30) return "brown";
  return "dark";
}

export type Undertone = "warm" | "cool" | "neutral";

/**
 * Undertone from the ratio of b* to a* in skin.
 *
 * a* carries redness, b* carries yellowness. Skin with proportionally more
 * yellow than red reads warm/golden; more red than yellow reads cool/pink.
 * Thresholds are validated in colour.test.ts against measured fixtures - do not
 * change them without re-running that separation check.
 */
export function undertoneFromLab(lab: Lab): { undertone: Undertone; ratio: number } {
  const ratio = lab.b / Math.max(lab.a, 1e-6);
  const undertone: Undertone = ratio > 1.6 ? "warm" : ratio < 1.05 ? "cool" : "neutral";
  return { undertone, ratio };
}

export type Contrast = "low" | "medium" | "high";

/**
 * Natural contrast = how far apart hair and skin sit in lightness.
 * This is what decides whether someone can carry black-and-white or needs
 * blended tones, and it is independent of undertone.
 */
export function contrastFromLightness(skinL: number, hairL: number): {
  contrast: Contrast;
  spread: number;
} {
  const spread = Math.abs(skinL - hairL);
  const contrast: Contrast = spread > 45 ? "high" : spread > 22 ? "medium" : "low";
  return { contrast, spread };
}

/** Chroma of the skin itself - drives whether bright or muted clothing suits. */
export function clarityFromChroma(C: number): "clear" | "soft" {
  return C > 17 ? "clear" : "soft";
}
