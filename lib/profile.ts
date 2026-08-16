/**
 * Turns raw API output into a ColourProfile, and — importantly — says how much
 * it trusts each measurement.
 *
 * We caught the API returning "#FAF0BE (Blonde)" for a subject with abundant
 * dark brown hair. Rather than silently trusting it (which would silently
 * mis-season the user) or silently discarding it, we detect the implausible
 * case and ask the user to confirm. That is also how a human colour analyst
 * works: measure, then check with the client.
 */

import { hexToLab, labToLch, undertoneFromLab } from "./colour";
import { buildProfile, classifySeason, type ColourProfile, type SeasonMatch } from "./palette";
import type { ToneResult } from "./youcam";
import type { SkinReport } from "./skinzip";

export interface Warning {
  field: string;
  message: string;
  needsConfirmation: boolean;
}

export interface FullProfile {
  profile: ColourProfile;
  season: SeasonMatch;
  skin?: SkinReport;
  tone: ToneResult;
  warnings: Warning[];
}

/**
 * Hair colour sanity check.
 *
 * A near-white, near-grey value usually means the detector sampled the
 * background rather than hair. We cannot prove which happened, so we flag it
 * instead of guessing.
 */
/**
 * Used when the API omits hair colour entirely (it does, for some subjects) or
 * returns something implausible. Deliberately mid-dark and fully neutral so it
 * biases the contrast estimate as little as possible.
 */
const HAIR_FALLBACK = "#3A3A3A";

export function hairColourLooksWrong(hairHex?: string): boolean {
  if (!hairHex) return true;
  try {
    const lch = labToLch(hexToLab(hairHex));
    // Very light AND very desaturated == almost certainly background bleed.
    return lch.L > 85 && lch.C < 18;
  } catch {
    return true;
  }
}

export function assembleProfile(
  tone: ToneResult,
  skin?: SkinReport,
  hairOverride?: string,
): FullProfile {
  const warnings: Warning[] = [];

  let hairHex = hairOverride ?? tone.hairHex;
  if (!hairOverride && hairColourLooksWrong(tone.hairHex)) {
    // Never let a missing or implausible reading crash the profile, and never
    // let it pass as measured either.
    hairHex = HAIR_FALLBACK;
    warnings.push({
      field: "hairHex",
      message: tone.hairHex
        ? `We read your hair as ${tone.hairName ?? tone.hairHex}, but that looks like it may have ` +
          `picked up the background. Your contrast is estimated until you confirm it — hair colour ` +
          `strongly affects your season.`
        : `The analyser didn't return a hair colour for this photograph, so your contrast is ` +
          `estimated rather than measured. Confirming it will sharpen the result.`,
      needsConfirmation: true,
    });
  }

  const redness = skin?.concerns.find((c) => c.concern === "redness")?.raw;

  const profile = buildProfile({
    skinHex: tone.skinHex,
    hairHex,
    eyeHex: tone.eyeHex,
    lipHex: tone.lipHex,
    rednessRaw: redness,
  });

  // Cross-check the API's undertone against the lip colour, which is an
  // independent signal from the same face.
  if (tone.lipHex) {
    const skinTone = undertoneFromLab(hexToLab(tone.skinHex)).undertone;
    const lipTone = undertoneFromLab(hexToLab(tone.lipHex)).undertone;
    if (skinTone !== "neutral" && lipTone !== "neutral" && skinTone !== lipTone) {
      warnings.push({
        field: "undertone",
        message:
          `Your skin reads ${skinTone} but your lip colour reads ${lipTone}. You may sit near ` +
          `the neutral line, so treat the season below as a starting point.`,
        needsConfirmation: false,
      });
    }
  }

  const season = classifySeason(profile);
  if (season.confidence < 0.35) {
    warnings.push({
      field: "season",
      message:
        `You sit between ${season.season.name} and ${season.runnerUp.name}. Colours shared by ` +
        `both will be your safest choices.`,
      needsConfirmation: false,
    });
  }

  return { profile, season, skin, tone, warnings };
}
