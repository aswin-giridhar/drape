import { describe, expect, it } from "vitest";
import { loadEnv } from "./youcam.smoke";

loadEnv();

const { remainingUnits, listGarmentTemplates } = await import("./youcam");

/**
 * Zero-cost live checks. These prove the RSA id_token port works against the
 * real server - the part most likely to break in translation from Python.
 */
describe("live YouCam client (0 units)", () => {
  it("authenticates and reads the unit balance", async () => {
    const units = await remainingUnits();
    // eslint-disable-next-line no-console
    console.log(`live balance: ${units} units`);
    expect(units).toBeGreaterThan(0);
  }, 60_000);

  it("lists garment templates", async () => {
    const { items } = await listGarmentTemplates();
    // eslint-disable-next-line no-console
    console.log(
      `templates: ${items.length}`,
      items.slice(0, 3).map((i) => `${i.id} (${i.category})`).join(", "),
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toBeTruthy();
    expect(items[0].thumb).toMatch(/^https:\/\//);
  }, 60_000);
});
