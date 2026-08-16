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

/** Smooth scroll to a selector over `ms`, so footage pans rather than jumps. */
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

/**
 * Roll footage while scrolling through the pinned scrub stage.
 *
 * Scroll is advanced once per captured frame rather than by an in-page
 * requestAnimationFrame loop: two independent clocks drift against each other
 * under screenshot load, and the earlier version left the garment stuck on one
 * colour for twenty seconds of footage. One clock cannot desync from itself.
 */
async function rollScrub(seconds, portion = 1) {
  const total = Math.max(1, Math.round(seconds * FPS));
  const { start, end } = await page.evaluate((frac) => {
    const el = document.querySelector(".scrub-stage");
    if (!el) return { start: window.scrollY, end: window.scrollY };
    const top = el.getBoundingClientRect().top + window.scrollY;
    return { start: window.scrollY, end: top + (el.offsetHeight - window.innerHeight) * frac };
  }, portion);

  for (let i = 0; i < total; i++) {
    const t0 = Date.now();
    await page.evaluate((y) => window.scrollTo(0, y), start + ((end - start) * i) / (total - 1 || 1));
    await page
      .screenshot({ path: `${OUT}/f${String(frame++).padStart(5, "0")}.jpg`, type: "jpeg", quality: 82 })
      .catch(() => {});
    const wait = 1000 / FPS - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
  }
}

const clickText = (re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll("button")].find((x) => rx.test(x.textContent));
    if (b) b.click();
    return !!b;
  }, re.source);

const waitFor = (fn, timeout = 120000) =>
  page.waitForFunction(fn, null, { timeout, polling: 400 }).catch(() => {});

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page = await ctx.newPage();

console.log("loading", URL);
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ── Beat 1: the hero ────────────────────────────────────────────────
console.log("beat 1: hero");
await roll(15);

// ── Beat 2: the sitting and the colour card ─────────────────────────
console.log("beat 2: the sitting");
await roll(3, () => glideTo("#sitting", 1800));
await clickText(/Sitting no\. 1/);
await waitFor(() => document.querySelector("#card"));
await roll(4);
await roll(16, async () => {
  await glideTo("#card", 2500);
  await page.waitForTimeout(7000);
  await glideTo("#card .readout", 2500, -220);
});
await roll(10);

// ── Beat 3: THE SCRUB — the centrepiece ─────────────────────────────
console.log("beat 3: the draping scrub");
await waitFor(() => document.querySelector(".scrub-stage"));
// let every frame decode before we scroll, or the reveal stutters on camera
await waitFor(() => !/Preparing/.test(document.querySelector(".scrub-pin .eyebrow")?.textContent || ""));
await roll(5, () => glideTo("#rail", 2200));
await roll(6);
await rollScrub(42);
await roll(6);

// ── Beat 4: a second sitter, same rail ──────────────────────────────
console.log("beat 4: second sitter");
await clickText(/Close this sitting/);
await page.waitForTimeout(800);
await roll(3, () => glideTo("#sitting", 1400));
await clickText(/Sitting no\. 2/);
await waitFor(() => document.querySelector("#card"));
await roll(8, () => glideTo("#card", 2000));
await waitFor(() => document.querySelector(".scrub-stage"));
await waitFor(() => !/Preparing/.test(document.querySelector(".scrub-pin .eyebrow")?.textContent || ""));
await roll(4, () => glideTo("#rail", 1800));
await rollScrub(22);

// ── Beat 5: the collection, and out ─────────────────────────────────
console.log("beat 5: close");
await roll(8, () => glideTo("#gallery", 2500));
await roll(4, () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })));

console.log(`captured ${frame} frames at ${FPS}fps -> ${(frame / FPS).toFixed(0)}s`);
await browser.close();
