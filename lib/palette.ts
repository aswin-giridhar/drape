/**
 * Season classification and garment scoring.
 *
 * Pure functions over a measured ColourProfile. No API calls, no units, so this
 * is cheap to test and safe to iterate on.
 */

import {
  clarityFromChroma,
  contrastFromLightness,
  deltaE2000,
  depthFromIta,
  hexToLab,
  hueDelta,
  ita,
  labToLch,
  undertoneFromLab,
  type Contrast,
  type Depth,
  type Lab,
  type Undertone,
} from "./colour";

export interface ColourProfile {
  skinHex: string;
  hairHex: string;
  eyeHex: string;
  lipHex?: string;
  /** 0-100, from Skin Analysis raw_score. LOW means MORE visible redness. */
  rednessRaw?: number;
  // derived
  ita: number;
  depth: Depth;
  undertone: Undertone;
  undertoneRatio: number;
  contrast: Contrast;
  contrastSpread: number;
  clarity: "clear" | "soft";
  skinLab: Lab;
}

export type SeasonName =
  | "Light Spring" | "True Spring" | "Bright Spring"
  | "Light Summer" | "True Summer" | "Soft Summer"
  | "Soft Autumn" | "True Autumn" | "Dark Autumn"
  | "Bright Winter" | "True Winter" | "Dark Winter";

/**
 * Each season sits at a point in a 3-axis space:
 *   temp     -1 = cool ........... +1 = warm
 *   value     0 = light ..........  1 = deep
 *   clarity   0 = muted/soft .....  1 = clear/bright
 *   contrast  0 = blended ........  1 = high hair-to-skin contrast
 *
 * Nearest-point classification (rather than nested conditionals) gives us a
 * runner-up season and a confidence for free, and keeps the tuning in one place.
 */
interface Season {
  name: SeasonName;
  temp: number;
  value: number;
  clarity: number;
  /**
   * Conventional, not derived. See the note above SEASON_CONTRAST_WEIGHT for why
   * this is hand-assigned from the established system rather than computed from
   * the palette arrays in this file.
   */
  contrast: number;
  blurb: string;
  best: string[];
  avoid: string[];
}

