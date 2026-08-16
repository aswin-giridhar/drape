import { NextResponse } from "next/server";
import { listGarmentTemplates, YouCamError } from "@/lib/youcam";

export const runtime = "nodejs";
// Reads a query string, so it must render per-request rather than at build time.
export const dynamic = "force-dynamic";

/** Browsing the catalogue is free - no units are consumed listing templates. */
export async function GET(req: Request) {
  try {
    const nextToken = new URL(req.url).searchParams.get("next") ?? undefined;
    const { items, nextToken: next } = await listGarmentTemplates(nextToken);
    return NextResponse.json({ items, next });
  } catch (e) {
    if (e instanceof YouCamError) {
      return NextResponse.json({ error: e.userMessage, code: e.code }, { status: 422 });
    }
    console.error("catalogue failed:", e);
    return NextResponse.json({ error: "Couldn't load the catalogue." }, { status: 500 });
  }
}
