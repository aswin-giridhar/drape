import { NextResponse } from "next/server";

/**
 * A small per-IP token bucket.
 *
 * The unit budget is finite and the reserve floor exists to guarantee a judge a
 * live run. Without this, the floor only protects the grant from our own demo
 * traffic - anyone can drain it from a shell loop, since /api/scan costs 36
 * units per anonymous request.
 *
 * In-process, so on serverless it is per-instance rather than global. That is
 * genuinely weaker than a shared store, but it turns a trivial drain into one
 * that has to work at it, and it costs nothing to run.
 */
interface Bucket {
  tokens: number;
  at: number;
}

const buckets = new Map<string, Bucket>();

const LIMITS: Record<string, { burst: number; perMinute: number }> = {
  scan: { burst: 4, perMinute: 3 },
  tryon: { burst: 10, perMinute: 12 },
};

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Returns a 429 response when the caller is over budget, otherwise null. */
export function rateLimit(req: Request, route: keyof typeof LIMITS | string): NextResponse | null {
  const cfg = LIMITS[route] ?? { burst: 20, perMinute: 20 };
  const key = `${route}:${clientKey(req)}`;
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: cfg.burst, at: now };

  // Refill continuously rather than in fixed windows, so a burst at a window
  // boundary can't double the allowance.
  const refill = ((now - b.at) / 60_000) * cfg.perMinute;
  b.tokens = Math.min(cfg.burst, b.tokens + refill);
  b.at = now;

  if (b.tokens < 1) {
    buckets.set(key, b);
    const wait = Math.ceil(((1 - b.tokens) / cfg.perMinute) * 60);
    return NextResponse.json(
      {
        error: `That's a lot of requests at once. Please wait about ${wait} seconds and try again.`,
        code: "rate_limited",
        retryable: true,
      },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  b.tokens -= 1;
  buckets.set(key, b);

  // Keep the map from growing without bound on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.at > 10 * 60_000) buckets.delete(k);
    }
  }
  return null;
}