export const SEASONS: Season[] = [
  {
    name: "Light Spring", temp: 0.6, value: 0.15, clarity: 0.6, contrast: 0.35,
    blurb: "Warm and delicate — colours should stay light and fresh.",
    best: ["#F7C59F", "#FFD9A0", "#B7E4C7", "#A8DADC", "#FFE5B4", "#F4A896", "#C9E4A6", "#FDFCDC"],
    avoid: ["#000000", "#4A0E0E", "#2F3E46", "#5B2333"],
  },
  {
    name: "True Spring", temp: 1.0, value: 0.3, clarity: 0.8, contrast: 0.5,
    blurb: "Warm and clear — golden, sunlit colours.",
    best: ["#FF9F1C", "#FFBF69", "#2EC4B6", "#CBF3F0", "#F4D35E", "#EE964B", "#8AC926", "#FFE066"],
    avoid: ["#4A4E69", "#22223B", "#8D99AE", "#6D6875"],
  },
  {
    name: "Bright Spring", temp: 0.5, value: 0.35, clarity: 1.0, contrast: 0.85,
    blurb: "Warm-leaning and vivid — saturation is your friend.",
    best: ["#FF6B35", "#F7B801", "#00BBF9", "#00F5D4", "#FEE440", "#FF477E", "#38B000", "#48CAE4"],
    avoid: ["#6B705C", "#A5A58D", "#B7B7A4", "#7F5539"],
  },
  {
    name: "Light Summer", temp: -0.5, value: 0.15, clarity: 0.4, contrast: 0.25,
    blurb: "Cool and soft — gentle, powdery tones.",
    best: ["#CDB4DB", "#BDE0FE", "#A2D2FF", "#FFC8DD", "#E0FBFC", "#B8C0FF", "#C8E7E3", "#DEE2FF"],
    avoid: ["#FF6B35", "#D00000", "#7F4F24", "#FFB703"],
  },
  {
    name: "True Summer", temp: -1.0, value: 0.4, clarity: 0.3, contrast: 0.3,
    blurb: "Cool and muted — soft blues, roses and greys.",
    best: ["#8AA9C1", "#6D95B0", "#C08497", "#9EB3C2", "#B08EA2", "#7C99B4", "#A3B9C9", "#D5C6D0"],
    avoid: ["#FF9F1C", "#E85D04", "#9C6644", "#FFBA08"],
  },
  {
    name: "Soft Summer", temp: -0.3, value: 0.5, clarity: 0.1, contrast: 0.1,
    blurb: "Cool-neutral and muted — nothing too bright.",
    best: ["#8E9AAF", "#B8B8D1", "#A5A58D", "#9A8C98", "#C9ADA7", "#6B8F9C", "#AFC1C4", "#B5B8A3"],
    avoid: ["#FF0000", "#FFEE32", "#00F5D4", "#FF477E"],
  },
  {
    name: "Soft Autumn", temp: 0.3, value: 0.5, clarity: 0.1, contrast: 0.15,
    blurb: "Warm-neutral and muted — earthy, blended tones.",
    best: ["#A68A64", "#B6AD90", "#7F9172", "#C2A878", "#A4AC86", "#997B66", "#CBBFA6", "#8A9A7B"],
    avoid: ["#00F5D4", "#FF006E", "#3A0CA3", "#00BBF9"],
  },
  {
    name: "True Autumn", temp: 1.0, value: 0.65, clarity: 0.35, contrast: 0.4,
    blurb: "Warm and rich — spice, moss and rust.",
    best: ["#BC6C25", "#606C38", "#DDA15E", "#9C6644", "#7F4F24", "#A3B18A", "#B08968", "#8A5A44"],
    avoid: ["#BDE0FE", "#CDB4DB", "#FFC8DD", "#A2D2FF"],
  },
  {
    name: "Dark Autumn", temp: 0.6, value: 0.85, clarity: 0.4, contrast: 0.65,
    blurb: "Warm and deep — spice, jewel and one warm light.",
    // Every colour here used to sit between L* 21 and 47: eight browns and
    // olives, no light anchor at all. A deep-skinned wearer was being handed
    // nothing that could contrast against their own skin, which is the opposite
    // of what a deep-and-warm palette is for. Teal, aubergine, marigold and a
    // warm cream restore the range its sibling seasons already had.
    best: ["#0F4C5C", "#6A040F", "#B5551D", "#C68B0F", "#4A2545", "#35682D", "#F2E3C6", "#7F4F24"],
    avoid: ["#FFB3C6", "#E0FBFC", "#CBF3F0", "#D8BFD8"],
  },
  {
    name: "Bright Winter", temp: -0.4, value: 0.6, clarity: 1.0, contrast: 0.95,
    blurb: "Cool-leaning and vivid — high contrast, high saturation.",
    best: ["#0077B6", "#D00000", "#3A0CA3", "#00B4D8", "#F72585", "#4361EE", "#FFFFFF", "#000000"],
    avoid: ["#B6AD90", "#A5A58D", "#CBBFA6", "#997B66"],
  },
  {
    name: "True Winter", temp: -1.0, value: 0.75, clarity: 0.9, contrast: 0.85,
    blurb: "Cool and clear — icy brights against true black and white.",
    best: ["#03045E", "#0077B6", "#C1121F", "#5A189A", "#FFFFFF", "#000000", "#006BA6", "#B5179E"],
    avoid: ["#DDA15E", "#BC6C25", "#A68A64", "#E9C46A"],
  },
  {
    name: "Dark Winter", temp: -0.5, value: 0.95, clarity: 0.75, contrast: 0.9,
    blurb: "Cool and deep — jewel tones against an icy light.",
    // Same defect as Dark Autumn: the old set topped out at L* 37, so it was
    // eight near-blacks. Deep seasons are defined by CONTRAST, and a palette
    // with no light in it cannot produce any.
    best: ["#10002B", "#3C096C", "#6A040F", "#023047", "#005F73", "#007F5F", "#E8EEF2", "#9D0208"],
    avoid: ["#FFE5B4", "#FFD9A0", "#F7C59F", "#FDFCDC"],
  },
];

/* ------------------------------------------------------------------ */
/* Profile construction                                                */
/* ------------------------------------------------------------------ */

