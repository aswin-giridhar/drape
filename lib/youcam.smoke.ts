/**
 * Live smoke test for the TypeScript client port.
 *
 * Deliberately uses only zero-cost calls (auth, credit balance, template list)
 * so it can be run freely. Run with:  npx vitest run lib/youcam.smoke.test.ts
 */
import fs from "node:fs";
import path from "node:path";

/** Standalone scripts don't get Next.js's automatic .env loading. */
export function loadEnv(file = ".env") {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
}
