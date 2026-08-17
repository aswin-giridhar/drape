import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { recolourHair, uploadImage, YouCamError } from "@/lib/youcam";
import { assertBudget, COST, noteSpend, refundSpend } from "@/lib/budget";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * POST /api/hair
 * body: { imageBase64: string, hex: string, cacheKey?: string }
 *
 * Contrast is the one axis of a colour season a person can actually change, and
 * hair is the lever. At 1 unit a render this is the cheapest thing on the
 * platform, so it stays available long after the try-on budget would be gone.
 */
const cache = new Map<string, { url: string; at: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000;

const fingerprint = (s: string) =>
  crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

export async function POST(req: Request) {
  const limited = rateLimit(req, "tryon");
  if (limited) return limited;

  let reserved = 0;
  try {
    const { imageBase64, hex, cacheKey } = (await req.json()) as {
      imageBase64?: string;
      hex?: string;
      cacheKey?: string;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: "No photograph supplied." }, { status: 400 });
    }
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) {
      return NextResponse.json({ error: "That isn't a colour we can use." }, { status: 400 });
    }

    const ck = `${cacheKey ?? fingerprint(imageBase64)}::${hex.toLowerCase()}`;
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json({ imageUrl: hit.url, cached: true });
    }
    if (hit) cache.delete(ck);

    await assertBudget(COST.hairColour);
    noteSpend(COST.hairColour);
    reserved = COST.hairColour;

    const buf = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (!jpeg && !png) {
      return NextResponse.json(
        { error: "We couldn't read that photograph — please use a JPEG or PNG." },
        { status: 400 },
      );
    }

    const fileId = await uploadImage("hair-color", buf, "face.jpg");
    const { imageUrl } = await recolourHair(fileId, hex);
    reserved = 0;

    cache.set(ck, { url: imageUrl, at: Date.now() });
    return NextResponse.json({ imageUrl, cached: false });
  } catch (e) {
    if (e instanceof YouCamError) {
      return NextResponse.json(
        { error: e.userMessage, code: e.code, retryable: e.retryable },
        { status: e.code === "out_of_units" ? 503 : 422 },
      );
    }
    console.error("hair colour failed:", e);
    return NextResponse.json({ error: "The hair colour didn't come back." }, { status: 500 });
  } finally {
    // Failed tasks are not billed. `finally`, not `catch`, because the success
    // path also has to clear the reservation.
    if (reserved > 0) refundSpend(reserved);
  }
}