export function buildProfile(input: {
  skinHex: string;
  hairHex: string;
  eyeHex: string;
  lipHex?: string;
  rednessRaw?: number;
}): ColourProfile {
  const skinLab = hexToLab(input.skinHex);
  const hairLab = hexToLab(input.hairHex);
  const skinLch = labToLch(skinLab);

  const angle = ita(skinLab);
  const { undertone, ratio } = undertoneFromLab(skinLab);
  const { contrast, spread } = contrastFromLightness(skinLab.L, hairLab.L);

  return {
    ...input,
    ita: angle,
    depth: depthFromIta(angle),
    undertone,
    undertoneRatio: ratio,
    contrast,
    contrastSpread: spread,
    clarity: clarityFromChroma(skinLch.C),
    skinLab,
  };
}

/** Map the profile onto the four season axes. */
function profileAxes(
  p: ColourProfile,
): { temp: number; value: number; clarity: number; contrast: number } {
  // temperature: undertone ratio ~1.05 is the cool/neutral edge, ~1.6 the warm edge
  const temp = Math.max(-1, Math.min(1, (p.undertoneRatio - 1.32) / 0.35));
  // value: ITA runs roughly +60 (very light) to -30 (deep)
  const value = Math.max(0, Math.min(1, (55 - p.ita) / 70));
  const clarity = p.clarity === "clear" ? 0.75 : 0.25;
  // dL* 0..70 spans a flat, blended face to a very high-contrast one. This value
  // was already measured and printed on the colour card; until now the
  // classifier threw it away before deciding anything.
  const contrast = Math.max(0, Math.min(1, p.contrastSpread / 70));
  return { temp, value, clarity, contrast };
}

/**
 * How hard contrast pulls, relative to temperature at 2.0.
 *
 * Swept from 0 to 3 against all three sitters. The answers are identical across
 * 0.25-0.75, so this sits inside a stable basin rather than on a knife edge; at
 * 1.0 and above it starts moving a sitter off a season two independent reviewers
 * called correct, which is the ceiling.
 *
 * What it buys is honesty rather than a different answer: it does not reclassify
 * anyone, it lowers confidence where the face genuinely sits between seasons
 * (sitter three falls 0.77 -> 0.60), which is what surfaces the runner-up and the
 * "colours shared by both are safest" note.
 */
export const SEASON_CONTRAST_WEIGHT = 0.5;

export interface SeasonMatch {
  season: Season;
  runnerUp: Season;
  confidence: number; // 0-1; low means the user sits between two seasons
}

export function classifySeason(p: ColourProfile): SeasonMatch {
  const ax = profileAxes(p);
  // temperature is weighted highest: it is the axis stylists get right first,
  // and the one our measurement is most confident about.
  const dist = (s: Season) =>
    Math.sqrt(
      2.0 * Math.pow(s.temp - ax.temp, 2) +
        1.4 * Math.pow(s.value - ax.value, 2) +
        1.0 * Math.pow(s.clarity - ax.clarity, 2) +
        SEASON_CONTRAST_WEIGHT * Math.pow(s.contrast - ax.contrast, 2),
    );
  const ranked = [...SEASONS].sort((a, b) => dist(a) - dist(b));
  const [best, second] = ranked;
  const gap = dist(second) - dist(best);
  return {
    season: best,
    runnerUp: second,
    confidence: Math.max(0, Math.min(1, gap / 0.6)),
  };
}

/* ------------------------------------------------------------------ */
/* Garment scoring                                                     */
/* ------------------------------------------------------------------ */

export interface GarmentScore {
  score: number; // 0-10
  verdict: "great" | "good" | "risky" | "avoid";
  reasons: string[];
  nearestPaletteHex: string;
  deltaE: number;
}

/**
 * Score a garment colour against a measured profile.
 *
 * Weighting reflects what we can actually trust: VTO preserves hue within ~5
 * degrees but shifts lightness and chroma more, so hue-driven signals carry
 * more weight than lightness-driven ones.
 */
/**
 * How warm a hue reads, from -1 (cool) to +1 (warm).
 * Peaks around 60 degrees in Lab hue — the orange/gold family — and bottoms out
 * near 240, the blue family.
 */
function hueWarmth(hueDeg: number, chroma: number): number {
  const raw = Math.cos(((hueDeg - 60) * Math.PI) / 180);
  // A near-neutral has no temperature to speak of, so fade the signal out.
  const strength = Math.min(1, chroma / 30);
  return raw * strength;
}

