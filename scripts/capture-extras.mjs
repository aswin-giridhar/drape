/**
 * Captures the sections the original demo capture predates: the 3D turntable,
 * the render zoom, footwear, the palette card and the wardrobe audit.
 *
 * The narration describes all of these; without this the film talks about a
 * turntable that is never on screen, which is worse than not mentioning it.
 *
 * Writes a frame sequence that is spliced over the matching stretch of the main
 * capture, so the total length - and therefore the audio sync - does not move.
 *
 *   node scripts/capture-extras.mjs <outDir> <startIndex> <count> [url]
 */
import { chromium } from "/home/aswin/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs";

const OUT = process.argv[2] ?? "/tmp/drape-frames";
const START = Number(process.argv[3] ?? 292);
const COUNT = Number(process.argv[4] ?? 56);
const URL = process.argv[5] ?? "https://drape-five-delta.vercel.app";
const FPS = 3;

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
).newPage();

let frame = START;
const budget = START + COUNT;

async function roll(seconds, during) {
  const stop = Date.now() + seconds * 1000;
  const task = during ? during() : Promise.resolve();
  while (Date.now() < stop && frame < budget) {
    await page
      .screenshot({ path: `${OUT}/f${String(frame++).padStart(5, "0")}.jpg`, type: "jpeg", quality: 82 })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }
  await task;
}

const click = (re) =>
  page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find((x) => new RegExp(src).test(x.textContent ?? ""));
    if (b) b.click();
    return !!b;
  }, re.source);

await page.goto(URL, { waitUntil: "networkidle" });
await click(/Sitting no\. 1/);
await page.waitForTimeout(3000);

// Into the rail, then hand the garment over as an object.
await page.evaluate(() => document.querySelector(".scrub-pin")?.scrollIntoView());
await page.waitForTimeout(900);
console.log("extras: turntable");
await click(/Turn it/);
await page.waitForTimeout(2500);
await roll(6);

// Drag it round so it is visibly a solid, not a picture.
const mv = await page.$("model-viewer");
if (mv) {
  const b = await mv.boundingBox();
  if (b) {
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await roll(4, async () => {
      for (let i = 0; i < 24; i++) {
        await page.mouse.move(b.x + b.width / 2 + i * 9, b.y + b.height / 2);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.mouse.up();
  }
}

console.log("extras: footwear");
await click(/^Worn$/);
await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector("#footwear")?.scrollIntoView({ block: "start" }));
await roll(4);

console.log("extras: palette card");
await page.evaluate(() => document.querySelector("#palette-card")?.scrollIntoView({ block: "center" }));
await roll(4);

console.log("extras: wardrobe");
await page.evaluate(() => document.querySelector("#closet")?.scrollIntoView({ block: "start" }));
await roll(4);

// Fill whatever budget is left rather than leaving a gap in the sequence.
while (frame < budget) {
  await page
    .screenshot({ path: `${OUT}/f${String(frame++).padStart(5, "0")}.jpg`, type: "jpeg", quality: 82 })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 1000 / FPS));
}

console.log(`extras: wrote frames ${START}..${frame - 1}`);
await browser.close();
