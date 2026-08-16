/**
 * Skin Analysis returns a ZIP containing score_info.json plus one heatmap mask
 * per concern. This unpacks it.
 *
 * IMPORTANT: we read `raw_score`, never `ui_score`. Perfect Corp's own docs say
 * ui_score is adjusted upward "to produce more favorable results ... consumers
 * generally prefer positive evaluations". A product that claims to measure
 * cannot display a number engineered to flatter.
 */

import JSZip from "jszip";

export interface ConcernScore {
  concern: string;
  raw: number;
  /** The flattering figure. Kept only so we can show the honest gap if asked. */
  ui: number;
  maskName?: string;
}

export interface SkinReport {
  concerns: ConcernScore[];
  overall: number;
  skinAge?: number;
  /** data: URI of the API's normalised face image. */
  normalisedFace?: string;
  /** concern -> data: URI heatmap overlay. */
  masks: Record<string, string>;
}

const CONCERN_LABELS: Record<string, string> = {
  wrinkle: "Wrinkles",
  droopy_upper_eyelid: "Upper eyelids",
  droopy_lower_eyelid: "Lower eyelids",
  firmness: "Firmness",
  acne: "Blemishes",
  moisture: "Moisture",
  eye_bag: "Eye bags",
  dark_circle_v2: "Dark circles",
  age_spot: "Age spots",
  radiance: "Radiance",
  redness: "Redness",
  oiliness: "Oiliness",
  pore: "Pores",
  texture: "Texture",
};

export const labelFor = (concern: string): string =>
  CONCERN_LABELS[concern] ?? concern.replace(/_/g, " ");

export async function parseSkinZip(zipUrl: string): Promise<SkinReport> {
  const res = await fetch(zipUrl);
  if (!res.ok) {
    throw new Error(`could not download skin analysis result: HTTP ${res.status}`);
  }
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  const scoreFile = Object.keys(zip.files).find((n) => n.endsWith("score_info.json"));
  if (!scoreFile) {
    throw new Error("skin analysis ZIP contained no score_info.json");
  }
  const info = JSON.parse(await zip.files[scoreFile].async("string"));

  const concerns: ConcernScore[] = [];
  const masks: Record<string, string> = {};

  for (const [key, value] of Object.entries<any>(info)) {
    if (key === "all" || key === "skin_age" || key === "resize_image") continue;
    if (value && typeof value === "object" && "raw_score" in value) {
      concerns.push({
        concern: key,
        raw: value.raw_score,
        ui: value.ui_score,
        maskName: value.output_mask_name,
      });
    }
  }

  const asDataUri = async (name: string | undefined, mime = "image/png") => {
    if (!name) return undefined;
    const entry = Object.keys(zip.files).find((n) => n.endsWith(name));
    if (!entry) return undefined;
    const b64 = await zip.files[entry].async("base64");
    return `data:${mime};base64,${b64}`;
  };

  for (const c of concerns) {
    const uri = await asDataUri(c.maskName);
    if (uri) masks[c.concern] = uri;
  }

  return {
    concerns: concerns.sort((a, b) => a.raw - b.raw), // worst first: that is what matters
    overall: info?.all?.score ?? 0,
    skinAge: info?.skin_age,
    normalisedFace: await asDataUri(info?.resize_image?.image_name, "image/jpeg"),
    masks,
  };
}
