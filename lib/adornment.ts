/**
 * Metals and lip colours.
 *
 * These are the two questions every real colour-analysis session ends with -
 * "gold or silver?" and "what lipstick?" - and the product was silent on both.
 *
 * Neither needs a new API call. Metal tone is the most direct inference
 * available from undertone, which we already measure, and a lipstick is a
 * colour held against the same face as a garment, so `scoreGarment` answers it
 * unchanged. Adding an endpoint here would have bought nothing except a
 * dependency.
 *
 * What this file does NOT do is pretend to more precision than it has. The
 * metal verdict is reported as a preference with the measured undertone ratio
 * beside it, not as a score out of ten, because two swatches is not a ranking.
 */

import { scoreGarment, type ColourProfile, type GarmentScore } from "./palette";

export interface MetalVerdict {
  /** The metal that suits, or null when the wearer is genuinely neutral. */
  best: "gold" | "silver" | null;
  hex: string;
  /** Plain sentence, safe to speak aloud. */
  sentence: string;
  /** The measurement behind it, so the claim can be checked. */
  basis: string;
}

const GOLD = "#D4AF37";
const SILVER = "#C4C8CC";

/**
 * Warm undertones take yellow gold, cool take silver and white metals. This is
 * the single most reliable rule in the practice, and the one our measurement
 * maps onto most directly.
 *
 * The neutral band is deliberately wide. Someone sitting near the line genuinely
 * suits both, and saying so is more useful than resolving a coin toss into a
 * confident answer.
 */
export function metalFor(profile: ColourProfile): MetalVerdict {
  const r = profile.undertoneRatio;
  const basis = `Undertone ${profile.undertone}, ratio ${r.toFixed(2)}.`;

  // Branch on the undertone the card ALREADY prints, never on a fresh threshold
  // over the same ratio. A second set of cut-offs would let the card say
  // "neutral" while the jewellery said "gold", and the two would have no way to
  // be reconciled - the same failure the 3D mesh had against its own swatch.
  if (profile.undertone === "warm") {
    return {
      best: "gold",
      hex: GOLD,
      sentence:
        "Yellow gold suits you. Your skin reads warm, and warm metals sit in the same family as your own colouring rather than against it.",
      basis,
    };
  }
  if (profile.undertone === "cool") {
    return {
      best: "silver",
      hex: SILVER,
      sentence:
        "Silver and white metals suit you. Your skin reads cool, and a warm yellow metal will look separate from it rather than part of it.",
      basis,
    };
  }
  return {
    best: null,
    hex: GOLD,
    sentence:
      "You sit near the neutral line, so both metals work. Rose gold and mixed-metal pieces are the safest choices, and you can wear either on its own.",
    basis,
  };
}

export interface LipSwatch {
  name: string;
  hex: string;
  score: GarmentScore;
}

/**
 * A spread of lipstick shades wide enough that the ranking means something.
 *
 * Deliberately spans cool blue-reds through warm corals to neutral browns and
 * nudes: a list that only contained flattering shades could not separate, and a
 * gate nothing can fail is not a gate.
 */
const LIPS: { name: string; hex: string }[] = [
  { name: "Blue-red", hex: "#A4133C" },
  { name: "True red", hex: "#C1121F" },
  { name: "Warm red", hex: "#D62828" },
  { name: "Coral", hex: "#F4795B" },
  { name: "Terracotta", hex: "#B5551D" },
  { name: "Brick", hex: "#8A3033" },
  { name: "Berry", hex: "#7B2D45" },
  { name: "Plum", hex: "#5A2A48" },
  { name: "Mauve", hex: "#9E6B76" },
  { name: "Rose", hex: "#C97B84" },
  { name: "Warm nude", hex: "#C08A6E" },
  { name: "Cool nude", hex: "#B98E90" },
];

/** Rank lip colours against the same measured profile a garment is judged by. */
export function rankLips(profile: ColourProfile): LipSwatch[] {
  return LIPS.map((l) => ({ ...l, score: scoreGarment(l.hex, profile) })).sort(
    (a, b) => b.score.score - a.score.score,
  );
}
