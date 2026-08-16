/**
 * Captures demo footage by driving the live site and writing a frame sequence.
 *
 * Frames go to fast local disk, not /mnt (Windows-mounted paths make hundreds of
 * small writes painfully slow). Assemble afterwards with ffmpeg.
 *
 *   node scripts/capture-demo.mjs [outDir] [url]
 */
import { chromium } from "/home/aswin/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs";
import fs from "node:fs";

const OUT = process.argv[2] ?? "/tmp/drape-frames";
const URL = process.argv[3] ?? "https://drape-five-delta.vercel.app";
const FPS = 3;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let frame = 0;
let page;

/** Capture `seconds` of footage while `during` runs concurrently. */
async function roll(seconds, during) {
  const stop = Date.now() + seconds * 1000;
  const task = during ? during() : Promise.resolve();
  while (Date.now() < stop) {
    const t0 = Date.now();
    await page
      .screenshot({ path: `${OUT}/f${String(frame++).padStart(5, "0")}.jpg`, type: "jpeg", quality: 82 })
      .catch(() => {});
    const wait = 1000 / FPS - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
  }
  await task;
}

/** Smooth scroll to a selector over `ms`, so the footage pans rather than jumps. */
async function glideTo(selector, ms = 2000, offset = -80) {
  await page.evaluate(
    ([sel, dur, off]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const start = window.scrollY;
      const end = el.getBoundingClientRect().top + window.scrollY + off;
      const t0 = performance.now();
      return new Promise((res) => {
        function step(t) {
          const k = Math.min(1, (t - t0) / dur);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          window.scrollTo(0, start + (end - start) * e);
          if (k < 1) requestAnimationFrame(step);
          else res();
        }
        requestAnimationFrame(step);
      });
    },
    [selector, ms, offset],
  );
}

const clickText = (re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll("button")].find((x) => rx.test(x.textContent));
    if (b) b.click();
    return !!b;
  }, re.source);

const waitFor = (fn, timeout = 120000) =>
  page.waitForFunction(fn, null, { timeout, polling: 500 }).catch(() => {});

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--force-device-scale-factor=1"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page = await ctx.newPage();

console.log("loading", URL);
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ── Beat 1: the hero ────────────────────────────────────────────────
console.log("beat 1: hero");
await roll(16);

// ── Beat 2: the sitting and the colour card ─────────────────────────
console.log("beat 2: sitting");
await roll(3, async () => {
  await glideTo("#sitting", 1800);
});
await clickText(/Sitting no\. 1/);
await waitFor(() => document.querySelector("#card"));
await roll(4);
await roll(14, async () => {
  await glideTo("#card", 3000);
  await page.waitForTimeout(6000);
  await glideTo("#card .readout", 2500, -200);
});
await roll(14);

// ── Beat 3: the rail ────────────────────────────────────────────────
console.log("beat 3: rail");
await waitFor(() => document.querySelector("#rail .exhibit"));
await roll(6, async () => {
  await glideTo("#rail", 2500);
});
await roll(20, async () => {
  await page.waitForTimeout(4000);
  await page.mouse.move(400, 500);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
});
await roll(14, async () => {
  await glideTo("#rail", 2500);
});

// ── Beat 4: hang the top-ranked colour ──────────────────────────────
console.log("beat 4: hang it");
const hung = await page.evaluate(() => {
  const rail = document.querySelector("#rail");
  const b = [...rail.querySelectorAll("button")].find((x) => /hang it on me/i.test(x.textContent));
  if (b) b.click();
  return !!b;
});
console.log("  hang clicked:", hung);
await roll(6);
await waitFor(() =>
  [...document.querySelectorAll("#rail .exhibit")].some((e) => /Hung on the sitter/i.test(e.textContent)),
);
await roll(18);

// ── Beat 5: a second sitter ─────────────────────────────────────────
console.log("beat 5: second sitter");
await clickText(/Close this sitting/);
await page.waitForTimeout(800);
await roll(3, async () => {
  await glideTo("#sitting", 1500);
});
await clickText(/Sitting no\. 2/);
await waitFor(() => document.querySelector("#card"));
await roll(8, async () => {
  await glideTo("#card", 2000);
});
await waitFor(() => document.querySelector("#rail .exhibit"));
await roll(12, async () => {
  await glideTo("#rail", 2500);
  await page.waitForTimeout(6000);
});

// ── Beat 6: the collection, and out ─────────────────────────────────
console.log("beat 6: close");
await roll(8, async () => {
  await glideTo("#gallery", 2500);
});
await roll(4, async () => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
});

console.log(`captured ${frame} frames at ${FPS}fps -> ${(frame / FPS).toFixed(0)}s`);
await browser.close();
