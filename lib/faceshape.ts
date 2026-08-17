/**
 * Neckline guidance from a measured face shape.
 *
 * Why this exists: a colour analysis that only ever talks about colour is only
 * doing half the job. The rail shows one crew-neck t-shirt in fourteen colours,
 * and the neckline is doing as much work against a face as the colour is - which
 * is a fair criticism of a product that claims to tell you what suits you.
 *
 * `face-attr-analysis` returns a face shape, and it is the ONLY thing that
 * endpoint tells us that we cannot get elsewhere: its colour readings are the
 * same engine as `skin-tone-analysis` (7 of 9 values byte-identical across three
 * sitters, the other two below a just-noticeable difference). So the face shape
 * is the whole reason to call it.
 *
 * The mapping itself is CONVENTIONAL STYLING PRACTICE, not measurement, and it
 * is labelled that way in the interface. The principle behind every line is the
 * same one: a neckline reads as a shape next to the jaw, so repeating the face's
 * own shape emphasises it and opposing it balances it. We are not going to
 * pretend a lookup table is an instrument reading.
 */

export interface NecklineAdvice {
  /** The measured shape, as returned by the API. */
  shape: string;
  /** One sentence, plain, safe to speak aloud. */
  advice: string;
  /** How the crew neck on the rail specifically fares. */
  crewVerdict: string;
}

const GUIDE: Record<string, { advice: string; crewVerdict: string }> = {
  oval: {
    advice: "Most necklines sit well on an oval face — there is no shape you need to avoid.",
    crewVerdict: "The crew neck on the rail is working fine for you.",
  },
  round: {
    advice:
      "A V-neck or any open, vertical neckline draws the eye downward and lengthens a round face.",
    crewVerdict: "A high crew neck is the one shape working against you — it repeats the roundness.",
  },
  square: {
    advice:
      "Soft, curved necklines — a scoop or a sweetheart — balance the strong horizontal of a square jaw.",
    crewVerdict: "The crew neck echoes your jawline rather than softening it.",
  },
  heart: {
    advice:
      "Wider necklines like a boat neck or a scoop balance a narrow chin by adding width lower down.",
    crewVerdict: "The crew neck is neutral for you — neither helping nor hurting.",
  },
  oblong: {
    advice:
      "Horizontal necklines — boat, wide crew, off-shoulder — break up the length of an oblong face.",
    crewVerdict: "The crew neck on the rail suits you; a deep V would lengthen further.",
  },
  diamond: {
    advice: "Scoop and boat necklines soften the width through the cheekbones.",
    crewVerdict: "The crew neck is neutral for you.",
  },
  triangle: {
    advice:
      "A wide neckline — boat or off-shoulder — adds width at the top and balances a broader jaw.",
    crewVerdict: "The crew neck sits narrow against a wider jaw; a boat neck would balance better.",
  },
  invtriangle: {
    advice: "A V-neck or scoop narrows the upper body and balances broader shoulders.",
    crewVerdict: "The crew neck adds width where you already have it.",
  },
};

/**
 * Returns undefined when the shape is missing or unrecognised, rather than
 * inventing generic advice. A missing measurement must read as missing.
 */
export function necklineFor(shape?: string): NecklineAdvice | undefined {
  if (!shape) return undefined;
  const key = shape.toLowerCase().replace(/[^a-z]/g, "");
  const hit = GUIDE[key] ?? GUIDE[key.replace(/^inverted/, "inv")];
  if (!hit) return undefined;
  return { shape, ...hit };
}
