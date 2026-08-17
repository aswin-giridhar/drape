import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { tryOnGarment, uploadImage, YouCamError, type GarmentCategory } from "@/lib/youcam";
import { assertBudget, COST, noteSpend, refundSpend } from "@/lib/budget";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * In-process try-on cache.
 *
 * Safe on content because Apparel VTO is deterministic: the same person plus the
 * same garment returned byte-identical results across repeated runs (measured).
 *
 * Two things this MUST get right, both learned the hard way:
 *
 * 1. The garment has to be IN the key. An earlier version keyed on
 *    `templateId ?? "custom"`, so every uploaded garment shared the single key
 *    "custom" - upload one garment, then another, and the second returned the
 *    first one's render. In the spoken description that is worse than a wrong
 *    picture: the colour is re-read from the new garment while the geometry is
 *    measured against the stale render, producing a confident sentence about
 *    something the wearer is not wearing.
 *
 * 2. Entries expire. The vendor returns presigned S3 URLs under a path segment
 *    literally named `ttl30`, so a warm instance would otherwise serve a dead
 *    link as a cache hit - turning "broken" into "absent", which is the one
 *    thing this codebase promises not to do.
 */
const cache = new Map<string, { url: string; at: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000;

const fingerprint = (b64: string) =>
  crypto.createHash("sha256").update(b64).digest("hex").slice(0, 16);

export async function POST(req: Request) {
  const limited = rateLimit(req, "tryon");
  if (limited) return limited;

  let spent = 0;
  try {
    const {
      personBase64,
      garmentBase64,
      templateId,
      category = "upper_body",
      cacheKey,
    } = (await req.json()) as {
      personBase64?: string;
      garmentBase64?: string;
      templateId?: string;
      category?: GarmentCategory;
      cacheKey?: string;
    };

    if (!personBase64) {
      return NextResponse.json({ error: "No photo of you supplied." }, { status: 400 });
    }
    if (!garmentBase64 && !templateId) {
      return NextResponse.json({ error: "No garment supplied." }, { status: 400 });
    }

    // The garment identity is the template id, or a hash of the actual bytes.
    const garmentId = templateId ?? fingerprint(garmentBase64!);
    const ck = `${cacheKey ?? "anon"}::${garmentId}::${category}`;

    if (cacheKey) {
      const hit = cache.get(ck);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return NextResponse.json({ imageUrl: hit.url, cached: true });
      }
      if (hit) cache.delete(ck); // expired: fall through and re-render
    }

    await assertBudget(COST.tryOn);
    noteSpend(COST.tryOn); // reserve before spending, refund below if it fails
    spent = COST.tryOn;

    const personBytes = decodeImage(personBase64, "your photo");
    const personFileId = await uploadImage("cloth", personBytes, "person.jpg");

    let garmentFileId: string | undefined;
    if (garmentBase64) {
      garmentFileId = await uploadImage("cloth", decodeImage(garmentBase64, "the garment"), "garment.jpg");
    }

    const { imageUrl } = await tryOnGarment({
      personFileId,
      garmentFileId,
      templateId,
      category,
    });
    spent = 0; // succeeded: the reservation was real

    if (cacheKey) cache.set(ck, { url: imageUrl, at: Date.now() });
    return NextResponse.json({ imageUrl, cached: false });
  } catch (e) {
    // Failed tasks cost nothing, so give the reservation back.
    if (spent) refundSpend(spent);
    if (e instanceof YouCamError) {
      return NextResponse.json(
        { error: e.userMessage, code: e.code, retryable: e.retryable },
        { status: e.code === "out_of_units" ? 503 : 422 },
      );
    }
    if (e instanceof BadImageError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("try-on failed:", e);
    return NextResponse.json({ error: "The try-on failed." }, { status: 500 });
  }
}

class BadImageError extends Error {}

/**
 * Decode a data URI and confirm it really is a JPEG or PNG.
 *
 * Buffer.from(..., "base64") silently drops invalid characters rather than
 * throwing, so without a magic-byte check arbitrary bytes get forwarded to the
 * vendor labelled image/jpeg.
 */
function decodeImage(dataUri: string, what: string): Buffer {
  const buf = Buffer.from(dataUri.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!jpeg && !png) {
    throw new BadImageError(`We couldn't read ${what} — please use a JPEG or PNG.`);
  }
  return buf;
}
