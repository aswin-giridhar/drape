/**
 * Turns measurements into a spoken description of a garment on a person.
 *
 * This is the product. Everything else - the try-on, the colour analysis, the
 * geometry - exists to feed this. A blind shopper cannot use the render; they
 * can use what the render is measured to say.
 *
 * Writing rules followed here, from guidance by blind and low-vision users on
 * what image descriptions get wrong:
 *   - Lead with the thing they asked about, not with hedging.
 *   - Concrete over evocative. "Ends just above the knee", not "flatteringly cut".
 *   - Name the colour AND situate it, because a colour name alone
 *     ("dusty rose") is meaningless without knowing how it sits against you.
 *   - Never imply a judgement the measurement doesn't support.
 *   - Say what we could not determine, rather than omitting it silently.
 */

import { deltaE2000, hexToLab, hueDelta, labToLch, type Lab } from "./colour";
import type { ColourProfile } from "./palette";

/* ------------------------------------------------------------------ */
/* Colour naming                                                       */
/* ------------------------------------------------------------------ */

interface NamedColour {
  name: string;
  hex: string;
}

/**
 * A deliberately plain vocabulary. Retail colour names ("greige", "oatmeal",
 * "blush") are useless to someone who has never seen the colour; these are
 * words that carry meaning from the physical world.
 */
const COLOUR_NAMES: NamedColour[] = [
  { name: "black", hex: "#111111" },
  { name: "charcoal grey", hex: "#3A3D42" },
  { name: "mid grey", hex: "#8A8A8A" },
  { name: "light grey", hex: "#C9C9C9" },
  { name: "white", hex: "#F5F5F2" },
  { name: "cream", hex: "#F0EAD6" },
  { name: "beige", hex: "#D8C3A5" },
  { name: "camel brown", hex: "#C19A6B" },
  { name: "chocolate brown", hex: "#6B4423" },
  { name: "rust orange", hex: "#AA5528" },
  { name: "burnt orange", hex: "#CC5500" },
  { name: "bright orange", hex: "#F2792B" },
  { name: "mustard yellow", hex: "#E8962D" },
  { name: "pale yellow", hex: "#F5E6A3" },
  { name: "olive green", hex: "#606C38" },
  { name: "sage green", hex: "#A3B18A" },
  { name: "grass green", hex: "#4C9A2A" },
  { name: "emerald green", hex: "#046307" },
  { name: "teal", hex: "#2E6E8E" },
  { name: "petrol blue", hex: "#144C5C" },
  { name: "sky blue", hex: "#A8CADE" },
  { name: "royal blue", hex: "#2B4EBF" },
  { name: "navy blue", hex: "#1B2A4A" },
  { name: "lilac", hex: "#CDB4DB" },
  { name: "purple", hex: "#6A2C91" },
  { name: "burgundy red", hex: "#6A040F" },
  { name: "bright red", hex: "#D7263D" },
  { name: "coral pink", hex: "#E96E54" },
  { name: "dusky pink", hex: "#C08497" },
  { name: "hot pink", hex: "#C62C80" },
];

