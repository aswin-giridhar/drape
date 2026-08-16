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
 *   temp    -1 = cool ............ +1 = warm
 *   value    0 = light ...........  1 = deep
 *   clarity  0 = muted/soft ......  1 = clear/bright
 *
 * Nearest-point classification (rather than nested conditionals) gives us a
 * runner-up season and a confidence for free, and keeps the tuning in one place.
 */
interface Season {
  name: SeasonName;
  temp: number;
  value: number;
  clarity: number;
  blurb: string;
  best: string[];
  avoid: string[];
}

export const SEASONS: Season[] = [
  {
    name: "Light Spring", temp: 0.6, value: 0.15, clarity: 0.6,
    blurb: "Warm and delicate — colours should stay light and fresh.",
    best: ["#F7C59F", "#FFD9A0", "#B7E4C7", "#A8DADC", "#FFE5B4", "#F4A896", "#C9E4A6", "#FDFCDC"],
    avoid: ["#000000", "#4A0E0E", "#2F3E46", "#5B2333"],
  },
  {
    name: "True Spring", temp: 1.0, value: 0.3, clarity: 0.8,
    blurb: "Warm and clear — golden, sunlit colours.",
    best: ["#FF9F1C", "#FFBF69", "#2EC4B6", "#CBF3F0", "#F4D35E", "#EE964B", "#8AC926", "#FFE066"],
    avoid: ["#4A4E69", "#22223B", "#8D99AE", "#6D6875"],
  },
  {
    name: "Bright Spring", temp: 0.5, value: 0.35, clarity: 1.0,
    blurb: "Warm-leaning and vivid — saturation is your friend.",
    best: ["#FF6B35", "#F7B801", "#00BBF9", "#00F5D4", "#FEE440", "#FF477E", "#38B000", "#48CAE4"],
    avoid: ["#6B705C", "#A5A58D", "#B7B7A4", "#7F5539"],
  },
  {
    name: "Light Summer", temp: -0.5, value: 0.15, clarity: 0.4,
    blurb: "Cool and soft — gentle, powdery tones.",
    best: ["#CDB4DB", "#BDE0FE", "#A2D2FF", "#FFC8DD", "#E0FBFC", "#B8C0FF", "#C8E7E3", "#DEE2FF"],
    avoid: ["#FF6B35", "#D00000", "#7F4F24", "#FFB703"],
  },
  {
    name: "True Summer", temp: -1.0, value: 0.4, clarity: 0.3,
    blurb: "Cool and muted — soft blues, roses and greys.",
    best: ["#8AA9C1", "#6D95B0", "#C08497", "#9EB3C2", "#B08EA2", "#7C99B4", "#A3B9C9", "#D5C6D0"],
    avoid: ["#FF9F1C", "#E85D04", "#9C6644", "#FFBA08"],
  },
  {
    name: "Soft Summer", temp: -0.3, value: 0.5, clarity: 0.1,
    blurb: "Cool-neutral and muted — nothing too bright.",
    best: ["#8E9AAF", "#B8B8D1", "#A5A58D", "#9A8C98", "#C9ADA7", "#6B8F9C", "#AFC1C4", "#B5B8A3"],
    avoid: ["#FF0000", "#FFEE32", "#00F5D4", "#FF477E"],
  },
  {
    name: "Soft Autumn", temp: 0.3, value: 0.5, clarity: 0.1,
    blurb: "Warm-neutral and muted — earthy, blended tones.",
    best: ["#A68A64", "#B6AD90", "#7F9172", "#C2A878", "#A4AC86", "#997B66", "#CBBFA6", "#8A9A7B"],
    avoid: ["#00F5D4", "#FF006E", "#3A0CA3", "#00BBF9"],
  },
  {
    name: "True Autumn", temp: 1.0, value: 0.65, clarity: 0.35,
    blurb: "Warm and rich — spice, moss and rust.",
    best: ["#BC6C25", "#606C38", "#DDA15E", "#9C6644", "#7F4F24", "#A3B18A", "#B08968", "#8A5A44"],
    avoid: ["#BDE0FE", "#CDB4DB", "#FFC8DD", "#A2D2FF"],
  },
  {
    name: "Dark Autumn", temp: 0.6, value: 0.85, clarity: 0.4,
    blurb: "Warm and deep — colours with weight.",
    best: ["#582F0E", "#7F4F24", "#414833", "#6A040F", "#936639", "#333D29", "#8B4513", "#5C4033"],
    avoid: ["#FFE5B4", "#E0FBFC", "#CBF3F0", "#FDFCDC"],
  },
  {
    name: "Bright Winter", temp: -0.4, value: 0.6, clarity: 1.0,
    blurb: "Cool-leaning and vivid — high contrast, high saturation.",
    best: ["#0077B6", "#D00000", "#3A0CA3", "#00B4D8", "#F72585", "#4361EE", "#FFFFFF", "#000000"],
    avoid: ["#B6AD90", "#A5A58D", "#CBBFA6", "#997B66"],
  },
  {
    name: "True Winter", temp: -1.0, value: 0.75, clarity: 0.9,
    blurb: "Cool and clear — icy brights against true black and white.",
    best: ["#03045E", "#0077B6", "#C1121F", "#5A189A", "#FFFFFF", "#000000", "#006BA6", "#B5179E"],
    avoid: ["#DDA15E", "#BC6C25", "#A68A64", "#E9C46A"],
  },
  {
    name: "Dark Winter", temp: -0.5, value: 0.95, clarity: 0.75,
    blurb: "Cool and deep — jewel tones and true darks.",
    best: ["#10002B", "#240046", "#3C096C", "#6A040F", "#023047", "#001219", "#005F73", "#0B3954"],
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

/** Map the profile onto the three season axes. */
function profileAxes(p: ColourProfile): { temp: number; value: number; clarity: number } {
  // temperature: undertone ratio ~1.05 is the cool/neutral edge, ~1.6 the warm edge
  const temp = Math.max(-1, Math.min(1, (p.undertoneRatio - 1.32) / 0.35));
  // value: ITA runs roughly +60 (very light) to -30 (deep)
  const value = Math.max(0, Math.min(1, (55 - p.ita) / 70));
  const clarity = p.clarity === "clear" ? 0.75 : 0.25;
  return { temp, value, clarity };
}

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
        1.0 * Math.pow(s.clarity - ax.clarity, 2),
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
  // dE 0 -> 10, dE 40+ -> 0
  let score = 10 * Math.max(0, 1 - best / 40);

  if (best < 12) {
    reasons.push(`Sits right inside your ${match.season.name} palette (ΔE ${best.toFixed(1)}).`);
  } else if (best < 25) {
    reasons.push(`Near your ${match.season.name} palette, but not a core shade (ΔE ${best.toFixed(1)}).`);
  } else {
    reasons.push(`Far from every ${match.season.name} shade (ΔE ${best.toFixed(1)}).`);
  }

  // 2. Explicit clash with the season's avoid list.
  let worstAvoid = Infinity;
  for (const hex of match.season.avoid) {
    worstAvoid = Math.min(worstAvoid, deltaE2000(g, hexToLab(hex)));
  }
  if (worstAvoid < 14) {
    score -= 2.5;
    reasons.push("Close to a shade that typically drains your colouring.");
  }

  // 3. Contrast fit - does the garment/skin lightness gap match the user's own?
  const gap = Math.abs(g.L - p.skinLab.L);
  const wants = p.contrast === "high" ? 45 : p.contrast === "medium" ? 28 : 14;
  const miss = Math.abs(gap - wants);
  if (miss < 12) {
    score += 0.8;
    reasons.push(`Contrast suits you — you carry ${p.contrast} contrast naturally.`);
  } else if (miss > 30) {
    score -= 0.8;
    reasons.push(
      gap > wants
        ? "Stronger contrast than your colouring carries; it may wear you."
        : "Too close to your own skin tone to give definition.",
    );
  }

  // 4. Redness. rednessRaw is LOW when redness is HIGH (it is a "good skin" score).
  //    Hues in the red/orange band sit next to facial redness and amplify it.
  if (p.rednessRaw !== undefined && p.rednessRaw < 80) {
    const nearRed = Math.abs(hueDelta(gl.h, 25)) < 35 && gl.C > 25;
    if (nearRed) {
      score -= 1.5;
      reasons.push(
        `Your measured redness is elevated (${p.rednessRaw.toFixed(0)}/100); this hue sits beside it and will emphasise it.`,
      );
    }
  }

  score = Math.max(0, Math.min(10, score));
  const verdict: GarmentScore["verdict"] =
    score >= 7.5 ? "great" : score >= 5.5 ? "good" : score >= 3.5 ? "risky" : "avoid";

  return { score, verdict, reasons, nearestPaletteHex: nearest, deltaE: best };
}
