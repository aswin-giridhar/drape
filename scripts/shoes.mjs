/**
 * Footwear assets: shoe reference images -> try-on renders -> manifest.
 *
 * The shoe references in public/shoes/ are NOT from the YouCam template
 * catalogue. That was checked first and ruled out on evidence: walking all 13
 * pages of GET /s2s/v2.0/task/template/cloth returns 250 templates across 14
 * categories (Edgy, Wedding, Modern, Sports, Summer, Cultural Attire,
 * Masculine, Feminine, Urban Classic, Casual, Racewear, Costume, Everyday,
 * Holiday) and NONE of them are footwear. GET /s2s/v2.0/task/template/shoes
 * exists and returns 200 with an empty template list.
 *
 * NOTE for whoever fixes lib/youcam.ts: `listGarmentTemplates` pages with
 * `next_token`, which the API rejects with HTTP 400. The accepted parameter is
 * `starting_token`. As shipped, the catalogue can only ever show page 1.
 *
 * So the references are generated images, made through Runware (RUNWARE_API_KEY
 * in .env) with AIR `runware:101@1` at ~$0.0013 each; the exact prompt is in
 * the git history of this file. The AIR-to-model-name mapping was NOT verified
 * - modelSearch did not return an entry for it - so no model or model-licence
 * is claimed here. What IS certain, and is the part that matters for a public
 * MIT repo: these are generated, not third-party photography, and nothing was
 * scraped.
 *
 * SILHOUETTE CAVEAT, measured: garment_category "shoes" does not always respect
 * the shaft height of the reference. The first rust reference was an ankle
 * boot and rendered as a KNEE-HIGH boot twice in a row from the same image, so
 * the drift is systematic per-reference rather than random. A different ankle-
 * boot reference rendered correctly. If a new colourway comes back with the
 * wrong silhouette, re-rolling the same file will not fix it - change the
 * reference image.
 *
 * Renders use task/cloth (v2) with garment_category "shoes" - NOT task/shoes,
 * which is a different generative endpoint that reinvents the whole scene.
 * Cost is 2 units per render; failed tasks cost 0.
 *
 *   npx tsx scripts/shoes.mjs --units
 *   npx tsx scripts/shoes.mjs --render petrol
 *   npx tsx scripts/shoes.mjs --render petrol rust charcoal cream
 */
import { readFile, writeFile } from "node:fs/promises";

for (const file of [".env", ".env.local"]) {
  const env = await readFile(file, "utf8").catch(() => "");
  for (const line of env.split("\n")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const SITTER = "public/models/person_b.jpg";

const yc = await import("../lib/youcam.ts");

if (process.argv.includes("--units")) {
  console.log("units:", await yc.remainingUnits());
  process.exit(0);
}

const i = process.argv.indexOf("--render");
if (i === -1) {
  console.error("pass --units or --render <slug...>");
  process.exit(1);
}
const slugs = process.argv.slice(i + 1).filter((a) => !a.startsWith("--"));
if (!slugs.length) {
  console.error("--render needs at least one slug");
  process.exit(1);
}

const before = await yc.remainingUnits();
console.log("units before:", before);

// The sitter is uploaded once and the file id reused: re-uploading per render
// costs nothing in units but wastes wall clock on a deadline.
const personId = await yc.uploadImage("cloth", await readFile(SITTER), "person.jpg");
console.log("sitter uploaded:", SITTER);

for (const slug of slugs) {
  const path = `public/shoes/${slug}.jpg`;
  try {
    const refId = await yc.uploadImage("cloth", await readFile(path), `${slug}.jpg`);
    const t0 = Date.now();
    const { imageUrl } = await yc.tryOnGarment({
      personFileId: personId,
      garmentFileId: refId,
      category: "shoes",
    });
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    // Validate the payload, not just the status: an error page is also a 200.
    if (bytes.length < 10_000) throw new Error(`suspiciously small result (${bytes.length}B)`);
    const out = `public/renders/shoes/${slug}.jpg`;
    await writeFile(out, bytes);
    console.log(`OK  ${slug} -> ${out}  ${(bytes.length / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    // Report the failure; never write a partial file or a manifest entry for it.
    console.error(`FAIL ${slug}:`, e?.message ?? e);
  }
}

const after = await yc.remainingUnits();
console.log("units after:", after, "spent:", before - after);
