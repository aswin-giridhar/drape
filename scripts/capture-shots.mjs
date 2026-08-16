/**
 * Recaptures every submission screenshot against the live site.
 *
 * Kept in the repo rather than /tmp so it survives session restarts - the
 * throwaway versions of this were lost twice.
 *
 *   node scripts/capture-shots.mjs [url]
 */
import { chromium } from "/home/aswin/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs";

const URL = process.argv[2] ?? "https://drape-five-delta.vercel.app";
const S = "/mnt/e/Hackathon/youcam_vto_hackathon/shots";

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
).newPage();

const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${S}/${name}` });
  console.log("  shot", name);
};
const glide = async (id) => {
  await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id);
  await page.waitForTimeout(900);
};
const clickText = (re) =>
  page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find((x) => new RegExp(src).test(x.textContent));
    if (b) b.click();
    return !!b;
  }, re.source);
const settled = () =>
  page
    .waitForFunction(
      () => !/Preparing/.test(document.querySelector(".scrub-pin .eyebrow")?.textContent || ""),
      null,
      { timeout: 90000 },
    )
    .catch(() => {});
const atScrub = async (frac) => {
  await page.evaluate((f) => {
    const e = document.querySelector(".scrub-stage");
    window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY + (e.offsetHeight - window.innerHeight) * f);
  }, frac);
  await page.waitForTimeout(800);
};
const read = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim(), sel);

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("01-home.png");

await clickText(/Sitting no\. 1/);
await page.waitForFunction(() => document.querySelector(".scrub-stage"), null, { timeout: 40000 });
await settled();
await glide("card");
await shot("02-card.png");

await atScrub(0.02);
console.log("  worst:", await read(".scrub-name"), await read(".scrub-score"));
await shot("04-scrub-worst.png");

await atScrub(0.93);
console.log("  best: ", await read(".scrub-name"), await read(".scrub-score"));
await shot("05-scrub-best.png");

await page.evaluate(() => document.querySelector(".compare")?.scrollIntoView({ block: "center" }));
await shot("10-compare.png");

// bring your own piece
await page.locator("#own input[type=file]").setInputFiles(
  "/mnt/e/Hackathon/youcam_vto_hackathon/public/rail/petrol.jpg",
);
await page.waitForFunction(() => document.querySelector("#own .verdict"), null, { timeout: 30000 }).catch(() => {});
await glide("own");
await shot("07-byop.png");

await page
  .waitForFunction(() => /pieces/.test(document.querySelector("#gallery .idx")?.textContent || ""), null, {
    timeout: 120000,
  })
  .catch(() => {});
await glide("gallery");
await shot("03-gallery.png");

// second sitter
await clickText(/Close this sitting/);
await page.waitForTimeout(900);
await clickText(/Sitting no\. 2/);
await page.waitForFunction(() => document.querySelector(".scrub-stage"), null, { timeout: 40000 });
await settled();
await glide("card");
await shot("06-card-sitter2.png");
// scroll to the true end of the stage: a fraction can land a frame short
await page.evaluate(() => {
  const e = document.querySelector(".scrub-stage");
  window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY + e.offsetHeight - window.innerHeight);
});
await page.waitForTimeout(900);
console.log("  sitter2 best:", await read(".scrub-name"), await read(".scrub-score"));
await shot("09-scrub-sitter2.png");

await browser.close();
console.log("done");
