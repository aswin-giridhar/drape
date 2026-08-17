import { NextResponse } from "next/server";
import { listGarmentTemplates, YouCamError, type CatalogueItem } from "@/lib/youcam";

export const runtime = "nodejs";
// Reads a query string, so it must render per-request rather than at build time.
export const dynamic = "force-dynamic";

/** Browsing the catalogue is free - no units are consumed listing templates. */
export async function GET(req: Request) {
  try {
    const nextToken = new URL(req.url).searchParams.get("next") ?? undefined;

    // Walk a few pages rather than one. Paging was broken until now (the request
    // parameter is `starting_token`, not the `next_token` the response returns),
    // so the catalogue could only ever show its first page - and that page is
    // mostly national football kits, which is how a colour-analysis product
    // ended up recommending the Senegal strip as its top result.
    const seen: CatalogueItem[] = [];
    let cursor = nextToken;
    for (let page = 0; page < 4; page++) {
      const { items, nextToken: next } = await listGarmentTemplates(cursor);
      seen.push(...items);
      cursor = next;
      if (!next) break;
    }

    // Sports is the football-kit category. A national strip is a multi-coloured
    // striped shirt with a crest: "dominant colour" is a poor summary of it, so
    // scoring one is close to meaningless, and it reads as a joke next to a
    // measured recommendation.
    const wearable = seen.filter((i) => i.category !== "Sports");

    return NextResponse.json({ items: wearable.slice(0, 24), next: undefined });
  } catch (e) {
    if (e instanceof YouCamError) {
      return NextResponse.json({ error: e.userMessage, code: e.code }, { status: 422 });
    }
    console.error("catalogue failed:", e);
    return NextResponse.json({ error: "Couldn't load the catalogue." }, { status: 500 });
  }
}