export function scoreGarment(garmentHex: string, p: ColourProfile): GarmentScore {
  const g = hexToLab(garmentHex);
  const gl = labToLch(g);
  const match = classifySeason(p);
  const reasons: string[] = [];

  // 1. Distance to the closest colour in the season palette (primary signal).
  let nearest = match.season.best[0];
  let best = Infinity;
  for (const hex of match.season.best) {
    const d = deltaE2000(g, hexToLab(hex));
    if (d < best) {
      best = d;
      nearest = hex;
    }
  }

  // Exponential decay rather than a clipped line: this stays strictly monotonic
  // in deltaE and never reaches exactly zero, so distinct colours keep distinct
  // scores instead of piling up on a clamp.
  let score = 10 * Math.exp(-best / 24);

  if (best < 12) {
    reasons.push(`Sits right inside your ${match.season.name} palette (ΔE ${best.toFixed(1)}).`);
  } else if (best < 25) {
    reasons.push(`Near your ${match.season.name} palette, but not a core shade (ΔE ${best.toFixed(1)}).`);
  } else {
    reasons.push(`Far from every ${match.season.name} shade (ΔE ${best.toFixed(1)}).`);
  }

  // Penalties are MULTIPLICATIVE. Subtracting them lets a clamp collapse several
  // genuinely different colours onto the same number; scaling preserves order.

  // 2. Temperature. Carried explicitly here, not just implicitly through deltaE —
  //    otherwise a cool shade can rank highly for a warm season purely on distance.
  const warmth = hueWarmth(gl.h, gl.C);
  const wanted = Math.max(-1, Math.min(1, (p.undertoneRatio - 1.32) / 0.35));
  const tempMiss = Math.abs(wanted - warmth) / 2; // 0 = aligned, 1 = opposite
  score *= 1 - 0.45 * tempMiss;
  if (tempMiss > 0.55) {
    reasons.push(
      warmth < wanted
        ? "Runs cooler than your colouring; it will sit slightly apart from your skin."
        : "Runs warmer than your colouring; it will pull against your skin.",
    );
  } else if (tempMiss < 0.2 && gl.C > 20) {
    reasons.push(`Temperature matches your ${p.undertone} colouring.`);
  }

  // 3. Explicit clash with the season's avoid list.
  let worstAvoid = Infinity;
  for (const hex of match.season.avoid) {
    worstAvoid = Math.min(worstAvoid, deltaE2000(g, hexToLab(hex)));
  }
  if (worstAvoid < 14) {
    score *= 0.55;
    reasons.push("Close to a shade that typically drains your colouring.");
  }

  // 4. Contrast fit — does the garment/skin lightness gap match the user's own?
  const gap = Math.abs(g.L - p.skinLab.L);
  const wants = p.contrast === "high" ? 45 : p.contrast === "medium" ? 28 : 14;
  const miss = Math.abs(gap - wants);
  if (miss < 12) {
    score *= 1.1;
    reasons.push(`Contrast suits you — you carry ${p.contrast} contrast naturally.`);
  } else if (miss > 30) {
    score *= 0.85;
    reasons.push(
      gap > wants
        ? "Stronger contrast than your colouring carries; it may wear you."
        : "Too close to your own skin tone to give definition.",
    );
  }

  // 5. Redness. rednessRaw is LOW when redness is HIGH (it is a "good skin" score).
  //    Hues in the red/orange band sit next to facial redness and amplify it.
  if (p.rednessRaw !== undefined && p.rednessRaw < 80) {
    const nearRed = Math.abs(hueDelta(gl.h, 25)) < 35 && gl.C > 25;
    if (nearRed) {
      score *= 0.7;
      reasons.push(
        `Your measured redness is elevated (${p.rednessRaw.toFixed(0)}/100); this hue sits beside it and will emphasise it.`,
      );
    }
  }

  score = Math.max(0.1, Math.min(10, score));
  const verdict: GarmentScore["verdict"] =
    score >= 7 ? "great" : score >= 5 ? "good" : score >= 3 ? "risky" : "avoid";

  return { score, verdict, reasons, nearestPaletteHex: nearest, deltaE: best };
}
