/**
 * Builds public/presets/*.json from captured API responses.
 *
 * These presets let a judge see a complete, correct experience instantly and at
 * ZERO unit cost - and they keep the demo working after the grant runs out.
 * Run with:  npx vitest run scripts/genpreset.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { assembleProfile } from "../lib/profile";
import type { SkinReport, ConcernScore } from "../lib/skinzip";
import type { ToneResult } from "../lib/youcam";

const ROOT = path.resolve(__dirname, "..");
const API = path.join(ROOT, "fixtures/api");

interface SitterSpec {
  id: string;
  toneFile: string;
  skinDir: string;
  /** Set only where the API's hair reading is demonstrably wrong. */
  hairOverride?: string;
}

const SITTERS: SitterSpec[] = [
  // The tone API returned "#FAF0BE (Blonde)" for a subject with clearly dark
  // brown hair — see the spec, section 2, rule 8.
  { id: "person_b", toneFile: "tone_b.json", skinDir: "skin_result", hairOverride: "#3A2A22" },
  { id: "person_a", toneFile: "tone_person_a.json", skinDir: "skin_person_a" },
  { id: "person_c", toneFile: "tone_person_c.json", skinDir: "skin_person_c" },
];

function readSkinReport(dir: string): SkinReport {
  const base = path.join(API, dir, "skinanalysisResult");
  const info = JSON.parse(fs.readFileSync(path.join(base, "score_info.json"), "utf8"));
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
      // Only the redness mask is shipped: it is the concern that feeds the
      // garment advice, so it earns its bytes. All fourteen pushed the preset
      // past 1MB for images nothing renders.
      const p = path.join(base, value.output_mask_name ?? "");
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
    normalisedFace: undefined, // the sitter's own photograph is shown instead
  };
}

describe("presets", () => {
  for (const spec of SITTERS) {
    it(`writes the ${spec.id} preset`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(API, spec.toneFile), "utf8"));
      const c = raw.data.results.color;
      const tone: ToneResult = {
        skinHex: c.skin_color,
        hairHex: c.hair_color,
        hairName: c.hair_color_name,
        eyeHex: c.eye_color,
        eyeName: c.eye_color_name,
        lipHex: c.lip_color,
        eyebrowHex: c.eyebrow_color,
        faceQuality: raw.data.results.face_quality,
      };

      const skin = readSkinReport(spec.skinDir);
      const full = assembleProfile(tone, skin, spec.hairOverride);

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

      const out = path.join(ROOT, `public/presets/${spec.id}.json`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(payload));

      // eslint-disable-next-line no-console
      console.log(
        `${spec.id} -> ${full.season.season.name} (runner-up ${full.season.runnerUp.name})`,
        `| skin ${full.profile.skinHex} ITA ${full.profile.ita.toFixed(1)}`,
        `${full.profile.undertone} ${full.profile.contrast}-contrast`,
        `| ${full.warnings.length} warning(s) | ${(fs.statSync(out).size / 1024).toFixed(0)}KB`,
      );

      expect(payload.season.name).toBeTruthy();
      expect(payload.skin.concerns.length).toBe(14);
    });
  }
});
