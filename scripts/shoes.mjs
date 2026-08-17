/**
 * Shoe assets: find shoe references, render try-ons, write the manifest.
 *
 * Modes:
 *   --catalogue   free; page the cloth template catalogue and print every
 *                 distinct category_name, plus any template whose category or
 *                 title mentions shoes/footwear. Costs 0 units.
 *   --units       print remaining units and exit.
 *   --render <slug...>  upload public/shoes/<slug>.jpg as the ref and run
 *                 task/cloth with garment_category:"shoes" against the sitter.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

for (const file of [".env", ".env.local"]) {
  const env = await readFile(file, "utf8").catch(() => "");
  for (const line of env.split("\n")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

const yc = await import("../lib/youcam.ts");

if (process.argv.includes("--units")) {
  console.log("units:", await yc.remainingUnits());
  process.exit(0);
}

if (process.argv.includes("--catalogue")) {
  const cats = new Map();
  const hits = [];
  let next, pages = 0;
  do {
    const { items, nextToken } = await yc.listGarmentTemplates(next);
    for (const it of items) {
      cats.set(it.category, (cats.get(it.category) ?? 0) + 1);
      const hay = `${it.category} ${it.title}`.toLowerCase();
      if (/shoe|footwear|sneaker|boot|heel|sandal|loafer/.test(hay)) hits.push(it);
    }
    next = nextToken;
    pages++;
  } while (next && pages < 40);
  console.log("pages walked:", pages, "categories:");
  console.log([...cats.entries()].sort((a, b) => b[1] - a[1]));
  console.log("shoe-ish templates:", JSON.stringify(hits, null, 2));
  process.exit(0);
}

console.error("pass --units, --catalogue or --render");
process.exit(1);
