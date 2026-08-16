/**
 * Builds public/presets/*.json from captured API responses.
 *
 * These presets let a judge see a complete, correct experience instantly and at
 * ZERO unit cost - and they keep the demo working after the grant runs out.
 * Run with:  npx vitest run scripts/genpreset.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { it, expect } from "vitest";
import { assembleProfile } from "../lib/profile";
import type { SkinReport, ConcernScore } from "../lib/skinzip";
import type { ToneResult } from "../lib/youcam";

const ROOT = path.resolve(__dirname, "..");
const SKIN_DIR = path.join(ROOT, "fixtures/api/skin_result/skinanalysisResult");

/** person_b's real hair is dark brown; the API returned "#FAF0BE (Blonde)". */
const HAIR_CORRECTIONS: Record<string, string> = { person_b: "#3A2A22" };

function readSkinReport(): SkinReport {
  const info = JSON.parse(fs.readFileSync(path.join(SKIN_DIR, "score_info.json"), "utf8"));
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
      // Only the redness mask is shipped: it is the concern that actually feeds
      // the garment advice, so it earns its bytes. Carrying all 14 pushed the
      // preset past 1MB for images nothing renders.
      const p = path.join(SKIN_DIR, value.output_mask_name ?? "");
      if (key === "redness" && value.output_mask_name && fs.existsSync(p)) {
        masks[key] = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
      }
    }
  }

  return {
    concerns: concerns.sort((a, b) => a.raw - b.raw),
    overall: info?.all?.score ?? 0,
    skinAge: info?.skin_age,
    masks,
    normalisedFace: undefined, // the model's own photo is shown instead
  };
}

it("writes the person_b preset", () => {
  const toneRaw = JSON.parse(
    fs.readFileSync(path.join(ROOT, "fixtures/api/tone_b.json"), "utf8"),
  );
  const c = toneRaw.data.results.color;
  const tone: ToneResult = {
    skinHex: c.skin_color,
    hairHex: c.hair_color,
    hairName: c.hair_color_name,
    eyeHex: c.eye_color,
    eyeName: c.eye_color_name,
    lipHex: c.lip_color,
    eyebrowHex: c.eyebrow_color,
    faceQuality: toneRaw.data.results.face_quality,
  };

  const skin = readSkinReport();
  const full = assembleProfile(tone, skin, HAIR_CORRECTIONS.person_b);

  const payload = {
    profile: full.profile,
    season: {
      name: full.season.season.name,
      blurb: full.season.season.blurb,
      best: full.season.season.best,
      avoid: full.season.season.avoid,
      runnerUp: full.season.runnerUp.name,
      confidence: full.season.confidence,
    },
    skin: {
      concerns: full.skin!.concerns,
      overall: full.skin!.overall,
      skinAge: full.skin!.skinAge,
      masks: full.skin!.masks,
      normalisedFace: full.skin!.normalisedFace,
    },
    tone: full.tone,
    warnings: full.warnings,
  };

  const out = path.join(ROOT, "public/presets/person_b.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload));

  // eslint-disable-next-line no-console
  console.log(
    `person_b preset -> ${full.season.season.name}`,
    `| ${full.skin!.concerns.length} concerns | ${(fs.statSync(out).size / 1024).toFixed(0)}KB`,
  );

  expect(payload.season.name).toBeTruthy();
  expect(payload.skin.concerns.length).toBe(14);
});