/** Nearest plain-English colour name, by perceptual distance. */
export function nameColour(hex: string): { name: string; confidence: number } {
  const lab = hexToLab(hex);
  let best = COLOUR_NAMES[0];
  let bestD = Infinity;
  for (const c of COLOUR_NAMES) {
    const d = deltaE2000(lab, hexToLab(c.hex));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  // dE under ~12 is a confident name; beyond ~28 we are guessing.
  const confidence = Math.max(0, Math.min(1, 1 - (bestD - 8) / 26));
  return { name: best.name, confidence };
}

/** Light / mid / deep, from L*. Spoken separately from hue because it matters. */
function lightnessWord(L: number): string {
  if (L > 78) return "very light";
  if (L > 60) return "light";
  if (L > 40) return "mid-toned";
  if (L > 22) return "deep";
  return "very deep";
}

/** How saturated, in words. Chroma is the axis people call "bright" or "muted". */
function intensityWord(C: number): string {
  if (C < 8) return "almost neutral";
  if (C < 20) return "soft and muted";
  if (C < 40) return "clear";
  return "vivid";
}

/* ------------------------------------------------------------------ */
/* Geometry vocabulary                                                 */
/* ------------------------------------------------------------------ */

export interface GarmentGeometry {
  /** Fraction of the person's height the garment covers, 0-1. */
  coverage: number;
  /** Where the lowest edge sits, as a fraction of body height from the head. */
  hem: number;
  /** Where the top edge sits, same scale. */
  neckline: number;
  /** How far sleeves extend horizontally relative to shoulder width, 0-1+. */
  sleeveReach: number;
  /** True when the mask is too fragmented to trust. */
  uncertain: boolean;
}

/**
 * Landmark fractions down a standing figure, used to turn a measured edge
 * position into a phrase someone can picture on their own body.
 */
function hemPhrase(hem: number): string {
  if (hem < 0.34) return "ends at the collarbone";
  if (hem < 0.42) return "ends at the chest";
  if (hem < 0.50) return "ends at the waist";
  if (hem < 0.56) return "ends at the hip";
  if (hem < 0.64) return "ends at the top of the thigh";
  if (hem < 0.72) return "ends mid-thigh";
  if (hem < 0.80) return "ends just above the knee";
  if (hem < 0.88) return "ends below the knee";
  return "reaches the ankle";
}

function sleevePhrase(reach: number): string {
  if (reach < 0.58) return "sleeveless, or close to it";
  if (reach < 0.72) return "short sleeves, ending at the upper arm";
  if (reach < 0.85) return "sleeves to the elbow";
  if (reach < 0.96) return "sleeves to the forearm";
  return "long sleeves, reaching the wrist";
}

/* ------------------------------------------------------------------ */
/* The description                                                     */
/* ------------------------------------------------------------------ */

export interface Description {
  /** One sentence answering "what is it". Spoken first. */
  headline: string;
  /** Ordered detail sentences. */
  detail: string[];
  /** Things we could not determine. Spoken, never hidden. */
  unknown: string[];
  /** Plain-language relationship to the wearer's own colouring. */
  againstYou: string;
  /** Full text for speech synthesis. */
  spoken: string;
}

export function describeGarment(
  garmentHex: string,
  profile: ColourProfile,
  geometry?: GarmentGeometry,
  opts: { patterned?: boolean } = {},
): Description {
  const lab = hexToLab(garmentHex);
  const lch = labToLch(lab);
  const { name, confidence } = nameColour(garmentHex);
  const detail: string[] = [];
  const unknown: string[] = [];

  /* --- what it is ------------------------------------------------- */
  const light = lightnessWord(lch.L);
  const intensity = intensityWord(lch.C);
  let headline = `A ${light} ${name}`;
  if (lch.C >= 8) headline += `, ${intensity}`;
  headline += ".";

  if (confidence < 0.45) {
    unknown.push(
      `The colour sits between named shades, so "${name}" is the closest word rather than an exact match.`,
    );
  }
  if (opts.patterned) {
    unknown.push(
      "There is more than one colour in this garment. Everything here describes the dominant one only, so a pattern may not be reflected.",
    );
  }

  /* --- how it sits against the wearer ------------------------------ */
  const skin = profile.skinLab;
  const dL = lch.L - skin.L;
  const skinLch = labToLch(skin);
  const hueGap = Math.abs(hueDelta(skinLch.h, lch.h));

  let againstYou: string;
  if (Math.abs(dL) < 10) {
    againstYou =
      "It is close to your own skin in lightness, so it will blend rather than stand apart. Edges and shape will read less sharply.";
  } else if (dL > 34) {
    againstYou = `It is much lighter than your skin, so it will stand out clearly and draw the eye upward.`;
  } else if (dL > 0) {
    againstYou = "It is a little lighter than your skin, giving gentle definition.";
  } else if (dL < -34) {
    againstYou =
      "It is much deeper than your skin, so there is strong contrast and the outline will read sharply.";
  } else {
    againstYou = "It is a little deeper than your skin, giving gentle definition.";
  }

  // Temperature relationship, in plain terms
  if (lch.C > 18) {
    const warmGarment = Math.abs(hueDelta(lch.h, 60)) < 90;
    const warmSkin = profile.undertone === "warm";
    if (profile.undertone !== "neutral") {
      againstYou +=
        warmGarment === warmSkin
          ? ` Its warmth matches your ${profile.undertone} colouring, so the two sit in the same family.`
          : ` It runs ${warmGarment ? "warmer" : "cooler"} than your ${profile.undertone} colouring, so it will contrast rather than harmonise.`;
    }
  }

  if (hueGap < 22 && lch.C > 20) {
    detail.push(
      "The colour is close in hue to your own skin tone, which can look tonal and calm, or washed out in strong light.",
    );
  }

  /* --- redness caution, only when measured -------------------------- */
  if (profile.rednessRaw !== undefined && profile.rednessRaw < 80) {
    const nearRed = Math.abs(hueDelta(lch.h, 25)) < 35 && lch.C > 25;
    if (nearRed) {
      detail.push(
        "Your reading shows more redness in the skin than average, and this colour sits in the same red family, which tends to emphasise it.",
      );
    }
  }

  /* --- shape -------------------------------------------------------- */
  if (geometry && !geometry.uncertain) {
    detail.push(`On the body it ${hemPhrase(geometry.hem)}, with ${sleevePhrase(geometry.sleeveReach)}.`);
    const pct = Math.round(geometry.coverage * 100);
    detail.push(`It covers roughly ${pct} percent of your height.`);
  } else if (geometry?.uncertain) {
    unknown.push(
      "The outline of the garment could not be measured reliably in this photograph, so there is no description of its length or sleeves.",
    );
  } else {
    unknown.push("No shape measurement was taken, so this describes colour only.");
  }

  const spoken = [headline, againstYou, ...detail, ...unknown].join(" ");
  return { headline, detail, unknown, againstYou, spoken };
}
