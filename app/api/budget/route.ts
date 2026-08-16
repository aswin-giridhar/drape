import { NextResponse } from "next/server";
import { budgetStatus } from "@/lib/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Surfaces the live unit budget so the UI can show an honest banner when
 * generation is paused - rather than silently rendering nothing.
 */
export async function GET() {
  try {
    return NextResponse.json(await budgetStatus());
  } catch (e) {
    console.error("budget check failed:", e);
    // An unreachable API is NOT the same as "no units". Say which happened.
    return NextResponse.json(
      { error: "Couldn't reach the YouCam API to check the unit balance.", unreachable: true },
      { status: 503 },
    );
  }
}
