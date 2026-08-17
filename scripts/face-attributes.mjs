/**
 * Read face attributes for each sitter and merge them into their preset.
 *
 * Run offline, once, so the deployed app spends nothing to show them:
 *
 *   npx tsx scripts/face-attributes.mjs --probe
 *   npx tsx scripts/face-attributes.mjs --write
 *
 * `--probe` runs ONE sitter and prints the raw JSON without touching any file.
 * The result key names for hairColor/eyeColor/lipColor are not in the published
 * documentation, so the shape has to be looked at before anything parses it.
 *
 * Cost: 10 units per sitter (the 1-5 feature band), 30 units for all three.
 */
import { readFile, writeFile } from "node:fs/promises";

const SITTERS = [
  { id: "person_b", face: "public/models/person_b_face.jpg" },
  { id: "person_c", face: "public/models/person_c_face.jpg" },
  { id: "person_a", face: "public/models/person_a_face.jpg" },
];

const probe = process.argv.includes("--probe");
const write = process.argv.includes("--write");
if (!probe && !write) {
  console.error("pass --probe (one sitter, print only) or --write (all three, merge into presets)");
  process.exit(1);
}

// Load .env the way the app does; the key is project-level, not in the shell.
// The names are mixed-case (`YouCam_API_KEY`), so the pattern has to be too.
for (const file of [".env", ".env.local"]) {
  const env = await readFile(file, "utf8").catch(() => "");
  for (const line of env.split("\n")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const { uploadImage, analyseFaceAttributes, remainingUnits } = await import("../lib/youcam.ts");

console.log("units before:", await remainingUnits());

const targets = probe ? SITTERS.slice(0, 1) : SITTERS;
const out = {};

for (const s of targets) {
  const bytes = await readFile(s.face);
  console.log(`\n=== ${s.id} (${(bytes.length / 1024).toFixed(0)}KB) ===`);
  try {
    const fileId = await uploadImage("face-attr-analysis", bytes, "face.jpg");
    const attrs = await analyseFaceAttributes(fileId);
    console.log("RAW:", JSON.stringify(attrs.raw, null, 2));
    console.log("PARSED:", JSON.stringify({ ...attrs, raw: undefined }, null, 2));
    out[s.id] = attrs;
  } catch (e) {
    // Report the failure; never write a partial or invented reading.
    console.error(`${s.id} FAILED:`, e?.message ?? e);
  }
}

console.log("\nunits after:", await remainingUnits());

if (write) {
  for (const [id, attrs] of Object.entries(out)) {
    const path = `public/presets/${id}.json`;
    const preset = JSON.parse(await readFile(path, "utf8"));
    preset.faceAttributes = { ...attrs, raw: undefined };
    await writeFile(path, JSON.stringify(preset, null, 2) + "\n");
    console.log("merged into", path);
  }
  const missing = SITTERS.filter((s) => !out[s.id]).map((s) => s.id);
  if (missing.length) console.warn("NO READING for:", missing.join(", "));
}
