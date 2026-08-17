import { NextResponse } from "next/server";
import { assembleProfile } from "@/lib/profile";
import { parseSkinZip } from "@/lib/skinzip";
import { analyseSkin, analyseTone, uploadImage, YouCamError } from "@/lib/youcam";
import { assertBudget, COST, FULL_SCAN_COST, noteSpend, refundSpend } from "@/lib/budget";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * POST /api/scan
 * body: { imageBase64: string, hairOverride?: string }
 *
 * Runs BOTH YouCam analyses on the same face photo:
 *   - skin-tone-analysis  (20u) -> the skin/eye/lip colours the palette needs
 *   - skin-analysis       (16u) -> 14 concern raw scores; redness feeds scoring
 *
 * The file API is per-feature, so the image is uploaded once for each.
 */
export async function POST(req: Request) {
  // A full scan is 36 units - by far the most expensive thing here, and it is
  // unauthenticated. Without this the reserve floor protects the grant from our
  // own demo traffic and from nobody else.
  const limited = rateLimit(req, "scan");
  if (limited) return limited;

  // Reserve up front, refund what didn't happen. The other order - spend, then
  // decrement - lets parallel requests both read the same pre-spend balance and
  // sail past the floor together.
  let reserved = 0;
  try {
    const { imageBase64, hairOverride } = (await req.json()) as {
      imageBase64?: string;
      hairOverride?: string;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: "No image supplied." }, { status: 400 });
    }

    const bytes = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    if (bytes.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "That image is over 10MB — please use a smaller one." },
        { status: 400 },
      );
    }

    await assertBudget(FULL_SCAN_COST);
    noteSpend(FULL_SCAN_COST);
    reserved = FULL_SCAN_COST;

    // Tone first: it is what the palette actually needs. If it fails, the whole
    // scan is pointless and we have spent nothing on skin analysis.
    const toneFileId = await uploadImage("skin-tone-analysis", bytes, "face.jpg");
    const tone = await analyseTone(toneFileId);
    reserved -= COST.toneAnalysis; // really spent

    let skin;
    let skinFailed = false;
    try {
      const skinFileId = await uploadImage("skin-analysis", bytes, "face.jpg");
      const { zipUrl } = await analyseSkin(skinFileId);
      skin = await parseSkinZip(zipUrl);
      reserved -= COST.skinAnalysis; // really spent
    } catch (e) {
      // A colour profile is still useful without concern scores; degrade
      // explicitly rather than failing the whole scan.
      skinFailed = true;
      console.warn("skin analysis failed, continuing with tone only:", e);
    }

    const full = assembleProfile(tone, skin, hairOverride);
    if (skinFailed) {
      // Say so. Silently dropping it would let a redness-free profile pass as a
      // complete measurement.
      full.warnings.push({
        field: "skin",
        message:
          `The skin analysis didn't complete for this photograph, so your redness reading is ` +
          `missing. Your colour season is still measured from your skin, eyes, hair and lips.`,
        needsConfirmation: false,
      });
    }
    return NextResponse.json({
      profile: full.profile,
      season: {
        name: full.season.season.name,
        blurb: full.season.season.blurb,
        best: full.season.season.best,
        avoid: full.season.season.avoid,
        runnerUp: full.season.runnerUp.name,
        confidence: full.season.confidence,
      },
      skin: full.skin
        ? {
            concerns: full.skin.concerns,
            overall: full.skin.overall,
            skinAge: full.skin.skinAge,
            masks: full.skin.masks,
            normalisedFace: full.skin.normalisedFace,
          }
        : null,
      tone: full.tone,
      warnings: full.warnings,
    });
  } catch (e) {
    if (e instanceof YouCamError) {
      return NextResponse.json(
        { error: e.userMessage, code: e.code, retryable: e.retryable },
        { status: e.code === "out_of_units" ? 503 : 422 },
      );
    }
    console.error("scan failed:", e);
    return NextResponse.json(
      { error: "Something went wrong running the scan." },
      { status: 500 },
    );
  } finally {
    // Failed vendor tasks aren't billed, so hand back whatever was reserved and
    // not used - otherwise the floor trips against phantom spend. This has to be
    // `finally`, not `catch`: the skin analysis can fail while the request as a
    // whole succeeds, and that path leaves a reservation outstanding too.
    if (reserved > 0) refundSpend(reserved);
  }
}
